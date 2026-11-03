import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, type Router } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { BASE, ouvrirLesProjets, RELIURE } from '../../testing/projets';

/** Le texte d'un élément, espaces normalisés (y compris les insécables). */
function texte(el: HTMLElement | null | undefined): string {
  return el?.textContent?.replace(/[\s\u00a0\u202f]+/g, ' ').trim() ?? '';
}

function partie(el: HTMLElement, nom: string): HTMLElement | null {
  return el.querySelector(`[data-test="${nom}"]`);
}

function arrivee(router: Router): Promise<unknown> {
  return firstValueFrom(
    router.events.pipe(
      filter((evenement) => evenement instanceof NavigationEnd),
    ),
  );
}

async function ouvrirLaReliure(options?: { confirme?: boolean }) {
  const ouvert = await ouvrirLesProjets('/projets/projet-1', options);
  ouvert.http.expectOne(`${BASE}/projects/projet-1`).flush(RELIURE);
  await ouvert.harness.fixture.whenStable();
  return ouvert;
}

describe('La fiche d’un Projet', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('montre ses dépenses et leur total au centime près', async () => {
    const { el } = await ouvrirLaReliure();

    expect(el().querySelector('h1')?.textContent).toContain(
      'Atelier de reliure',
    );
    const lignes = [
      ...el().querySelectorAll('[data-test="depense"]'),
    ] as HTMLElement[];
    expect(lignes.map(texte)).toEqual([
      expect.stringMatching(/^Fil de lin ciré 2 oct\. 2026 7,90 €/),
      expect.stringMatching(/^Presse à relier 14 sept\. 2026 89,00 €/),
    ]);
    expect(texte(partie(el(), 'total'))).toBe('96,90 €');
    expect(partie(el(), 'ajouter-une-depense')?.getAttribute('href')).toBe(
      '/projets/projet-1/depenses/nouvelle',
    );
    expect(partie(el(), 'modifier')?.getAttribute('href')).toBe(
      '/projets/projet-1/modifier',
    );
  });

  it('mène à sa Présentation publique, par son onglet', async () => {
    const { el } = await ouvrirLaReliure();

    expect(partie(el(), 'onglet-fiche')?.getAttribute('aria-current')).toBe(
      'page',
    );
    expect(partie(el(), 'onglet-presentation')?.getAttribute('href')).toBe(
      '/projets/projet-1/presentation',
    );
  });

  it('rend ses notes en markdown, sans en exécuter le HTML', async () => {
    const { harness, http, el } = await ouvrirLesProjets('/projets/projet-1');
    http.expectOne(`${BASE}/projects/projet-1`).flush({
      ...RELIURE,
      notes:
        '## Étapes\n\n- [x] Choisir le papier\n\n<img src=x onerror="alert(1)">',
    });
    await harness.fixture.whenStable();

    const notes = partie(el(), 'notes-rendues') as HTMLElement;
    expect(texte(notes.querySelector('h2'))).toBe('Étapes');
    expect(texte(notes.querySelector('li.tache'))).toBe('☑ Choisir le papier');
    expect(notes.querySelector('img')).toBeNull();
    expect(texte(notes)).toContain('<img src=x onerror="alert(1)">');
  });

  it('ouvre ses liens hors de l’application', async () => {
    const { el } = await ouvrirLaReliure();

    const lien = partie(el(), 'liens')?.querySelector('a');
    expect(texte(lien)).toContain('La reliure');
    expect(lien?.getAttribute('href')).toBe(
      'https://fr.wikipedia.org/wiki/Reliure',
    );
    expect(lien?.getAttribute('target')).toBe('_blank');
    expect(lien?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('dit qu’un Projet neuf n’a ni notes, ni liens, ni dépenses', async () => {
    const { harness, http, el } = await ouvrirLesProjets('/projets/projet-1');
    http.expectOne(`${BASE}/projects/projet-1`).flush({
      ...RELIURE,
      notes: '',
      links: [],
      expenses: [],
      totalSpent: { cents: 0, currency: 'EUR' },
    });
    await harness.fixture.whenStable();

    expect(texte(partie(el(), 'notes'))).toContain('Aucune note');
    expect(texte(partie(el(), 'liens'))).toContain('Aucun lien');
    expect(texte(partie(el(), 'depenses'))).toContain('Aucune dépense');
    expect(texte(partie(el(), 'total'))).toBe('0,00 €');
  });

  it('retire une dépense après confirmation, puis relit le Projet', async () => {
    const { harness, http, el, confirmations } = await ouvrirLaReliure();

    (
      el().querySelector(
        '[data-test="retirer-la-depense"]',
      ) as HTMLButtonElement
    ).click();
    await harness.fixture.whenStable();

    expect(confirmations).toEqual([
      expect.objectContaining({
        title: 'Retirer la dépense «\u00a0Fil de lin ciré\u00a0» ?',
        destructive: true,
      }),
    ]);
    const retrait = http.expectOne(
      `${BASE}/projects/projet-1/expenses/depense-2`,
    );
    expect(retrait.request.method).toBe('DELETE');
    retrait.flush(null, { status: 204, statusText: 'No Content' });
    TestBed.tick();

    http.expectOne(`${BASE}/projects/projet-1`).flush({
      ...RELIURE,
      expenses: RELIURE.expenses.slice(1),
      totalSpent: { cents: 8900, currency: 'EUR' },
    });
    await harness.fixture.whenStable();
    expect(texte(partie(el(), 'total'))).toBe('89,00 €');
  });

  it('supprime le Projet après confirmation, puis revient à la liste', async () => {
    const { harness, http, el, router, confirmations } =
      await ouvrirLaReliure();

    (
      el().querySelector('[data-test="supprimer"]') as HTMLButtonElement
    ).click();
    await harness.fixture.whenStable();

    expect(confirmations).toEqual([
      expect.objectContaining({
        title: 'Supprimer le projet «\u00a0Atelier de reliure\u00a0» ?',
        confirmLabel: 'Supprimer le projet',
        destructive: true,
      }),
    ]);
    const suppression = http.expectOne(`${BASE}/projects/projet-1`);
    expect(suppression.request.method).toBe('DELETE');
    const navigation = arrivee(router);
    suppression.flush(null, { status: 204, statusText: 'No Content' });
    await navigation;

    expect(router.url).toBe('/projets');
    TestBed.tick();
    http.expectOne(`${BASE}/projects`);
  });

  it('ne supprime rien quand on renonce', async () => {
    const { harness, http, el } = await ouvrirLaReliure({ confirme: false });

    (
      el().querySelector('[data-test="supprimer"]') as HTMLButtonElement
    ).click();
    await harness.fixture.whenStable();

    http.expectNone(`${BASE}/projects/projet-1`);
  });

  it('montre le refus de l’API quand la suppression échoue', async () => {
    const { harness, http, el } = await ouvrirLaReliure();

    (
      el().querySelector('[data-test="supprimer"]') as HTMLButtonElement
    ).click();
    await harness.fixture.whenStable();
    http.expectOne(`${BASE}/projects/projet-1`).flush(
      {
        status: 404,
        code: 'project.not_found',
        message: 'Aucun Projet de cet identifiant.',
      },
      { status: 404, statusText: 'Not Found' },
    );
    await harness.fixture.whenStable();

    expect(texte(partie(el(), 'refus'))).toContain(
      'Aucun Projet de cet identifiant.',
    );
  });

  it('affiche le message de l’API pour un Projet introuvable', async () => {
    const { harness, http, el } = await ouvrirLesProjets('/projets/inconnu');
    http.expectOne(`${BASE}/projects/inconnu`).flush(
      {
        status: 404,
        code: 'project.not_found',
        message: 'Aucun Projet de cet identifiant.',
      },
      { status: 404, statusText: 'Not Found' },
    );
    await harness.fixture.whenStable();

    expect(el().textContent).toContain('Aucun Projet de cet identifiant.');
  });
});
