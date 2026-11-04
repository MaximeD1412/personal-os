import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { AgendaItem, ModuleSummary, Todo } from '@personal-os/contracts';
import { fenetreDe } from '../testing/largeur';
import { Accueil } from './accueil';
import { API_BASE_URL } from './api-base-url';
import { INTERCEPTEURS } from './app.config';

const BASE = 'http://api.test/api';

/** Mercredi 16 septembre 2026, midi à Paris : les sept jours du 16 au 22. */
const MAINTENANT = new Date('2026-09-16T10:00:00.000Z');

/** Commencé la veille, encore en cours : l'API le rend, la période le rencontre. */
const SALON: AgendaItem = {
  source: 'calendar',
  sourceId: 'event-0',
  title: 'Salon du livre',
  startsAt: '2026-09-15T07:00:00.000Z',
  endsAt: '2026-09-17T16:00:00.000Z',
  status: 'PLANNED',
};

const DENTISTE: AgendaItem = {
  source: 'calendar',
  sourceId: 'event-1',
  title: 'Dentiste',
  startsAt: '2026-09-16T12:30:00.000Z',
  endsAt: '2026-09-16T13:15:00.000Z',
  status: 'PLANNED',
};

const DINER: AgendaItem = {
  source: 'food',
  sourceId: 'entry-1',
  title: 'Poulet basquaise',
  startsAt: '2026-09-21T17:30:00.000Z',
  endsAt: null,
  status: 'PLANNED',
};

const DECISIONS: Todo = {
  module: 'food',
  kind: 'food.meal_plan_pending_decisions',
  ref: 'plan-1',
  label: '3 repas attendent une décision',
  dueOn: '2026-09-17',
  link: '/repas/planning?semaine=2026-09-14',
};

const ECHEANCE: Todo = {
  module: 'calendar',
  kind: 'calendar.deadline_due',
  ref: 'event-9',
  label: 'Échéance : Taxe foncière',
  dueOn: '2026-09-18',
  link: '/calendrier/evenements/event-9?mois=2026-09',
};

const PERIME: Todo = {
  module: 'food',
  kind: 'food.pantry_item_expiring',
  ref: 'ingredient-1',
  label: 'Crème fraîche a périmé le 15 septembre',
  dueOn: '2026-09-15',
  link: '/repas/stock',
};

const COURSES: Todo = {
  module: 'food',
  kind: 'food.shopping_list_open',
  ref: 'list-1',
  label: 'Liste de courses en cours : 12 articles restants',
  link: '/courses/list-1',
};

const RESUMES: ModuleSummary[] = [
  { module: 'calendar', indicators: [], signals: [] },
  {
    module: 'food',
    indicators: [
      {
        key: 'shopping_list_remaining_items',
        label: 'Articles restants',
        value: 12,
      },
    ],
    signals: [],
  },
];

interface Reponses {
  agenda?: AgendaItem[];
  todos?: Todo[];
  summaries?: ModuleSummary[];
}

