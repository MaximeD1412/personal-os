import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  BASE,
  ouvrirLesProjets,
  RESUME_POTAGER,
  RESUME_RELIURE,
} from '../../testing/projets';

describe('La liste des Projets', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('liste les Projets avec le total engagé, chacun menant à sa fiche', async () => {
    const { harness, http, el } = await ouvrirLesProjets('/projets');

    http.expectOne(`${BASE}/projects`).flush([RESUME_RELIURE, RESUME_POTAGER]);
    await harness.fixture.whenStable();

    const lignes = el().querySelectorAll('[data-test="projet"]');
    expect(lignes).toHaveLength(2);
    expect(lignes[0].textContent).toContain('Atelier de reliure');
    expect(lignes[0].textContent).toContain('96,90\u00a0€');
    expect(lignes[0].textContent).toContain('Modifié le 12 oct. 2026');
    expect(lignes[0].getAttribute('href')).toBe('/projets/projet-1');
    expect(lignes[1].textContent).toContain('0,00\u00a0€');
  });

  it('propose un premier Projet quand il n’y en a aucun', async () => {
    const { harness, http, el } = await ouvrirLesProjets('/projets');

    http.expectOne(`${BASE}/projects`).flush([]);
    await harness.fixture.whenStable();

    expect(el().textContent).toContain('Aucun projet pour l’instant');
    expect(
      el().querySelector('[data-test="nouveau"]')?.getAttribute('href'),
    ).toBe('/projets/nouveau');
  });

  it('affiche le message de l’API quand la lecture échoue', async () => {
    const { harness, http, el } = await ouvrirLesProjets('/projets');

    http
      .expectOne(`${BASE}/projects`)
      .flush(
        { status: 500, code: 'internal', message: 'La base ne répond pas.' },
        { status: 500, statusText: 'Internal Server Error' },
      );
    await harness.fixture.whenStable();

    expect(el().textContent).toContain('La base ne répond pas.');
  });
});
