import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, type Router } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { BASE, ouvrirLesProjets, RELIURE } from '../../testing/projets';

/** La prochaine navigation achevée, quand la page suivante lit déjà l'API. */
function arrivee(router: Router): Promise<unknown> {
  return firstValueFrom(
    router.events.pipe(
      filter((evenement) => evenement instanceof NavigationEnd),
    ),
  );
}

function champ(el: HTMLElement, nom: string): HTMLInputElement {
  return el.querySelector(`[data-test="${nom}"]`) as HTMLInputElement;
}

function saisir(element: HTMLInputElement, valeur: string): void {
  element.value = valeur;
  element.dispatchEvent(new Event('input'));
}

function envoyer(el: HTMLElement): void {
  (el.querySelector('button[type="submit"]') as HTMLButtonElement).click();
}

describe('Le formulaire d’un Projet', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  describe('en création', () => {
    it('se préremplit par son URL, sans rien enregistrer', async () => {
      const { harness, http, el } = await ouvrirLesProjets(
        '/projets/nouveau?title=Atelier%20de%20reliure',
      );
      await harness.fixture.whenStable();

      expect(champ(el(), 'titre').value).toBe('Atelier de reliure');
      expect(champ(el(), 'notes').value).toBe('');
      expect(el().querySelectorAll('[data-test="lien"]')).toHaveLength(0);
      http.expectNone(() => true);
    });

    it('crée le Projet avec ses notes et ses liens, puis mène à sa fiche', async () => {
      const { harness, http, el, router } = await ouvrirLesProjets(
        '/projets/nouveau?title=Atelier%20de%20reliure',
      );
      await harness.fixture.whenStable();

      saisir(champ(el(), 'notes'), '## Étapes');
      (
        el().querySelector('[data-test="ajouter-un-lien"]') as HTMLButtonElement
      ).click();
      await harness.fixture.whenStable();
      saisir(champ(el(), 'lien-libelle'), 'La reliure');
      saisir(
        champ(el(), 'lien-adresse'),
        'https://fr.wikipedia.org/wiki/Reliure',
      );
      envoyer(el());

      const envoi = http.expectOne(`${BASE}/projects`);
      expect(envoi.request.method).toBe('POST');
      expect(envoi.request.body).toEqual({
        title: 'Atelier de reliure',
        notes: '## Étapes',
        links: [
          { label: 'La reliure', url: 'https://fr.wikipedia.org/wiki/Reliure' },
        ],
      });
      const navigation = arrivee(router);
      envoi.flush(RELIURE);
      await navigation;

      expect(router.url).toBe('/projets/projet-1');
      // La fiche ouverte lit le Projet.
      TestBed.tick();
      http.expectOne(`${BASE}/projects/projet-1`);
    });

    it('montre sous chaque champ le refus de l’API', async () => {
      const { harness, http, el } = await ouvrirLesProjets('/projets/nouveau');
      await harness.fixture.whenStable();

      (
        el().querySelector('[data-test="ajouter-un-lien"]') as HTMLButtonElement
      ).click();
      await harness.fixture.whenStable();
      envoyer(el());

      http.expectOne(`${BASE}/projects`).flush(
        {
          status: 400,
          code: 'request.invalid',
          message: 'La requête est invalide.',
          fields: [
            {
              path: 'title',
              code: 'too_small',
              message: 'Le titre est obligatoire.',
            },
            {
              path: 'links.0.url',
              code: 'invalid_format',
              message: 'Une adresse web, en http ou https.',
            },
          ],
        },
        { status: 400, statusText: 'Bad Request' },
      );
      await harness.fixture.whenStable();

      expect(el().textContent).toContain('Le titre est obligatoire.');
      expect(el().textContent).toContain('Une adresse web, en http ou https.');
    });
  });

  describe('en modification', () => {
    it('part du Projet lu, et enregistre ce qu’on y change', async () => {
      const { harness, http, el, router } = await ouvrirLesProjets(
        '/projets/projet-1/modifier',
      );
      http.expectOne(`${BASE}/projects/projet-1`).flush(RELIURE);
      await harness.fixture.whenStable();

      expect(champ(el(), 'titre').value).toBe('Atelier de reliure');
      expect(champ(el(), 'notes').value).toBe(RELIURE.notes);
      expect(el().querySelectorAll('[data-test="lien"]')).toHaveLength(1);

      (
        el().querySelector('[data-test="retirer-le-lien"]') as HTMLButtonElement
      ).click();
      await harness.fixture.whenStable();
      saisir(champ(el(), 'titre'), 'Reliure copte');
      envoyer(el());

      const envoi = http.expectOne(`${BASE}/projects/projet-1`);
      expect(envoi.request.method).toBe('PATCH');
      expect(envoi.request.body).toEqual({
        title: 'Reliure copte',
        notes: RELIURE.notes,
        links: [],
      });
      const navigation = arrivee(router);
      envoi.flush({ ...RELIURE, title: 'Reliure copte', links: [] });
      await navigation;

      expect(router.url).toBe('/projets/projet-1');
      // La fiche ouverte lit le Projet.
      TestBed.tick();
      http.expectOne(`${BASE}/projects/projet-1`);
    });
  });
});
