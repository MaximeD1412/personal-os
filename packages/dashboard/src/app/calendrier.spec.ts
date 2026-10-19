import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { aujourdhui, type Event, type Scope } from '@personal-os/contracts';
import {
  choisirDansLeSelect,
  optionsOffertes,
  valeurAffichee,
} from '../testing/hlm-select';
import { API_BASE_URL } from './api-base-url';
import { INTERCEPTEURS } from './app.config';
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
  let parametres: Record<string, string | string[]>;
  let donnees: Record<string, unknown>;

  beforeEach(async () => {
    parametres = {};
    donnees = {};

    await TestBed.configureTestingModule({
      imports: [Calendrier],
      providers: [
        provideHttpClient(withInterceptors(INTERCEPTEURS)),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              get queryParamMap() {
                return convertToParamMap(parametres);
              },
              get data() {
                return donnees;
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
    evenements: Event[] = [DENTISTE, DECLARATION],
    depuisLAgenda: Record<string, string> = {},
  ) {
    parametres = depuisLAgenda;

    const fixture = TestBed.createComponent(Calendrier);
    fixture.detectChanges();

    httpMock.expectOne(`${BASE}/espaces`).flush(ESPACES);
    lecture().flush(evenements);

    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  /** La lecture des Événements, quelle que soit sa période. */
  const lecture = () =>
    httpMock.expectOne(
      ({ method, url }) => method === 'GET' && url === `${BASE}/events`,
    );

  /**
   * Laisse une réponse servie atteindre l'écran, sans attendre la stabilité :
   * la relecture qu'elle déclenche la retarderait jusqu'à sa propre réponse.
   */
  async function laisserRepondre(): Promise<void> {
    await new Promise((fin) => setTimeout(fin));
    TestBed.tick();
  }

  /** La relecture qui suit une écriture, servie avec ce que l'API renvoie. */
  async function relire(
    fixture: { whenStable(): Promise<unknown>; detectChanges(): void },
    evenements: Event[],
  ): Promise<void> {
    await laisserRepondre();
    lecture().flush(evenements);
    await fixture.whenStable();
    fixture.detectChanges();
  }

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
      // La lecture en vol garde l'application instable : on ne l'attend pas.
      TestBed.tick();

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
      TestBed.tick();
      saisir(element(fixture), 'mois', '2027-06');
      TestBed.tick();

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
      await relire(fixture, [
        DENTISTE,
        DECLARATION,
        { ...DENTISTE, id: 'event-3', title: 'Réunion' },
      ]);

      expect(element(fixture).textContent).toContain('Réunion');
    });
  });

  /*
   * Après une écriture, la liste est relue sur la période affichée : une
   * réponse d'écriture ne remplace jamais une lecture par une liste partielle.
   */
  describe('Après une écriture', () => {
    it('relit le mois affiché quand une création aboutit pendant sa lecture', async () => {
      const fixture = await monter();
      const racine = element(fixture);

      saisir(racine, 'titre', 'Réunion');
      saisir(racine, 'debut', '2026-10-01T14:00');
      fixture.detectChanges();
      await choisirDansLeSelect(fixture, 'espace', 'Personne A');
      champ<HTMLButtonElement>(racine, 'enregistrer').click();
      const creation = httpMock.expectOne(
        ({ method, url }) => method === 'POST' && url === `${BASE}/events`,
      );

      saisir(racine, 'mois', '2027-05');
      TestBed.tick();
      const mai = lecture();

      creation.flush({ ...DENTISTE, id: 'event-3', title: 'Réunion' });
      TestBed.tick();
      // La lecture de mai n'est pas abandonnée au profit d'une liste partielle…
      expect(mai.cancelled).toBe(false);
      mai.flush([DECLARATION]);
      await laisserRepondre();

      // … et, partie avant que la création n'aboutisse, elle est relue.
      const relecture = lecture();
      expect(relecture.request.params.get('from')).toBe(
        '2027-04-30T22:00:00.000Z',
      );
      relecture.flush([DECLARATION]);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(racine.textContent).toContain('Déclaration de revenus');
      expect(racine.textContent).not.toContain('Réunion');
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
      await relire(fixture, [DENTISTE, DECLARATION]);
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
      await relire(fixture, [
        { ...DENTISTE, title: 'Dentiste (reporté)' },
        DECLARATION,
      ]);

      expect(element(fixture).textContent).toContain('Dentiste (reporté)');
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
      await relire(fixture, [DECLARATION]);

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

  /*
   * L'écran affiche le `message` de l'API, jamais un message de remplacement,
   * et chaque erreur de champ sous le champ qu'elle vise (ADR 0030).
   */
  describe("Une erreur de l'API", () => {
    async function creerReunion() {
      const fixture = await monter();
      const racine = element(fixture);

      saisir(racine, 'titre', 'Réunion');
      saisir(racine, 'debut', '2026-10-01T14:00');
      fixture.detectChanges();
      await choisirDansLeSelect(fixture, 'espace', 'Personne A');
      champ<HTMLButtonElement>(racine, 'enregistrer').click();

      return fixture;
    }

    async function refuser(
      fixture: Awaited<ReturnType<typeof creerReunion>>,
      corps: unknown,
      status: number,
    ) {
      httpMock
        .expectOne(`${BASE}/events`)
        .flush(corps, { status, statusText: 'Refus' });
      await fixture.whenStable();
      fixture.detectChanges();
    }

    it("affiche le message d'une création refusée, et l'erreur sous le champ fautif", async () => {
      const fixture = await creerReunion();
      await refuser(
        fixture,
        {
          status: 400,
          code: 'request.invalid',
          message: 'La requête ne respecte pas le schéma attendu.',
          fields: [
            {
              path: 'startsAt',
              code: 'invalid_format',
              message: 'Le début doit être un instant ISO-8601.',
            },
          ],
        },
        400,
      );
      const racine = element(fixture);

      expect(champ(racine, 'erreur').textContent).toContain(
        'La requête ne respecte pas le schéma attendu.',
      );
      expect(champ(racine, 'erreur-startsAt').textContent).toContain(
        'Le début doit être un instant ISO-8601.',
      );
      expect(champ(racine, 'erreur-title')).toBeNull();
      // La saisie reste là, pour être corrigée.
      expect(champ<HTMLInputElement>(racine, 'titre').value).toBe('Réunion');
    });

    it("affiche le message d'une règle métier", async () => {
      const fixture = await creerReunion();
      await refuser(
        fixture,
        {
          status: 422,
          code: 'event.period_reversed',
          message: 'La fin ne peut pas précéder le début.',
        },
        422,
      );

      expect(champ(element(fixture), 'erreur').textContent).toContain(
        'La fin ne peut pas précéder le début.',
      );
    });

    it("efface l'erreur quand l'envoi suivant réussit", async () => {
      const fixture = await creerReunion();
      await refuser(
        fixture,
        {
          status: 400,
          code: 'request.invalid',
          message: 'La requête ne respecte pas le schéma attendu.',
        },
        400,
      );

      champ<HTMLButtonElement>(element(fixture), 'enregistrer').click();
      httpMock
        .expectOne(`${BASE}/events`)
        .flush({ ...DENTISTE, id: 'event-3', title: 'Réunion' });
      await relire(fixture, [
        DENTISTE,
        DECLARATION,
        { ...DENTISTE, id: 'event-3', title: 'Réunion' },
      ]);

      expect(champ(element(fixture), 'erreur')).toBeNull();
    });

    it("affiche le message d'une lecture refusée", async () => {
      const fixture = TestBed.createComponent(Calendrier);
      fixture.detectChanges();
      httpMock.expectOne(`${BASE}/espaces`).flush(ESPACES);
      lecture().flush(
        {
          status: 503,
          code: 'database.unavailable',
          message: 'La base de données ne répond pas.',
        },
        { status: 503, statusText: 'Service Unavailable' },
      );
      await fixture.whenStable();
      fixture.detectChanges();

      expect(champ(element(fixture), 'erreur').textContent).toContain(
        'La base de données ne répond pas.',
      );
    });
  });

  /*
   * `/calendrier/evenements/nouveau` : le formulaire de création, prérempli
   * par les paramètres de la requête, validés par le contrat (ADR 0030).
   * Rien n'est enregistré sans clic : `httpMock.verify()` le garantit.
   */
  describe("Le formulaire prérempli par l'URL", () => {
    const monterLaCreation = (requete: Record<string, string | string[]>) => {
      donnees = { creation: true };
      return monter([DENTISTE, DECLARATION], requete);
    };

    it('reprend les valeurs de la requête, sans rien enregistrer', async () => {
      const fixture = await monterLaCreation({
        title: 'Dentiste',
        category: 'BIRTHDAY',
      });
      const racine = element(fixture);

      expect(champ<HTMLInputElement>(racine, 'titre').value).toBe('Dentiste');
      expect(valeurAffichee(fixture, 'categorie')).toBe('Anniversaire');
      expect(champ(racine, 'ignores')).toBeNull();
    });

    it("reprend le début, la fin, le rappel et l'Espace", async () => {
      const startsAt = '2026-11-03T08:30:00.000Z';
      const endsAt = '2026-11-03T09:00:00.000Z';
      const fixture = await monterLaCreation({
        startsAt,
        endsAt,
        reminderLeadMinutes: '60',
        scopeId: 'espace-foyer',
      });
      const racine = element(fixture);

      // Les champs saisissent en heure locale.
      expect(
        new Date(champ<HTMLInputElement>(racine, 'debut').value).getTime(),
      ).toBe(new Date(startsAt).getTime());
      expect(
        new Date(champ<HTMLInputElement>(racine, 'fin').value).getTime(),
      ).toBe(new Date(endsAt).getTime());
      expect(valeurAffichee(fixture, 'rappel')).toBe('1 heure avant');
      expect(valeurAffichee(fixture, 'espace')).toBe('Foyer');
    });

    it("garde l'Espace de la requête plutôt que celui de la TopBar", async () => {
      const courant = TestBed.inject(EspaceCourant);
      courant.espaces.set(ESPACES);
      courant.choisir('espace-a');

      const fixture = await monterLaCreation({ scopeId: 'espace-foyer' });

      expect(valeurAffichee(fixture, 'espace')).toBe('Foyer');
    });

    it('ignore et signale un paramètre invalide', async () => {
      const fixture = await monterLaCreation({
        title: 'Dentiste',
        category: ['APPOINTMENT', 'FOO'],
      });
      const racine = element(fixture);

      expect(champ(racine, 'ignores').textContent).toContain(
        "Ces valeurs n'ont pas pu être reprises : category=FOO",
      );
      expect(champ<HTMLInputElement>(racine, 'titre').value).toBe('Dentiste');
      expect(valeurAffichee(fixture, 'categorie')).toBe('Rendez-vous');
    });

    it('crée l’Événement prérempli au clic sur « Créer »', async () => {
      const fixture = await monterLaCreation({
        title: 'Dentiste',
        startsAt: '2026-11-03T08:30:00.000Z',
        scopeId: 'espace-a',
        category: 'FOO',
      });
      const racine = element(fixture);
      const bouton = champ<HTMLButtonElement>(racine, 'enregistrer');

      expect(bouton.textContent).toContain('Créer');
      bouton.click();

      const envoi = httpMock.expectOne(`${BASE}/events`);
      expect(envoi.request.body).toMatchObject({
        title: 'Dentiste',
        startsAt: '2026-11-03T08:30:00.000Z',
        category: 'APPOINTMENT',
        scopeId: 'espace-a',
      });
      envoi.flush({
        ...DENTISTE,
        id: 'event-3',
        startsAt: '2026-11-03T08:30:00.000Z',
      });
      await relire(fixture, [DENTISTE, DECLARATION]);

      // La saisie est faite : le bandeau ne parle plus d'elle.
      expect(champ(racine, 'ignores')).toBeNull();
      expect(champ<HTMLInputElement>(racine, 'titre').value).toBe('');
    });
  });
});
