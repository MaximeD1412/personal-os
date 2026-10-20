import { InteractivityChecker } from '@angular/cdk/a11y';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  periodeDuMois,
  type Event,
  type EventOccurrence,
  type Scope,
} from '@personal-os/contracts';
import { fenetreDe } from '../testing/largeur';
import {
  choisirDansLeSelect,
  ouvrirLeSelect,
  valeurAffichee,
} from '../testing/hlm-select';
import { API_BASE_URL } from './api-base-url';
import { INTERCEPTEURS } from './app.config';
import { appRoutes } from './app.routes';
import { EspaceCourant } from './espace-courant';

const BASE = 'http://api.test/api';

/** Mercredi 16 septembre 2026, à Paris. */
const MAINTENANT = new Date('2026-09-16T10:00:00.000Z');

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

/** Une Échéance, aujourd'hui, avec un rappel. */
const IMPOTS: Event = {
  id: 'event-2',
  title: 'Taxe foncière',
  startsAt: '2026-09-16T08:00:00.000Z',
  endsAt: null,
  category: 'DEADLINE',
  reminderLeadMinutes: 10_080,
  recurrence: null,
  scopeId: 'espace-foyer',
  createdAt: '2026-08-27T08:00:00.000Z',
};

const DECLARATION: Event = {
  ...IMPOTS,
  id: 'event-3',
  title: 'Déclaration de revenus',
  startsAt: '2027-05-20T00:00:00.000Z',
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

/** Ce que la lecture du mois rend : un Événement sans règle y est sa seule occurrence. */
function enOccurrence(evenement: Event | EventOccurrence): EventOccurrence {
  return 'eventId' in evenement ? evenement : occurrenceDe(evenement);
}

/** Une série hebdomadaire, et deux de ses occurrences du mois. */
const PISCINE: Event = {
  ...DENTISTE,
  id: 'event-serie',
  title: 'Piscine',
  startsAt: '2026-09-07T16:00:00.000Z',
  endsAt: '2026-09-07T17:00:00.000Z',
  category: 'OTHER',
  recurrence: { freq: 'WEEKLY', interval: 1 },
};
const PISCINES: EventOccurrence[] = [
  occurrenceDe(PISCINE),
  occurrenceDe(PISCINE, {
    originalStart: '2026-09-14T16:00:00.000Z',
    startsAt: '2026-09-14T16:00:00.000Z',
    endsAt: '2026-09-14T17:00:00.000Z',
  }),
];

const MOIS: (Event | EventOccurrence)[] = [DENTISTE, IMPOTS, ...PISCINES];

// jsdom ne calcule aucune mise en page : tout élément y paraît invisible, et
// le piège de focus de la feuille n'y trouverait rien à focaliser.
const atteignable = (element: HTMLElement) =>
  element.tabIndex >= 0 && !(element as HTMLButtonElement).disabled;
const toujoursFocalisable: Partial<InteractivityChecker> = {
  isFocusable: atteignable,
  isTabbable: atteignable,
  isVisible: () => true,
  isDisabled: (element) => (element as HTMLButtonElement).disabled,
};

describe('Calendrier', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    // Seule l'horloge est figée : les minuteries restent réelles, dont
    // `whenStable` a besoin.
    jest.useFakeTimers({
      now: MAINTENANT,
      doNotFake: [
        'nextTick',
        'setImmediate',
        'clearImmediate',
        'setInterval',
        'clearInterval',
        'setTimeout',
        'clearTimeout',
        'queueMicrotask',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'requestIdleCallback',
        'cancelIdleCallback',
        'performance',
        'hrtime',
      ],
    });
  });

  afterEach(() => {
    httpMock.verify();
    jest.useRealTimers();
    document.body
      .querySelectorAll('[role="alertdialog"]')
      .forEach((dialogue) => dialogue.remove());
  });

  function configurer(largeur: number): void {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors(INTERCEPTEURS)),
        provideHttpClientTesting(),
        provideRouter(appRoutes),
        { provide: API_BASE_URL, useValue: BASE },
        fenetreDe(largeur),
        { provide: InteractivityChecker, useValue: toujoursFocalisable },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  }

  /**
   * Laisse partir ce qui est en route (une navigation, une requête, la
   * réponse servie), sans attendre la stabilité : une lecture en cours la
   * retarderait jusqu'à sa propre réponse.
   */
  async function laisserFiler(): Promise<void> {
    for (let tour = 0; tour < 3; tour++) {
      await new Promise((fin) => setTimeout(fin));
      TestBed.tick();
    }
  }

  /** La lecture des Événements, quelle que soit sa période. */
  const lecture = (): TestRequest =>
    httpMock.expectOne(
      ({ method, url }) => method === 'GET' && url === `${BASE}/events`,
    );

  /** Ouvre une adresse sous `/calendrier`, et sert les Espaces puis le mois. */
  async function ouvrir(
    url: string,
    { largeur = 1280, evenements = MOIS } = {},
  ): Promise<RouterTestingHarness> {
    configurer(largeur);
    const harnais = await RouterTestingHarness.create();
    await harnais.navigateByUrl(url);
    await laisserFiler();

    httpMock.expectOne(`${BASE}/espaces`).flush(ESPACES);
    lecture().flush(evenements.map(enOccurrence));
    await harnais.fixture.whenStable();
    harnais.detectChanges();
    return harnais;
  }

  /** La relecture du mois qui suit une écriture, servie avec ce que l'API renvoie. */
  async function relire(
    harnais: RouterTestingHarness,
    evenements: (Event | EventOccurrence)[] = MOIS,
  ): Promise<void> {
    await laisserFiler();
    lecture().flush(evenements.map(enOccurrence));
    await harnais.fixture.whenStable();
    harnais.detectChanges();
  }

  async function cliquer(
    harnais: RouterTestingHarness,
    cible: HTMLElement,
  ): Promise<void> {
    cible.click();
    await laisserFiler();
    harnais.detectChanges();
  }

  const racine = (harnais: RouterTestingHarness) =>
    harnais.fixture.nativeElement as HTMLElement;

  const champ = <T extends HTMLElement>(
    harnais: RouterTestingHarness,
    nom: string,
  ) => racine(harnais).querySelector(`[data-test="${nom}"]`) as T;

  const tous = (harnais: RouterTestingHarness, nom: string) => [
    ...racine(harnais).querySelectorAll<HTMLElement>(`[data-test="${nom}"]`),
  ];

  const texte = (element: Element | null) =>
    element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  const url = () => TestBed.inject(Router).url;

  /** Les champs de saisie libre. */
  function saisir(
    harnais: RouterTestingHarness,
    nom: string,
    valeur: string,
  ): void {
    const cible = champ<HTMLInputElement>(harnais, nom);
    cible.value = valeur;
    cible.dispatchEvent(new globalThis.Event('input'));
    harnais.detectChanges();
  }

  /** Le segment choisi d'un contrôle segmenté. */
  const segmentChoisi = (harnais: RouterTestingHarness, nom: string) =>
    texte(
      racine(harnais).querySelector(
        `[data-test="${nom}"] [aria-pressed="true"]`,
      ),
    );

  async function choisirLeSegment(
    harnais: RouterTestingHarness,
    nom: string,
    libelle: string,
  ): Promise<void> {
    const segment = [
      ...racine(harnais).querySelectorAll<HTMLButtonElement>(
        `[data-test="${nom}"] button`,
      ),
    ].find((bouton) => texte(bouton) === libelle);
    if (!segment) {
      throw new Error(`« ${libelle} » n'est pas un segment de « ${nom} ».`);
    }
    await cliquer(harnais, segment);
  }

  const formulaire = (harnais: RouterTestingHarness) =>
    racine(harnais).querySelector<HTMLElement>('dccm-form-page');

  const bouton = (harnais: RouterTestingHarness, libelle: string) => {
    const trouve = [
      ...racine(harnais).querySelectorAll<HTMLButtonElement>('button'),
    ].find((candidat) => texte(candidat) === libelle);
    if (!trouve) {
      throw new Error(`Aucun bouton « ${libelle} ».`);
    }
    return trouve;
  };

  const caseDu = (harnais: RouterTestingHarness, libelle: string) =>
    tous(harnais, 'jour').find(
      (cellule) => cellule.getAttribute('aria-label') === libelle,
    ) as HTMLElement;

  describe('La période affichée', () => {
    it('lit le mois en cours, du premier au dernier jour à Paris', async () => {
      configurer(1280);
      const harnais = await RouterTestingHarness.create();
      await harnais.navigateByUrl('/calendrier');
      await laisserFiler();

      httpMock.expectOne(`${BASE}/espaces`).flush(ESPACES);
      const requete = lecture();
      const { from, to } = periodeDuMois('2026-09');
      expect(requete.request.params.get('from')).toBe(from);
      expect(requete.request.params.get('to')).toBe(to);
      requete.flush([]);
      await harnais.fixture.whenStable();
      harnais.detectChanges();

      expect(texte(champ(harnais, 'titre-mois'))).toBe('septembre 2026');
    });

    it('ouvre le mois que le lien désigne', async () => {
      const harnais = await ouvrir('/calendrier?mois=2027-05', {
        evenements: [DECLARATION],
      });

      expect(texte(champ(harnais, 'titre-mois'))).toBe('mai 2027');
      expect(texte(caseDu(harnais, 'jeudi 20 mai 2027'))).toContain(
        'Déclaration de revenus',
      );
    });

    it("ignore un mois qui n'en est pas un, et ouvre le mois en cours", async () => {
      const harnais = await ouvrir('/calendrier?mois=2026-13');

      expect(texte(champ(harnais, 'titre-mois'))).toBe('septembre 2026');
    });

    it("change de mois par les flèches, l'écrit dans l'URL, et revient à aujourd'hui", async () => {
      const harnais = await ouvrir('/calendrier');

      await cliquer(harnais, champ(harnais, 'mois-suivant'));
      expect(url()).toBe('/calendrier?mois=2026-10');
      const octobre = lecture();
      expect(octobre.request.params.get('from')).toBe(
        periodeDuMois('2026-10').from,
      );
      octobre.flush([]);
      await harnais.fixture.whenStable();
      harnais.detectChanges();
      expect(texte(champ(harnais, 'titre-mois'))).toBe('octobre 2026');

      await cliquer(harnais, champ(harnais, 'mois-precedent'));
      await relire(harnais);
      await cliquer(harnais, champ(harnais, 'mois-precedent'));
      expect(url()).toBe('/calendrier?mois=2026-08');
      lecture().flush([]);
      await harnais.fixture.whenStable();

      await cliquer(harnais, champ(harnais, 'aujourdhui'));
      expect(url()).toBe('/calendrier?mois=2026-09');
      await relire(harnais);
      expect(texte(champ(harnais, 'titre-mois'))).toBe('septembre 2026');
    });

    it('affiche le message de la lecture refusée, et la relit sur demande', async () => {
      configurer(1280);
      const harnais = await RouterTestingHarness.create();
      await harnais.navigateByUrl('/calendrier');
      await laisserFiler();
      httpMock.expectOne(`${BASE}/espaces`).flush(ESPACES);
      lecture().flush(
        {
          status: 503,
          code: 'database.unavailable',
          message: 'La base de données ne répond pas.',
        },
        { status: 503, statusText: 'Service Unavailable' },
      );
      await harnais.fixture.whenStable();
      harnais.detectChanges();

      expect(texte(racine(harnais))).toContain(
        'La base de données ne répond pas.',
      );

      await cliquer(harnais, bouton(harnais, 'Réessayer'));
      await relire(harnais);
      expect(texte(caseDu(harnais, 'lundi 14 septembre 2026'))).toContain(
        'Dentiste',
      );
    });
  });

  describe('La grille du mois, à partir de 768 px', () => {
    it('couvre les semaines du mois, du lundi qui précède le 1er au dimanche qui suit le dernier', async () => {
      const harnais = await ouvrir('/calendrier');
      const cases = tous(harnais, 'jour');

      expect(cases).toHaveLength(35);
      expect(cases[0].getAttribute('aria-label')).toBe('lundi 31 août 2026');
      expect(cases[0].hasAttribute('data-hors-mois')).toBe(true);
      expect(cases[34].getAttribute('aria-label')).toBe(
        'dimanche 4 octobre 2026',
      );
    });

    it('range chaque occurrence dans la case de son jour, à son heure de Paris', async () => {
      const harnais = await ouvrir('/calendrier');

      const lundi = caseDu(harnais, 'lundi 14 septembre 2026');
      const pastilles = [
        ...lundi.querySelectorAll('[data-test="evenement"]'),
      ].map(texte);
      expect(pastilles).toEqual([
        expect.stringMatching(/^11:30\s*Dentiste/),
        expect.stringMatching(/^18:00\s*Piscine/),
      ]);
      expect(texte(caseDu(harnais, 'lundi 7 septembre 2026'))).toContain(
        'Piscine',
      );
      expect(texte(caseDu(harnais, 'mardi 15 septembre 2026'))).not.toContain(
        'Piscine',
      );
    });

    it("marque aujourd'hui, et l'Échéance qui y tombe", async () => {
      const harnais = await ouvrir('/calendrier');

      const aujourdhui = racine(harnais).querySelector(
        '[data-test="jour"][aria-current="date"]',
      );
      expect(aujourdhui?.getAttribute('aria-label')).toBe(
        'mercredi 16 septembre 2026',
      );
      expect(texte(aujourdhui)).toContain('Taxe foncière');
      expect(tous(harnais, 'echeance').map(texte)).toEqual([', Échéance']);
    });

    it("lie chaque pastille au formulaire de son Événement, à l'occurrence près", async () => {
      const harnais = await ouvrir('/calendrier');

      const piscines = [
        ...caseDu(harnais, 'lundi 14 septembre 2026').querySelectorAll('a'),
      ];
      expect(piscines[1].getAttribute('href')).toBe(
        '/calendrier/evenements/event-serie?mois=2026-09&occurrence=2026-09-14T16:00:00.000Z',
      );
    });
  });

  describe('La semaine et le jour, sous 768 px', () => {
    const ouvrirEnMobile = (adresse = '/calendrier') =>
      ouvrir(adresse, { largeur: 390 });

    it("montre la semaine d'aujourd'hui, et ce qui y tombe aujourd'hui", async () => {
      const harnais = await ouvrirEnMobile();

      expect(tous(harnais, 'jour')).toHaveLength(0);
      expect(tous(harnais, 'jour-du-bandeau')).toHaveLength(7);
      expect(
        racine(harnais)
          .querySelector('[data-test="jour-du-bandeau"][aria-pressed="true"]')
          ?.getAttribute('aria-label'),
      ).toBe('mercredi 16 septembre 2026, 1 événement');

      const liste = champ(harnais, 'liste-du-jour');
      expect(texte(liste.querySelector('h3'))).toBe(
        'mercredi 16 septembre 2026',
      );
      const [impots] = tous(harnais, 'evenement');
      expect(texte(impots)).toContain('Taxe foncière');
      expect(texte(impots)).toContain('Foyer');
      expect(texte(impots.querySelector('[data-test="echeance"]'))).toBe(
        'Échéance',
      );
      expect(texte(impots.querySelector('[data-test="rappel"]'))).toBe(
        'Rappel 1 semaine avant',
      );
    });

    it('groupe par jour : un autre jour de la semaine montre les siens, ou le dit vide', async () => {
      const harnais = await ouvrirEnMobile();
      const jour = (libelle: string) =>
        tous(harnais, 'jour-du-bandeau').find((bouton) =>
          bouton.getAttribute('aria-label')?.startsWith(libelle),
        ) as HTMLElement;

      await cliquer(harnais, jour('lundi 14 septembre'));
      const cartes = tous(harnais, 'evenement');
      expect(cartes.map((carte) => texte(carte.querySelector('h4')))).toEqual([
        'Dentiste',
        'Piscine',
      ]);
      expect(texte(cartes[0])).toContain('Personne A');
      expect(cartes[0].querySelector('[data-test="rappel"]')).toBeNull();
      expect(texte(cartes[1].querySelector('[data-test="horaire"]'))).toBe(
        '18:00 – 19:00',
      );

      await cliquer(harnais, jour('mardi 15 septembre'));
      expect(tous(harnais, 'evenement')).toHaveLength(0);
      expect(texte(champ(harnais, 'liste-du-jour'))).toContain(
        'Aucun Événement ce jour-là',
      );
    });

    it('change de semaine, et de mois quand la semaine en sort', async () => {
      const harnais = await ouvrirEnMobile();

      await cliquer(harnais, champ(harnais, 'semaine-precedente'));
      expect(texte(champ(harnais, 'liste-du-jour').querySelector('h3'))).toBe(
        'mercredi 9 septembre 2026',
      );

      await cliquer(harnais, champ(harnais, 'semaine-suivante'));
      await cliquer(harnais, champ(harnais, 'semaine-suivante'));
      await cliquer(harnais, champ(harnais, 'semaine-suivante'));
      // Le 30 septembre : la semaine reste dans le mois affiché.
      expect(url()).toBe('/calendrier');
      await cliquer(harnais, champ(harnais, 'semaine-suivante'));

      expect(url()).toBe('/calendrier?mois=2026-10');
      lecture().flush([]);
      await harnais.fixture.whenStable();
      harnais.detectChanges();
      expect(texte(champ(harnais, 'liste-du-jour').querySelector('h3'))).toBe(
        'mercredi 7 octobre 2026',
      );
    });
  });

  describe('Le formulaire de création', () => {
    it("s'ouvre à sa route, en panneau à côté du mois à partir de 1280 px", async () => {
      const harnais = await ouvrir('/calendrier');

      await cliquer(harnais, champ(harnais, 'nouvel-evenement'));

      expect(url()).toBe('/calendrier/evenements/nouveau?mois=2026-09');
      expect(formulaire(harnais)?.getAttribute('data-presentation')).toBe(
        'panel',
      );
      expect(tous(harnais, 'jour')).toHaveLength(35);
    });

    it("s'ouvre en feuille sous 1280 px, et se referme par « Annuler »", async () => {
      const harnais = await ouvrir(
        '/calendrier/evenements/nouveau?mois=2026-09',
        {
          largeur: 1024,
        },
      );

      expect(formulaire(harnais)?.getAttribute('data-presentation')).toBe(
        'sheet',
      );

      await cliquer(harnais, bouton(harnais, 'Annuler'));
      expect(url()).toBe('/calendrier?mois=2026-09');
      expect(formulaire(harnais)).toBeNull();
    });

    it('se tient au clavier en feuille : focus pris, Échap ferme, focus rendu', async () => {
      const harnais = await ouvrir('/calendrier', { largeur: 1024 });
      document.body.appendChild(racine(harnais));
      const declencheur = champ<HTMLAnchorElement>(harnais, 'nouvel-evenement');
      declencheur.focus();

      await cliquer(harnais, declencheur);
      await harnais.fixture.whenStable();
      const feuille = formulaire(harnais) as HTMLElement;
      expect(feuille.getAttribute('role')).toBe('dialog');
      expect(feuille.getAttribute('aria-modal')).toBe('true');
      expect(feuille.contains(document.activeElement)).toBe(true);

      feuille.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
      await laisserFiler();
      harnais.detectChanges();

      expect(url()).toBe('/calendrier?mois=2026-09');
      expect(formulaire(harnais)).toBeNull();
      expect(document.activeElement).toBe(declencheur);
      racine(harnais).remove();
    });

    it('laisse Échap fermer la liste du rappel avant la feuille, saisie gardée', async () => {
      const harnais = await ouvrir(
        '/calendrier/evenements/nouveau?mois=2026-09',
        { largeur: 1024 },
      );
      document.body.appendChild(racine(harnais));
      saisir(harnais, 'titre', 'Vaccin');

      expect(await ouvrirLeSelect(harnais.fixture, 'rappel')).not.toEqual([]);
      const declencheurDuRappel = champ(harnais, 'rappel').querySelector(
        '[data-slot="select-trigger"]',
      ) as HTMLElement;
      declencheurDuRappel.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
      await laisserFiler();
      harnais.detectChanges();

      expect(
        document.querySelectorAll('[data-slot="select-item"]'),
      ).toHaveLength(0);
      expect(url()).toBe('/calendrier/evenements/nouveau?mois=2026-09');
      expect(formulaire(harnais)).not.toBeNull();
      expect(champ<HTMLInputElement>(harnais, 'titre').value).toBe('Vaccin');
      racine(harnais).remove();
    });

    it('se préremplit depuis la requête, sans rien enregistrer', async () => {
      const startsAt = '2026-11-03T08:30:00.000Z';
      const endsAt = '2026-11-03T09:00:00.000Z';
      const harnais = await ouvrir(
        `/calendrier/evenements/nouveau?title=Vaccin&category=BIRTHDAY&startsAt=${startsAt}` +
          `&endsAt=${endsAt}&reminderLeadMinutes=60&scopeId=espace-foyer`,
      );

      expect(champ<HTMLInputElement>(harnais, 'titre').value).toBe('Vaccin');
      expect(segmentChoisi(harnais, 'categorie')).toBe('Anniversaire');
      expect(segmentChoisi(harnais, 'espace')).toBe('Foyer');
      expect(valeurAffichee(harnais.fixture, 'rappel')).toBe('1 heure avant');
      // Les champs saisissent en heure locale.
      expect(
        new Date(champ<HTMLInputElement>(harnais, 'debut').value).getTime(),
      ).toBe(new Date(startsAt).getTime());
      expect(
        new Date(champ<HTMLInputElement>(harnais, 'fin').value).getTime(),
      ).toBe(new Date(endsAt).getTime());
      expect(champ(harnais, 'ignores')).toBeNull();
    });

    it('signale ce que la requête apportait sans pouvoir le reprendre', async () => {
      const harnais = await ouvrir(
        '/calendrier/evenements/nouveau?title=Vaccin&category=FOO',
      );

      expect(texte(champ(harnais, 'ignores'))).toContain('category=FOO');
      expect(segmentChoisi(harnais, 'categorie')).toBe('Rendez-vous');
    });

    it("n'enregistre pas sans Espace : aucun n'est deviné sans pré-choix", async () => {
      const harnais = await ouvrir(
        '/calendrier/evenements/nouveau?title=Vaccin&startsAt=2026-11-03T08:30:00.000Z',
      );

      expect(segmentChoisi(harnais, 'espace')).toBe('');
      expect(bouton(harnais, "Créer l'événement").disabled).toBe(true);

      await choisirLeSegment(harnais, 'espace', 'Personne A');
      expect(bouton(harnais, "Créer l'événement").disabled).toBe(false);
    });

    it("reprend l'Espace pré-choisi dans la TopBar et le suit, jusqu'à un choix fait à la main", async () => {
      configurer(1280);
      const courant = TestBed.inject(EspaceCourant);
      courant.espaces.set(ESPACES);
      courant.choisir('espace-foyer');
      const harnais = await RouterTestingHarness.create();
      await harnais.navigateByUrl('/calendrier/evenements/nouveau');
      await laisserFiler();
      httpMock.expectOne(`${BASE}/espaces`).flush(ESPACES);
      lecture().flush(MOIS.map(enOccurrence));
      await harnais.fixture.whenStable();
      harnais.detectChanges();

      expect(segmentChoisi(harnais, 'espace')).toBe('Foyer');

      courant.choisir('espace-a');
      await laisserFiler();
      harnais.detectChanges();
      expect(segmentChoisi(harnais, 'espace')).toBe('Personne A');

      await choisirLeSegment(harnais, 'espace', 'Foyer');
      courant.choisir('espace-a');
      await laisserFiler();
      harnais.detectChanges();
      expect(segmentChoisi(harnais, 'espace')).toBe('Foyer');
    });

    it("crée l'Événement, relit le mois et referme le formulaire", async () => {
      const harnais = await ouvrir(
        '/calendrier/evenements/nouveau?mois=2026-09&title=Vaccin' +
          '&startsAt=2026-09-18T08:30:00.000Z&scopeId=espace-a',
      );

      await choisirDansLeSelect(harnais.fixture, 'rappel', '1 jour avant');
      await cliquer(harnais, bouton(harnais, "Créer l'événement"));

      const creation = httpMock.expectOne(
        ({ method, url }) => method === 'POST' && url === `${BASE}/events`,
      );
      expect(creation.request.body).toEqual({
        title: 'Vaccin',
        startsAt: '2026-09-18T08:30:00.000Z',
        endsAt: null,
        category: 'APPOINTMENT',
        reminderLeadMinutes: 1_440,
        scopeId: 'espace-a',
      });
      const vaccin: Event = {
        ...DENTISTE,
        id: 'event-4',
        title: 'Vaccin',
        startsAt: '2026-09-18T08:30:00.000Z',
      };
      creation.flush(vaccin);
      await relire(harnais, [...MOIS, vaccin]);

      expect(url()).toBe('/calendrier?mois=2026-09');
      expect(formulaire(harnais)).toBeNull();
      expect(texte(caseDu(harnais, 'vendredi 18 septembre 2026'))).toContain(
        'Vaccin',
      );
    });
  });

  describe("Les erreurs de l'API", () => {
    async function creerVaccin() {
      const harnais = await ouvrir(
        '/calendrier/evenements/nouveau?title=Vaccin' +
          '&startsAt=2026-09-18T08:30:00.000Z&scopeId=espace-a',
      );
      await cliquer(harnais, bouton(harnais, "Créer l'événement"));
      return harnais;
    }

    async function refuser(
      harnais: RouterTestingHarness,
      corps: unknown,
      status: number,
    ): Promise<void> {
      httpMock
        .expectOne(`${BASE}/events`)
        .flush(corps, { status, statusText: 'Refus' });
      await harnais.fixture.whenStable();
      harnais.detectChanges();
    }

    it("affiche l'erreur sous le champ qu'elle vise, et garde la saisie", async () => {
      const harnais = await creerVaccin();
      await refuser(
        harnais,
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

      expect(texte(champ(harnais, 'erreur-startsAt'))).toBe(
        'Le début doit être un instant ISO-8601.',
      );
      expect(champ(harnais, 'debut').getAttribute('aria-invalid')).toBe('true');
      expect(champ(harnais, 'erreur-title')).toBeNull();
      // Une erreur de champ n'a pas de bandeau : elle est sous son champ.
      expect(champ(harnais, 'refus')).toBeNull();
      expect(champ<HTMLInputElement>(harnais, 'titre').value).toBe('Vaccin');
      expect(url()).toContain('/calendrier/evenements/nouveau');
    });

    it("affiche en bandeau le message d'une règle métier", async () => {
      const harnais = await creerVaccin();
      await refuser(
        harnais,
        {
          status: 422,
          code: 'event.period_reversed',
          message: 'La fin ne peut pas précéder le début.',
        },
        422,
      );

      expect(texte(champ(harnais, 'refus'))).toContain(
        'La fin ne peut pas précéder le début.',
      );
    });
  });

  describe('Le formulaire de modification', () => {
    it("s'ouvre depuis la pastille, sur l'Événement qu'elle désigne", async () => {
      const harnais = await ouvrir('/calendrier');

      const [dentiste] = caseDu(
        harnais,
        'lundi 14 septembre 2026',
      ).querySelectorAll<HTMLElement>('a');
      await cliquer(harnais, dentiste);

      expect(url()).toBe(
        '/calendrier/evenements/event-1?mois=2026-09&occurrence=2026-09-14T09:30:00.000Z',
      );
      expect(texte(formulaire(harnais)?.querySelector('h2') ?? null)).toBe(
        "Modifier l'événement",
      );
      expect(champ<HTMLInputElement>(harnais, 'titre').value).toBe('Dentiste');
      expect(segmentChoisi(harnais, 'espace')).toBe('Personne A');
      expect(segmentChoisi(harnais, 'categorie')).toBe('Rendez-vous');
      expect(valeurAffichee(harnais.fixture, 'rappel')).toBe('Sans rappel');
    });

    it("garde l'Espace de l'Événement, quel que soit le pré-choix de la TopBar", async () => {
      configurer(1280);
      const courant = TestBed.inject(EspaceCourant);
      courant.espaces.set(ESPACES);
      courant.choisir('espace-foyer');
      const harnais = await RouterTestingHarness.create();
      await harnais.navigateByUrl(
        '/calendrier/evenements/event-1?mois=2026-09',
      );
      await laisserFiler();
      httpMock.expectOne(`${BASE}/espaces`).flush(ESPACES);
      lecture().flush(MOIS.map(enOccurrence));
      await harnais.fixture.whenStable();
      harnais.detectChanges();

      expect(segmentChoisi(harnais, 'espace')).toBe('Personne A');
    });

    it("n'envoie que les champs modifiés, puis relit le mois", async () => {
      const harnais = await ouvrir(
        '/calendrier/evenements/event-1?mois=2026-09&occurrence=2026-09-14T09:30:00.000Z',
      );

      saisir(harnais, 'titre', 'Détartrage');
      await choisirLeSegment(harnais, 'categorie', 'Autre');
      await cliquer(harnais, bouton(harnais, 'Enregistrer'));

      const modification = httpMock.expectOne(
        ({ method, url }) =>
          method === 'PATCH' && url === `${BASE}/events/event-1`,
      );
      expect(modification.request.body).toEqual({
        title: 'Détartrage',
        category: 'OTHER',
      });
      modification.flush({
        ...DENTISTE,
        title: 'Détartrage',
        category: 'OTHER',
      });
      await relire(harnais);

      expect(url()).toBe('/calendrier?mois=2026-09');
    });

    it("se referme sans rien envoyer quand rien n'a changé", async () => {
      const harnais = await ouvrir(
        '/calendrier/evenements/event-1?mois=2026-09',
      );

      await cliquer(harnais, bouton(harnais, 'Enregistrer'));

      expect(url()).toBe('/calendrier?mois=2026-09');
    });

    it("verrouille les horaires d'une occurrence de série, et ne les envoie jamais", async () => {
      const harnais = await ouvrir(
        '/calendrier/evenements/event-serie?mois=2026-09&occurrence=2026-09-14T16:00:00.000Z',
      );

      const debut = champ<HTMLInputElement>(harnais, 'debut');
      expect(debut.disabled).toBe(true);
      expect(new Date(debut.value).getTime()).toBe(
        new Date('2026-09-14T16:00:00.000Z').getTime(),
      );
      expect(champ(harnais, 'horaires-verrouilles')).not.toBeNull();

      saisir(harnais, 'titre', 'Piscine municipale');
      await cliquer(harnais, bouton(harnais, 'Enregistrer'));

      const modification = httpMock.expectOne(`${BASE}/events/event-serie`);
      expect(modification.request.body).toEqual({
        title: 'Piscine municipale',
      });
      modification.flush({ ...PISCINE, title: 'Piscine municipale' });
      await relire(harnais);
    });

    it("attend l'Événement : rien ne se saisit ni ne s'enregistre pendant la lecture", async () => {
      configurer(1280);
      const harnais = await RouterTestingHarness.create();
      await harnais.navigateByUrl(
        '/calendrier/evenements/event-1?mois=2026-09',
      );
      await laisserFiler();
      httpMock.expectOne(`${BASE}/espaces`).flush(ESPACES);
      harnais.detectChanges();

      expect(
        formulaire(harnais)
          ?.querySelector('dccm-state')
          ?.getAttribute('data-status'),
      ).toBe('loading');
      expect(champ(harnais, 'titre')).toBeNull();
      expect(bouton(harnais, 'Enregistrer').disabled).toBe(true);

      formulaire(harnais)?.querySelector('form')?.requestSubmit();
      await laisserFiler();
      httpMock.expectNone(({ method }) => method !== 'GET');

      lecture().flush(MOIS.map(enOccurrence));
      await harnais.fixture.whenStable();
      harnais.detectChanges();
      expect(champ<HTMLInputElement>(harnais, 'titre').value).toBe('Dentiste');
    });

    it("dit que l'Événement n'a pas pu être lu, sans jamais en créer un", async () => {
      configurer(1280);
      const harnais = await RouterTestingHarness.create();
      await harnais.navigateByUrl(
        '/calendrier/evenements/event-1?mois=2026-09',
      );
      await laisserFiler();
      httpMock.expectOne(`${BASE}/espaces`).flush(ESPACES);
      lecture().flush(
        {
          status: 503,
          code: 'database.unavailable',
          message: 'La base de données ne répond pas.',
        },
        { status: 503, statusText: 'Service Unavailable' },
      );
      await harnais.fixture.whenStable();
      harnais.detectChanges();

      const panneau = formulaire(harnais) as HTMLElement;
      expect(texte(panneau)).toContain('La base de données ne répond pas.');
      expect(champ(harnais, 'titre')).toBeNull();
      expect(bouton(harnais, 'Enregistrer').disabled).toBe(true);
      panneau.querySelector('form')?.requestSubmit();
      await laisserFiler();
      httpMock.expectNone(({ method }) => method !== 'GET');

      const reessayer = [...panneau.querySelectorAll('button')].find(
        (candidat) => texte(candidat) === 'Réessayer',
      ) as HTMLButtonElement;
      await cliquer(harnais, reessayer);
      await relire(harnais);
      expect(champ<HTMLInputElement>(harnais, 'titre').value).toBe('Dentiste');
    });

    it("revient au mois, sans un mot, quand l'Événement désigné n'y est pas", async () => {
      const harnais = await ouvrir(
        '/calendrier/evenements/inconnu?mois=2026-09',
      );
      await laisserFiler();
      harnais.detectChanges();

      expect(url()).toBe('/calendrier?mois=2026-09');
      expect(formulaire(harnais)).toBeNull();
    });
  });

  describe('La suppression', () => {
    const dialogue = () =>
      document.body.querySelector<HTMLElement>('[role="alertdialog"]');

    const boutonDuDialogue = (libelle: string) =>
      [
        ...(dialogue()?.querySelectorAll<HTMLButtonElement>('button') ?? []),
      ].find((candidat) => texte(candidat) === libelle) as HTMLButtonElement;

    async function demanderLaSuppression(harnais: RouterTestingHarness) {
      await cliquer(harnais, champ(harnais, 'supprimer'));
      await harnais.fixture.whenStable();
    }

    it("n'est offerte qu'en modification", async () => {
      const harnais = await ouvrir('/calendrier/evenements/nouveau');

      expect(champ(harnais, 'supprimer')).toBeNull();
    });

    it("demande confirmation, et n'envoie rien quand on annule", async () => {
      const harnais = await ouvrir(
        '/calendrier/evenements/event-1?mois=2026-09',
      );

      await demanderLaSuppression(harnais);
      expect(texte(dialogue())).toContain("Supprimer l'événement ?");
      expect(texte(dialogue())).toContain(
        '« Dentiste » sera supprimé du Calendrier.',
      );

      await cliquer(harnais, boutonDuDialogue('Annuler'));
      await harnais.fixture.whenStable();

      expect(url()).toBe('/calendrier/evenements/event-1?mois=2026-09');
    });

    it('supprime la série entière, une fois confirmée, puis relit le mois', async () => {
      const harnais = await ouvrir(
        '/calendrier/evenements/event-serie?mois=2026-09&occurrence=2026-09-14T16:00:00.000Z',
      );

      await demanderLaSuppression(harnais);
      expect(texte(dialogue())).toContain(
        '« Piscine » est une série : toutes ses occurrences seront supprimées.',
      );
      await cliquer(harnais, boutonDuDialogue("Supprimer l'événement"));

      httpMock
        .expectOne(
          ({ method, url }) =>
            method === 'DELETE' && url === `${BASE}/events/event-serie`,
        )
        .flush(null);
      await relire(harnais, [DENTISTE, IMPOTS]);

      expect(url()).toBe('/calendrier?mois=2026-09');
      expect(texte(racine(harnais))).not.toContain('Piscine');
    });
  });
});