describe('Accueil', () => {
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
  });

  function creer(largeur = 1280): ComponentFixture<Accueil> {
    TestBed.configureTestingModule({
      imports: [Accueil],
      providers: [
        provideHttpClient(withInterceptors(INTERCEPTEURS)),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: BASE },
        fenetreDe(largeur),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Accueil);
    fixture.detectChanges();
    return fixture;
  }

  async function demarrer() {
    await new Promise((fin) => setTimeout(fin));
    TestBed.tick();
  }

  async function monter(
    {
      agenda = [SALON, DENTISTE, DINER],
      todos = [PERIME, DECISIONS, ECHEANCE, COURSES],
      summaries = RESUMES,
    }: Reponses = {},
    largeur = 1280,
  ) {
    const fixture = creer(largeur);
    await demarrer();
    demande('/agenda').flush(agenda);
    demande('/dashboard/todos').flush(todos);
    demande('/dashboard/summaries').flush(summaries);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  function demande(chemin: string): TestRequest {
    return httpMock.expectOne(
      ({ url, method }) => url === `${BASE}${chemin}` && method === 'GET',
    );
  }

  const racine = (fixture: ComponentFixture<Accueil>) =>
    fixture.nativeElement as HTMLElement;

  const tous = (fixture: ComponentFixture<Accueil>, nom: string) => [
    ...racine(fixture).querySelectorAll<HTMLElement>(`[data-test="${nom}"]`),
  ];

  const un = (fixture: ComponentFixture<Accueil>, nom: string) =>
    racine(fixture).querySelector(`[data-test="${nom}"]`) as HTMLElement;

  const texte = (element: Element | null | undefined) =>
    element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  describe('Les 7 prochains jours', () => {
    it("demande l'Agenda d'aujourd'hui à minuit jusqu'au soir du septième jour, à Paris", async () => {
      const fixture = creer();
      await demarrer();

      const requete = demande('/agenda');
      expect(requete.request.params.get('from')).toBe(
        '2026-09-15T22:00:00.000Z',
      );
      expect(requete.request.params.get('to')).toBe('2026-09-22T21:59:59.999Z');
      requete.flush([]);
      demande('/dashboard/todos').flush([]);
      demande('/dashboard/summaries').flush([]);
      await fixture.whenStable();
    });

    it('range les entrées par jour, aujourd’hui d’abord, en ne montrant que les jours occupés', async () => {
      const fixture = await monter();
      const jours = tous(fixture, 'jour');

      expect(jours.map((jour) => texte(jour.querySelector('h3')))).toEqual([
        "Aujourd'hui · mercredi 16 septembre",
        'lundi 21 septembre',
      ]);
      expect(texte(jours[0])).toContain('2 entrées');
      expect(texte(jours[1])).toContain('1 entrée');
    });

    it('montre aujourd’hui, comme une suite, une entrée commencée avant', async () => {
      const fixture = await monter();
      const [salon, dentiste] = tous(fixture, 'entree');

      expect(texte(salon)).toContain('Salon du livre');
      expect(texte(salon)).toContain('depuis le mar. 15 sept.');
      expect(texte(dentiste)).toContain('Dentiste');
      expect(texte(dentiste)).toContain('14:30 – 15:15');
    });

    it('mène chaque entrée à son module', async () => {
      const fixture = await monter();
      const [, dentiste, diner] = tous(fixture, 'entree');

      expect(dentiste.tagName).toBe('A');
      expect(dentiste.getAttribute('href')).toBe(
        '/calendrier/evenements/event-1?mois=2026-09&debut=2026-09-16T12:30:00.000Z',
      );
      expect(diner.getAttribute('href')).toBe(
        '/repas/planning?semaine=2026-09-21',
      );
    });

    it("montre sans lien l'entrée d'un module qui n'a pas d'écran", async () => {
      const seance: AgendaItem = { ...DENTISTE, source: 'sport' };
      const fixture = await monter({ agenda: [seance] });
      const [entree] = tous(fixture, 'entree');

      expect(entree.tagName).not.toBe('A');
      expect(entree.querySelector('a')).toBeNull();
      expect(texte(entree)).toContain('sport');
    });

    it('marque les sept jours dans le bandeau, et ceux qui portent quelque chose', async () => {
      const fixture = await monter();
      const jours = tous(fixture, 'bandeau-jour');

      expect(jours).toHaveLength(7);
      expect(jours[0].getAttribute('aria-current')).toBe('date');
      expect(jours.map((jour) => jour.getAttribute('aria-label'))).toEqual([
        "mercredi 16 septembre, aujourd'hui : 2 entrées",
        'jeudi 17 septembre : aucune entrée',
        'vendredi 18 septembre : aucune entrée',
        'samedi 19 septembre : aucune entrée',
        'dimanche 20 septembre : aucune entrée',
        'lundi 21 septembre : 1 entrée',
        'mardi 22 septembre : aucune entrée',
      ]);
    });

    it("mène à l'Agenda complet", async () => {
      const lien = un(await monter(), 'voir-agenda');

      expect(lien.getAttribute('href')).toBe('/agenda');
    });

    it('dit quand rien n’est daté sur les sept jours', async () => {
      const fixture = await monter({ agenda: [] });

      expect(texte(un(fixture, 'sept-jours'))).toContain(
        'Rien de daté sur les sept prochains jours',
      );
    });
  });

  describe('Les À faire', () => {
    it("les montre dans l'ordre de l'API, chacun avec son module", async () => {
      const fixture = await monter();
      const lignes = tous(fixture, 'a-faire');

      expect(lignes.map(texte)).toEqual([
        expect.stringContaining('Crème fraîche a périmé le 15 septembre'),
        expect.stringContaining('3 repas attendent une décision'),
        expect.stringContaining('Échéance : Taxe foncière'),
        expect.stringContaining(
          'Liste de courses en cours : 12 articles restants',
        ),
      ]);
      expect(texte(lignes[1])).toContain('Repas');
      expect(texte(lignes[2])).toContain('Calendrier');
      expect(texte(un(fixture, 'nombre-a-faire'))).toBe('4');
    });

    it("mène chacun à l'écran qui le résout, requête comprise", async () => {
      const fixture = await monter();

      expect(
        tous(fixture, 'a-faire').map((ligne) => [
          ligne.tagName,
          ligne.getAttribute('href'),
        ]),
      ).toEqual([
        ['A', '/repas/stock'],
        ['A', '/repas/planning?semaine=2026-09-14'],
        ['A', '/calendrier/evenements/event-9?mois=2026-09'],
        ['A', '/courses/list-1'],
      ]);
    });

    it('dit pour quand : en retard, demain, dans quelques jours, rien sans échéance', async () => {
      const fixture = await monter();
      const echeances = tous(fixture, 'a-faire').map((ligne) =>
        texte(ligne.querySelector('[data-test="echeance"]')),
      );

      expect(echeances).toEqual(['Depuis le 15 sept.', 'Demain', 'J-2', '']);
    });

    it('nomme un module inconnu par son identifiant, et le mène quand même', async () => {
      const seance: Todo = {
        module: 'sport',
        kind: 'sport.session_missed',
        ref: 'seance-1',
        label: 'Séance manquée',
        link: '/sport/seances/seance-1',
      };
      const fixture = await monter({ todos: [seance] });
      const [ligne] = tous(fixture, 'a-faire');

      expect(texte(ligne)).toContain('sport');
      expect(ligne.getAttribute('href')).toBe('/sport/seances/seance-1');
    });

    it('dit quand rien ne requiert l’attention', async () => {
      const fixture = await monter({ todos: [] });

      expect(texte(un(fixture, 'carte-a-faire'))).toContain(
        'Rien ne requiert ton attention',
      );
      expect(un(fixture, 'nombre-a-faire')).toBeNull();
    });

    it("affiche le message de l'API quand la lecture échoue", async () => {
      const fixture = creer();
      await demarrer();
      demande('/agenda').flush([]);
      demande('/dashboard/summaries').flush([]);
      demande('/dashboard/todos').flush(
        {
          status: 500,
          code: 'internal',
          message: 'Le tableau de bord est indisponible.',
        },
        { status: 500, statusText: 'Internal Server Error' },
      );
      await fixture.whenStable();
      fixture.detectChanges();

      expect(texte(un(fixture, 'carte-a-faire'))).toContain(
        'Le tableau de bord est indisponible.',
      );
    });
  });

  describe('Les widgets de résumé', () => {
    it('montre chaque indicateur en tuile, menant à son module', async () => {
      const fixture = await monter();
      const [courses] = tous(fixture, 'tuile');

      expect(tous(fixture, 'tuile')).toHaveLength(1);
      expect(courses.tagName).toBe('A');
      expect(courses.getAttribute('href')).toBe('/courses');
      expect(texte(courses)).toContain('Courses');
      expect(texte(courses)).toContain('12');
      expect(texte(courses)).toContain('Articles restants');
      expect(texte(courses)).toContain('Voir la liste');
    });

    it("montre sans lien l'indicateur que l'écran ne connaît pas, sous le nom de son module", async () => {
      const fixture = await monter({
        summaries: [
          {
            module: 'sport',
            indicators: [
              { key: 'sessions_done', label: 'Séances faites', value: '3 / 4' },
            ],
            signals: [],
          },
        ],
      });
      const [tuile] = tous(fixture, 'tuile');

      expect(tuile.tagName).not.toBe('A');
      expect(texte(tuile)).toContain('sport');
      expect(texte(tuile)).toContain('3 / 4');
      expect(texte(tuile)).toContain('Séances faites');
    });

    describe('les sauvegardes', () => {
      const sauvegardes = (
        signals: ModuleSummary['signals'],
      ): ModuleSummary => ({
        module: 'backup',
        indicators: [
          {
            key: 'backup_last_success',
            label: 'Dernière sauvegarde réussie',
            value: '2026-09-16T01:41:00.000Z',
          },
        ],
        signals,
      });

      it('montre la date de la dernière sauvegarde réussie, à Paris, et la dit à jour', async () => {
        const fixture = await monter({ summaries: [sauvegardes([])] });
        const [tuile] = tous(fixture, 'tuile');

        expect(texte(tuile)).toContain('Sauvegardes');
        expect(texte(tuile)).toContain('16 sept., 03:41');
        expect(texte(tuile)).toContain('Dernière sauvegarde réussie');
        expect(texte(un(fixture, 'statut-tuile'))).toBe('À jour');
        expect(un(fixture, 'statut-tuile').getAttribute('data-tone')).toBe(
          'success',
        );
      });

      it('la dit en retard quand le module le signale', async () => {
        const fixture = await monter({
          summaries: [
            sauvegardes([
              {
                kind: 'backup.stale',
                ref: 'backup-status',
                label: 'Dernière sauvegarde réussie il y a plus de 26 heures',
                dueOn: '2026-09-16',
                link: '/',
              },
            ]),
          ],
        });

        expect(texte(un(fixture, 'statut-tuile'))).toBe('En retard');
        expect(un(fixture, 'statut-tuile').getAttribute('data-tone')).toBe(
          'error',
        );
      });

      it('nomme le module en français dans les À faire', async () => {
        const fixture = await monter({
          todos: [
            {
              module: 'backup',
              kind: 'backup.stale',
              ref: 'backup-status',
              label: "Aucune sauvegarde réussie n'a été reçue",
              link: '/',
            },
          ],
        });
        const [todo] = tous(fixture, 'a-faire');

        expect(texte(todo)).toContain(
          "Aucune sauvegarde réussie n'a été reçue",
        );
        expect(texte(todo)).toContain('Sauvegardes');
        expect(texte(todo)).not.toContain('backup');
      });
    });

    it("dit quand aucun module n'a d'indicateur", async () => {
      const fixture = await monter({
        summaries: [{ module: 'calendar', indicators: [], signals: [] }],
      });

      expect(texte(un(fixture, 'indicateurs'))).toContain('Aucun indicateur');
    });
  });

  it("n'offre aucun geste d'écriture : tout y est un lien", async () => {
    const fixture = await monter();

    expect(racine(fixture).querySelector('button')).toBeNull();
    expect(racine(fixture).querySelector('input')).toBeNull();
    expect(racine(fixture).querySelector('form')).toBeNull();
  });
});
