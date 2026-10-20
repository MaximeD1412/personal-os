import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StockageDisque } from './stockage-disque';
import type { StockageObjet } from './stockage-objet';

describe('StockageDisque', () => {
  let racine: string;
  let stockage: StockageObjet;

  beforeEach(async () => {
    racine = await mkdtemp(join(tmpdir(), 'personal-os-stockage-'));
    stockage = new StockageDisque(racine);
  });

  afterEach(async () => {
    await rm(racine, { recursive: true, force: true });
  });

  it('rend ce qui a été déposé, avec sa taille et son instant de dépôt', async () => {
    const avant = Date.now();
    await stockage.deposer(
      'cv/FR.pdf',
      Buffer.from('%PDF-1.7 bonjour'),
      'application/pdf',
    );

    const objet = await stockage.lire('cv/FR.pdf');

    expect(objet?.contenu.toString()).toBe('%PDF-1.7 bonjour');
    expect(objet?.taille).toBe(16);
    expect(objet?.deposeLe.getTime()).toBeGreaterThanOrEqual(avant - 1_000);
  });

  it('décrit un objet sans en lire le contenu', async () => {
    await stockage.deposer(
      'cv/EN.pdf',
      Buffer.from('%PDF-abc'),
      'application/pdf',
    );

    expect(await stockage.decrire('cv/EN.pdf')).toEqual({
      taille: 8,
      deposeLe: expect.any(Date),
    });
  });

  it('remplace un objet déposé sous la même clé', async () => {
    await stockage.deposer(
      'cv/FR.pdf',
      Buffer.from('ancien'),
      'application/pdf',
    );
    await stockage.deposer(
      'cv/FR.pdf',
      Buffer.from('nouveau'),
      'application/pdf',
    );

    expect((await stockage.lire('cv/FR.pdf'))?.contenu.toString()).toBe(
      'nouveau',
    );
    // Le dépôt passe par un fichier de transit : il n'en reste rien.
    expect(await readdir(join(racine, 'cv'))).toEqual(['FR.pdf']);
  });

  it('ne rend rien pour une clé absente', async () => {
    expect(await stockage.lire('cv/FR.pdf')).toBeNull();
    expect(await stockage.decrire('cv/FR.pdf')).toBeNull();
  });

  it('supprime un objet, et ne dit rien de celui qui manque déjà', async () => {
    await stockage.deposer(
      'cv/FR.pdf',
      Buffer.from('%PDF-'),
      'application/pdf',
    );

    await stockage.supprimer('cv/FR.pdf');
    await stockage.supprimer('cv/FR.pdf');

    expect(await stockage.lire('cv/FR.pdf')).toBeNull();
  });

  it.each([
    '../evasion',
    'cv/../../evasion',
    '/absolu',
    'cv//FR.pdf',
    '',
    'cv/',
  ])('refuse la clé « %s », qui sortirait de sa racine', async (cle) => {
    await expect(
      stockage.deposer(cle, Buffer.from('x'), 'application/pdf'),
    ).rejects.toThrow('clé');
    await expect(stockage.lire(cle)).rejects.toThrow('clé');
  });
});
