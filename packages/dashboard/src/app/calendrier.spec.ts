import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import {
  aujourdhui,
  type Event,
  type EventOccurrence,
  type Scope,
} from '@personal-os/contracts';
import {
  choisirDansLeSelect,
  optionsOffertes,
  valeurAffichee,
} from '../testing/hlm-select';
import { API_BASE_URL } from './api-base-url';
import { Calendrier } from './calendrier';
import { EspaceCourant } from './espace-courant';

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
  recurrence: null,
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
  recurrence: null,
  scopeId: 'espace-foyer',
  createdAt: '2026-08-27T08:00:00.000Z',
};

/** Une occurrence d'un Événement, telle que la lecture d'un mois la rend. */
function occurrenceDe(
  evenement: Event,
  champs: Partial<EventOccurrence> = {},
): EventOccurrence {
  return {
    eventId: evenement.id,
    originalStart: evenement.startsAt,
    isRecurring: evenement.recurrence !== null,
    title: evenement.title,
    startsAt: evenement.startsAt,
    endsAt: evenement.endsAt,
    category: evenement.category,
    reminderLeadMinutes: evenement.reminderLeadMinutes,
    recurrence: evenement.recurrence,
    scopeId: evenement.scopeId,
    ...champs,
  };
}

/** Une série hebdomadaire, et deux de ses occurrences du mois. */
const PISCINE: Event = {
  ...DENTISTE,
  id: 'event-serie',
  title: 'Piscine',
  startsAt: '2026-09-07T16:00:00.000Z',
  category: 'OTHER',
  recurrence: { freq: 'WEEKLY', interval: 1 },
};
const PISCINES: EventOccurrence[] = [
  occurrenceDe(PISCINE),
  occurrenceDe(PISCINE, {
    originalStart: '2026-09-14T16:00:00.000Z',
    startsAt: '2026-09-14T16:00:00.000Z',
  }),
];

