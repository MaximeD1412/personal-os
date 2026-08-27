import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { Event, Scope } from '@personal-os/contracts';
import { API_BASE_URL } from './api-base-url';
import { Calendrier } from './calendrier';

const BASE = 'http://api.test/api';

const ESPACES: Scope[] = [
  { id: 'espace-foyer', kind: 'HOUSEHOLD', label: 'Foyer' },
  { id: 'espace-a', kind: 'PERSONAL', label: 'Personne A' },
];

const DENTISTE: Event = {
  id: 'event-1',
  title: 'Dentiste',
  startsAt: '2026-09-14T09:30:00.000Z',
  endsAt: null,
  category: 'APPOINTMENT',
  reminderLeadMinutes: null,
  scopeId: 'espace-a',
  createdAt: '2026-08-27T08:00:00.000Z',
};

const DECLARATION: Event = {
  id: 'event-2',
  title: 'Déclaration de revenus',
  startsAt: '2027-05-20T00:00:00.000Z',
  endsAt: null,
  category: 'DEADLINE',
  reminderLeadMinutes: 10_080,
  scopeId: 'espace-foyer',
  createdAt: '2026-08-27T08:00:00.000Z',
};

describe('Calendrier', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Calendrier],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  async function monter(evenements: Event[] = [DENTISTE, DECLARATION]) {
    const fixture = TestBed.createComponent(Calendrier);
    fixture.detectChanges();

    httpMock.expectOne(`${BASE}/espaces`).flush(ESPACES);
    httpMock.expectOne(`${BASE}/events`).flush(evenements);

    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const element = (fixture: { nativeElement: unknown }) =>
    fixture.nativeElement as HTMLElement;

  const champ = <T extends HTMLElement>(racine: HTMLElement, nom: string) =>
    racine.querySelector(`[data-test="${nom}"]`) as T;

  function saisir(racine: HTMLElement, nom: string, valeur: string): void {
    const cible = champ<HTMLInputElement | HTMLSelectElement>(racine, nom);
    cible.value = valeur;
    cible.dispatchEvent(
      new Event(cible.tagName === 'SELECT' ? 'change' : 'input'),
    );
  }

  describe("L'écran de liste", () => {
    it("nomme l'Espace de chaque Événement, jamais son seul identifiant", async () => {
      const texte = element(await monter()).textContent ?? '';

      expect(texte).toContain('Dentiste');
      expect(texte).toContain('Personne A');
      expect(texte).toContain('Foyer');
    });

    it("marque comme Échéance le seul Événement qui porte la catégorie dédiée", async () => {
      const lignes = element(await monter()).querySelectorAll(
        '[data-test="evenement"]',
      );

      expect(lignes.length).toBe(2);
      expect(lignes[0].querySelector('[data-test="echeance"]')).toBeNull();
      expect(
        lignes[1].querySelector('[data-test="echeance"]'),
      ).not.toBeNull();
    });

    it("affiche le délai de rappel quand il y en a un, et rien sinon", async () => {
      const lignes = element(await monter()).querySelectorAll(
        '[data-test="evenement"]',
      );

      expect(lignes[0].querySelector('[data-test="rappel"]')).toBeNull();
      expect(
        lignes[1].querySelector('[data-test="rappel"]')?.textContent,
      ).toContain('1 semaine');
    });

    it("le dit quand aucun Événement n'est visible", async () => {
      expect(element(await monter([])).textContent).toContain(
        'Aucun Événement',
      );
    });
  });

  describe("L'écran de création", () => {
    it("offre le choix de l'Espace, et n'en devine aucun", async () => {
      const options = element(await monter()).querySelectorAll(
        '[data-test="espace"] option',
      );

      expect([...options].map((option) => option.textContent?.trim())).toEqual([
        'Choisir un Espace',
        'Foyer',
        'Personne A',
      ]);
      expect(
        champ<HTMLSelectElement>(element(await monter()), 'espace').value,
      ).toBe('');
    });

    it("laisse le bouton inerte tant que l'Espace n'est pas choisi", async () => {
      const fixture = await monter();
      const racine = element(fixture);

      saisir(racine, 'titre', 'Réunion');
      saisir(racine, 'debut', '2026-10-01T14:00');
      fixture.detectChanges();

      expect(champ<HTMLButtonElement>(racine, 'enregistrer').disabled).toBe(
        true,
      );

      saisir(racine, 'espace', 'espace-a');
      fixture.detectChanges();

      expect(champ<HTMLButtonElement>(racine, 'enregistrer').disabled).toBe(
        false,
      );
    });

    it("crée l'Événement dans l'Espace choisi, et le fait apparaître", async () => {
      const fixture = await monter();
      const racine = element(fixture);

      saisir(racine, 'titre', 'Réunion');
      saisir(racine, 'debut', '2026-10-01T14:00');
      saisir(racine, 'categorie', 'OTHER');
      saisir(racine, 'espace', 'espace-a');
      saisir(racine, 'rappel', '60');
      fixture.detectChanges();

      champ<HTMLButtonElement>(racine, 'enregistrer').click();

      const envoi = httpMock.expectOne(`${BASE}/events`);
      expect(envoi.request.method).toBe('POST');
      expect(envoi.request.body).toMatchObject({
        title: 'Réunion',
        endsAt: null,
        category: 'OTHER',
        reminderLeadMinutes: 60,
        scopeId: 'espace-a',
      });
      // La saisie est en heure locale ; ce qui part sur le réseau est de
      // l'ISO-8601. On compare des instants, pas des chaînes.
      expect(new Date(envoi.request.body.startsAt).getTime()).toBe(
        new Date('2026-10-01T14:00').getTime(),
      );

      envoi.flush({
        ...DENTISTE,
        id: 'event-3',
        title: 'Réunion',
        startsAt: new Date('2026-10-01T14:00').toISOString(),
      });
      await fixture.whenStable();
      fixture.detectChanges();

      expect(element(fixture).textContent).toContain('Réunion');
    });
  });

  describe("L'écran d'édition", () => {
    it("reprend l'Événement choisi dans le formulaire", async () => {
      const fixture = await monter();
      const racine = element(fixture);

      (
        racine.querySelectorAll(
          '[data-test="modifier"]',
        )[1] as HTMLButtonElement
      ).click();
      fixture.detectChanges();

      expect(champ<HTMLInputElement>(racine, 'titre').value).toBe(
        'Déclaration de revenus',
      );
      expect(champ<HTMLSelectElement>(racine, 'categorie').value).toBe(
        'DEADLINE',
      );
      expect(champ<HTMLSelectElement>(racine, 'espace').value).toBe(
        'espace-foyer',
      );
      expect(champ<HTMLSelectElement>(racine, 'rappel').value).toBe('10080');
    });

    it("n'envoie que les champs modifiés", async () => {
      const fixture = await monter();
      const racine = element(fixture);

      (
        racine.querySelectorAll(
          '[data-test="modifier"]',
        )[0] as HTMLButtonElement
      ).click();
      fixture.detectChanges();

      saisir(racine, 'titre', 'Dentiste (reporté)');
      fixture.detectChanges();
      champ<HTMLButtonElement>(racine, 'enregistrer').click();

      const envoi = httpMock.expectOne(`${BASE}/events/event-1`);
      expect(envoi.request.method).toBe('PATCH');
      expect(envoi.request.body).toEqual({ title: 'Dentiste (reporté)' });

      envoi.flush({ ...DENTISTE, title: 'Dentiste (reporté)' });
      await fixture.whenStable();
      fixture.detectChanges();

      expect(element(fixture).textContent).toContain('Dentiste (reporté)');
    });

    it("rend le formulaire à la création quand on annule", async () => {
      const fixture = await monter();
      const racine = element(fixture);

      (
        racine.querySelectorAll(
          '[data-test="modifier"]',
        )[0] as HTMLButtonElement
      ).click();
      fixture.detectChanges();
      champ<HTMLButtonElement>(racine, 'annuler').click();
      fixture.detectChanges();

      expect(champ<HTMLInputElement>(racine, 'titre').value).toBe('');
      expect(champ<HTMLButtonElement>(racine, 'annuler')).toBeNull();
    });

    it("retire l'Événement supprimé de la liste", async () => {
      const fixture = await monter();

      (
        element(fixture).querySelector(
          '[data-test="supprimer"]',
        ) as HTMLButtonElement
      ).click();

      httpMock.expectOne(`${BASE}/events/event-1`).flush(null);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(element(fixture).textContent).not.toContain('Dentiste');
    });
  });
});
