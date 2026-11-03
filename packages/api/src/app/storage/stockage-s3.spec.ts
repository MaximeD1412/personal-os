import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NoSuchKey,
  NotFound,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { StockageS3, type ClientS3 } from './stockage-s3';

const DEPOSE_LE = new Date('2026-05-15T08:00:00Z');

/** Le client du SDK, remplacé : ce test n'atteint jamais le réseau. */
function unClient(reponse: (commande: unknown) => unknown = () => ({})) {
  const send = jest.fn(async (commande: unknown) => reponse(commande));
  return { client: { send } as ClientS3, send };
}

function introuvable(Erreur: typeof NoSuchKey | typeof NotFound) {
  return () => {
    throw new Erreur({ message: 'absent', $metadata: { httpStatusCode: 404 } });
  };
}

describe('StockageS3', () => {
  it('dépose un objet dans le bucket, avec son type de contenu', async () => {
    const { client, send } = unClient();

    await new StockageS3(client, 'personal-os').deposer(
      'cv/FR.pdf',
      Buffer.from('%PDF-'),
      'application/pdf',
    );

    const commande = send.mock.calls[0][0];
    expect(commande).toBeInstanceOf(PutObjectCommand);
    expect((commande as PutObjectCommand).input).toEqual({
      Bucket: 'personal-os',
      Key: 'cv/FR.pdf',
      Body: Buffer.from('%PDF-'),
      ContentType: 'application/pdf',
    });
  });

  it('lit un objet, avec sa taille et son instant de dépôt', async () => {
    const { client, send } = unClient(() => ({
      Body: { transformToByteArray: async () => Buffer.from('%PDF-1.7') },
      ContentLength: 8,
      LastModified: DEPOSE_LE,
    }));

    const objet = await new StockageS3(client, 'personal-os').lire('cv/EN.pdf');

    expect(send.mock.calls[0][0]).toBeInstanceOf(GetObjectCommand);
    expect((send.mock.calls[0][0] as GetObjectCommand).input).toEqual({
      Bucket: 'personal-os',
      Key: 'cv/EN.pdf',
    });
    expect(objet?.contenu.toString()).toBe('%PDF-1.7');
    expect(objet).toMatchObject({ taille: 8, deposeLe: DEPOSE_LE });
  });

  it('décrit un objet par un HEAD, sans en lire le contenu', async () => {
    const { client, send } = unClient(() => ({
      ContentLength: 480_000,
      LastModified: DEPOSE_LE,
    }));

    const description = await new StockageS3(client, 'personal-os').decrire(
      'cv/FR.pdf',
    );

    expect(send.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand);
    expect(description).toEqual({ taille: 480_000, deposeLe: DEPOSE_LE });
  });

  it('ne rend rien pour une clé absente', async () => {
    const lecture = new StockageS3(
      unClient(introuvable(NoSuchKey)).client,
      'b',
    );
    const description = new StockageS3(
      unClient(introuvable(NotFound)).client,
      'b',
    );

    expect(await lecture.lire('cv/FR.pdf')).toBeNull();
    expect(await description.decrire('cv/FR.pdf')).toBeNull();
  });

  it("laisse passer une autre panne que l'absence", async () => {
    const { client } = unClient(() => {
      throw new Error('réseau coupé');
    });

    await expect(new StockageS3(client, 'b').lire('cv/FR.pdf')).rejects.toThrow(
      'réseau coupé',
    );
  });

  it('supprime un objet', async () => {
    const { client, send } = unClient();

    await new StockageS3(client, 'personal-os').supprimer('cv/FR.pdf');

    expect(send.mock.calls[0][0]).toBeInstanceOf(DeleteObjectCommand);
    expect((send.mock.calls[0][0] as DeleteObjectCommand).input).toEqual({
      Bucket: 'personal-os',
      Key: 'cv/FR.pdf',
    });
  });

  it('refuse une clé qui sortirait de sa racine, sans appeler personne', async () => {
    const { client, send } = unClient();

    await expect(
      new StockageS3(client, 'b').deposer('../x', Buffer.from('x'), 'a/b'),
    ).rejects.toThrow('clé');
    expect(send).not.toHaveBeenCalled();
  });
});