describe('Calendrier', () => {
  let httpMock: HttpTestingController;
  let parametres: Record<string, string>;

  beforeEach(async () => {
    parametres = {};

    await TestBed.configureTestingModule({
      imports: [Calendrier],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              get queryParamMap() {
                return convertToParamMap(parametres);
              },
            },
          },
        },
        { provide: API_BASE_URL, useValue: BASE },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  async function monter(
    evenements: (Event | EventOccurrence)[] = [DENTISTE, DECLARATION],
    depuisLAgenda: Record<string, string> = {},
  ) {
    parametres = depuisLAgenda;

    const fixture = TestBed.createComponent(Calendrier);
    fixture.detectChanges();

    httpMock.expectOne(`${BASE}/espaces`).flush(ESPACES);
    lecture().flush(
      evenements.map((evenement) =>
        'eventId' in evenement ? evenement : occurrenceDe(evenement),
      ),
    );

    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  /** La lecture des Événements, quelle que soit sa période. */
  const lecture = () =>
    httpMock.expectOne(
      ({ method, url }) => method === 'GET' && url === `${BASE}/events`,
    );

  const element = (fixture: { nativeElement: unknown }) =>
    fixture.nativeElement as HTMLElement;

  const champ = <T extends HTMLElement>(racine: HTMLElement, nom: string) =>
    racine.querySelector(`[data-test="${nom}"]`) as T;

  /** Les champs de saisie libre. Les selects passent par `hlm-select`. */
  function saisir(racine: HTMLElement, nom: string, valeur: string): void {
    const cible = champ<HTMLInputElement>(racine, nom);
    cible.value = valeur;
    cible.dispatchEvent(new Event('input'));
  }

  describe("L'écran de liste", () => {
    it("nomme l'Espace de chaque Événement, jamais son seul identifiant", async () => {
      const texte = element(await monter()).textContent ?? '';

      expect(texte).toContain('Dentiste');
      expect(texte).toContain('Personne A');
      expect(texte).toContain('Foyer');
    });

    it('marque comme Échéance le seul Événement qui porte la catégorie dédiée', async () => {
      const lignes = element(await monter()).querySelectorAll(
        '[data-test="evenement"]',
      );

      expect(lignes.length).toBe(2);
      expect(lignes[0].querySelector('[data-test="echeance"]')).toBeNull();
      expect(lignes[1].querySelector('[data-test="echeance"]')).not.toBeNull();
    });

    it('affiche le délai de rappel quand il y en a un, et rien sinon', async () => {
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

  describe('Le mois affiché', () => {
    it('demande les Événements du mois en cours, du premier au dernier jour à Paris', async () => {
      const fixture = TestBed.createComponent(Calendrier);
      fixture.detectChanges();
      httpMock.expectOne(`${BASE}/espaces`).flush(ESPACES);

      const demande = lecture().request;
      const [annee, mois] = aujourdhui().split('-').map(Number);
      const premier = new Date(Date.UTC(annee, mois - 1, 1));
      const suivant = new Date(Date.UTC(annee, mois, 1));
      const from = new Date(demande.params.get('from') ?? '');
      const to = new Date(demande.params.get('to') ?? '');

      // Minuit à Paris est 22 h ou 23 h UTC la veille, selon la saison.
      expect(premier.getTime() - from.getTime()).toBeGreaterThanOrEqual(
        3_600_000,
      );
      expect(premier.getTime() - from.getTime()).toBeLessThanOrEqual(7_200_000);
      expect(suivant.getTime() - to.getTime() - 1).toBeGreaterThanOrEqual(
        3_600_000,
      );
      expect(suivant.getTime() - to.getTime() - 1).toBeLessThanOrEqual(
        7_200_000,
      );
    });

    it('ouvre le mois que le lien désigne', async () => {
      parametres = { mois: '2026-10' };
      const fixture = TestBed.createComponent(Calendrier);
      fixture.detectChanges();
      httpMock.expectOne(`${BASE}/espaces`).flush(ESPACES);

      const demande = lecture().request;
      expect(demande.params.get('from')).toBe('2026-09-30T22:00:00.000Z');
      expect(demande.params.get('to')).toBe('2026-10-31T22:59:59.999Z');
      expect(champ<HTMLInputElement>(element(fixture), 'mois').value).toBe(
        '2026-10',
      );
    });

    it("ignore un mois qui n'en est pas un, et ouvre le mois en cours", async () => {
      parametres = { mois: 'octobre' };
      const fixture = TestBed.createComponent(Calendrier);
      fixture.detectChanges();
      httpMock.expectOne(`${BASE}/espaces`).flush(ESPACES);
      lecture().flush([]);

      expect(champ<HTMLInputElement>(element(fixture), 'mois').value).toBe(
        aujourdhui().slice(0, 7),
      );
    });

    it('relit les Événements quand on change de mois', async () => {
      const fixture = await monter();

      saisir(element(fixture), 'mois', '2027-05');
      fixture.detectChanges();
      await fixture.whenStable();

      const demande = lecture();
      expect(demande.request.params.get('from')).toBe(
        '2027-04-30T22:00:00.000Z',
      );
      expect(demande.request.params.get('to')).toBe('2027-05-31T21:59:59.999Z');
      demande.flush([DECLARATION]);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(element(fixture).textContent).not.toContain('Dentiste');
      expect(element(fixture).textContent).toContain('Déclaration de revenus');
    });

    it("n'affiche que le dernier mois demandé, même si l'ancien répond après", async () => {
      const fixture = await monter();

      saisir(element(fixture), 'mois', '2027-05');
      fixture.detectChanges();
      await fixture.whenStable();
      saisir(element(fixture), 'mois', '2027-06');
      fixture.detectChanges();
      await fixture.whenStable();

      const [mai, juin] = httpMock.match(
        ({ method, url }) => method === 'GET' && url === `${BASE}/events`,
      );
      expect(juin.request.params.get('from')).toBe('2027-05-31T22:00:00.000Z');

      juin.flush([{ ...DENTISTE, id: 'event-juin', title: 'Fête de juin' }]);
      // Une lecture abandonnée ne doit plus pouvoir écraser la liste.
      if (!mai.cancelled) {
        mai.flush([DECLARATION]);
      }
      await fixture.whenStable();
      fixture.detectChanges();

      expect(element(fixture).textContent).toContain('Fête de juin');
      expect(element(fixture).textContent).not.toContain(
        'Déclaration de revenus',
      );
    });
  });

  describe("L'écran de création", () => {
    it("offre le choix de l'Espace, et n'en devine aucun sans pré-choix", async () => {
      const fixture = await monter();

      // Aucune valeur par défaut : le déclencheur montre l'invite, pas un
      // Espace qu'on n'aurait pas choisi (ADR 0014).
      expect(valeurAffichee(fixture, 'espace')).toBe('Choisir un Espace');
      expect(await optionsOffertes(fixture, 'espace')).toEqual([
        'Foyer',
        'Personne A',
      ]);
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

      await choisirDansLeSelect(fixture, 'espace', 'Personne A');

      expect(champ<HTMLButtonElement>(racine, 'enregistrer').disabled).toBe(
        false,
      );
    });

    it("crée l'Événement dans l'Espace choisi, et le fait apparaître", async () => {
      const fixture = await monter();
      const racine = element(fixture);

      saisir(racine, 'titre', 'Réunion');
      saisir(racine, 'debut', '2026-10-01T14:00');
      fixture.detectChanges();

      await choisirDansLeSelect(fixture, 'categorie', 'Autre');
      await choisirDansLeSelect(fixture, 'espace', 'Personne A');
      await choisirDansLeSelect(fixture, 'rappel', '1 heure avant');

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

  describe('Les occurrences d’une série', () => {
    it('liste chaque occurrence du mois, chacune à sa date', async () => {
      const lignes = element(await monter(PISCINES)).querySelectorAll(
        '[data-test="evenement"]',
      );

      expect(lignes).toHaveLength(2);
      expect(lignes[0].textContent).toContain('07/09/2026');
      expect(lignes[1].textContent).toContain('14/09/2026');
    });

    it('relit le mois quand la série a été modifiée, ses occurrences ne se calculant que côté API', async () => {
      const fixture = await monter(PISCINES);
      const racine = element(fixture);

      (
        racine.querySelector('[data-test="modifier"]') as HTMLButtonElement
      ).click();
      fixture.detectChanges();
      saisir(racine, 'titre', 'Natation');
      fixture.detectChanges();
      champ<HTMLButtonElement>(racine, 'enregistrer').click();

      const envoi = httpMock.expectOne(`${BASE}/events/event-serie`);
      expect(envoi.request.body).toEqual({ title: 'Natation' });
      envoi.flush({ ...PISCINE, title: 'Natation' });
      await fixture.whenStable();

      lecture().flush(
        PISCINES.map((piscine) => ({ ...piscine, title: 'Natation' })),
      );
      await fixture.whenStable();
      fixture.detectChanges();

      expect(racine.querySelectorAll('[data-test="evenement"]')).toHaveLength(
        2,
      );
      expect(racine.textContent).not.toContain('Piscine');
    });

    it("verrouille les horaires d'une occurrence reprise, et n'envoie jamais ses bornes à la série", async () => {
      // Le 14 septembre est la deuxième occurrence : ses bornes envoyées à la
      // série déplaceraient son début, ou allongeraient chaque occurrence.
      const fixture = await monter(PISCINES);
      const racine = element(fixture);

      (
        racine.querySelectorAll(
          '[data-test="modifier"]',
        )[1] as HTMLButtonElement
      ).click();
      fixture.detectChanges();

      expect(champ<HTMLInputElement>(racine, 'debut').disabled).toBe(true);
      expect(champ<HTMLInputElement>(racine, 'fin').disabled).toBe(true);
      expect(champ(racine, 'horaires-verrouilles')).not.toBeNull();

      saisir(racine, 'fin', '2026-09-14T20:00');
      saisir(racine, 'titre', 'Natation');
      fixture.detectChanges();
      champ<HTMLButtonElement>(racine, 'enregistrer').click();

      const envoi = httpMock.expectOne(`${BASE}/events/event-serie`);
      expect(envoi.request.body).toEqual({ title: 'Natation' });
      envoi.flush({ ...PISCINE, title: 'Natation' });
      await fixture.whenStable();
      lecture().flush(PISCINES);
    });

    it("laisse modifier les horaires d'un Événement qui n'a lieu qu'une fois", async () => {
      const fixture = await monter();
      const racine = element(fixture);

      (
        racine.querySelector('[data-test="modifier"]') as HTMLButtonElement
      ).click();
      fixture.detectChanges();

      expect(champ<HTMLInputElement>(racine, 'debut').disabled).toBe(false);
      expect(champ(racine, 'horaires-verrouilles')).toBeNull();
    });

    it('retire toutes les occurrences de la série supprimée', async () => {
      const fixture = await monter([...PISCINES, DENTISTE]);
      const racine = element(fixture);

      (
        racine.querySelector('[data-test="supprimer"]') as HTMLButtonElement
      ).click();
      httpMock.expectOne(`${BASE}/events/event-serie`).flush(null);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(racine.textContent).not.toContain('Piscine');
      expect(racine.textContent).toContain('Dentiste');
    });
  });

  describe("L'Espace pré-choisi dans la TopBar", () => {
    /** Le parcours : « Foyer » choisi dans la TopBar, puis le Calendrier. */
    function preChoisir(id: string): void {
      const courant = TestBed.inject(EspaceCourant);
      courant.espaces.set(ESPACES);
      courant.choisir(id);
    }

    it("préremplit l'Espace d'une nouvelle saisie, sans le figer", async () => {
      preChoisir('espace-foyer');
      const fixture = await monter();

      expect(valeurAffichee(fixture, 'espace')).toBe('Foyer');

      await choisirDansLeSelect(fixture, 'espace', 'Personne A');
      expect(valeurAffichee(fixture, 'espace')).toBe('Personne A');
    });

    it("suit le sélecteur tant que l'Espace n'a pas été choisi à la main", async () => {
      preChoisir('espace-foyer');
      const fixture = await monter();

      preChoisir('espace-a');
      await fixture.whenStable();
      expect(valeurAffichee(fixture, 'espace')).toBe('Personne A');

      await choisirDansLeSelect(fixture, 'espace', 'Foyer');
      preChoisir('espace-a');
      await fixture.whenStable();
      expect(valeurAffichee(fixture, 'espace')).toBe('Foyer');
    });

    it("n'écrase pas l'Espace d'un Événement en modification", async () => {
      preChoisir('espace-foyer');
      const fixture = await monter();
      const racine = element(fixture);

      // Le Dentiste est dans l'Espace de Personne A.
      (
        racine.querySelectorAll(
          '[data-test="modifier"]',
        )[0] as HTMLButtonElement
      ).click();
      await fixture.whenStable();
      expect(valeurAffichee(fixture, 'espace')).toBe('Personne A');

      champ<HTMLButtonElement>(racine, 'annuler').click();
      await fixture.whenStable();
      expect(valeurAffichee(fixture, 'espace')).toBe('Foyer');
    });

    it("crée l'Événement dans l'Espace pré-choisi", async () => {
      preChoisir('espace-foyer');
      const fixture = await monter();
      const racine = element(fixture);

      saisir(racine, 'titre', 'Réunion de copropriété');
      saisir(racine, 'debut', '2026-11-03T18:30');
      await fixture.whenStable();
      champ<HTMLButtonElement>(racine, 'enregistrer').click();

      const creation = httpMock.expectOne(`${BASE}/events`);
      expect(creation.request.body).toMatchObject({ scopeId: 'espace-foyer' });
      creation.flush({ ...DECLARATION, id: 'event-3' });
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
      // Les selects n'ont plus de `.value` à lire : ce qui compte est ce que
      // le déclencheur montre, puisque c'est ce que la personne voit.
      expect(valeurAffichee(fixture, 'categorie')).toBe('Échéance');
      expect(valeurAffichee(fixture, 'espace')).toBe('Foyer');
      expect(valeurAffichee(fixture, 'rappel')).toBe('1 semaine avant');
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
      lecture().flush([
        occurrenceDe({ ...DENTISTE, title: 'Dentiste (reporté)' }),
        occurrenceDe(DECLARATION),
      ]);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(element(fixture).textContent).toContain('Dentiste (reporté)');
    });

    it("relit le mois après une modification, pour garder ce qu'une exception a changé", async () => {
      // Le chantier n'a pas de règle, mais une exception prolonge sa fin au
      // 15 : l'Événement que rend le PATCH ne le sait pas, la lecture si.
      const chantier: Event = {
        ...DENTISTE,
        id: 'event-chantier',
        title: 'Chantier',
        startsAt: '2026-09-01T08:00:00.000Z',
        category: 'OTHER',
      };
      const prolonge = occurrenceDe(chantier, {
        endsAt: '2026-09-15T08:00:00.000Z',
      });
      const fixture = await monter([prolonge]);
      const racine = element(fixture);

      (
        racine.querySelector('[data-test="modifier"]') as HTMLButtonElement
      ).click();
      fixture.detectChanges();
      await choisirDansLeSelect(fixture, 'categorie', 'Rendez-vous');
      champ<HTMLButtonElement>(racine, 'enregistrer').click();

      const envoi = httpMock.expectOne(`${BASE}/events/event-chantier`);
      expect(envoi.request.body).toEqual({ category: 'APPOINTMENT' });
      envoi.flush({ ...chantier, category: 'APPOINTMENT' });
      await fixture.whenStable();

      lecture().flush([{ ...prolonge, category: 'APPOINTMENT' }]);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(racine.textContent).toContain('15/09/2026');
    });

    it('rend le formulaire à la création quand on annule', async () => {
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

  /*
   * L'Agenda est en lecture seule et renvoie ici. Atterrir sur l'écran sans
   * atterrir sur l'objet ferait recommencer la recherche à la main : le
   * paramètre que porte le lien ouvre directement l'Événement visé.
   */
  describe("Arriver depuis l'Agenda", () => {
    it("reprend l'Événement que le lien désigne", async () => {
      const fixture = await monter([DENTISTE, DECLARATION], {
        evenement: 'event-2',
      });

      expect(champ<HTMLInputElement>(element(fixture), 'titre').value).toBe(
        'Déclaration de revenus',
      );
    });

    it("laisse le formulaire vierge quand l'Événement désigné n'est pas là", async () => {
      const fixture = await monter([DENTISTE], { evenement: 'event-inconnu' });

      expect(champ<HTMLInputElement>(element(fixture), 'titre').value).toBe('');
    });

    it('laisse le formulaire vierge quand le lien ne désigne rien', async () => {
      const fixture = await monter();

      expect(champ<HTMLInputElement>(element(fixture), 'titre').value).toBe('');
    });
  });
});
