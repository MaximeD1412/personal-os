import { InteractivityChecker } from '@angular/cdk/a11y';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Component, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  Router,
  RouteReuseStrategy,
  RouterOutlet,
  type Routes,
} from '@angular/router';
import type { CommandResolution, Scope } from '@personal-os/contracts';
import { API_BASE_URL } from './api-base-url';
import { INTERCEPTEURS } from './app.config';
import { appRoutes } from './app.routes';
import { BarreDeCommande, ReutilisationDesEcrans } from './barre-de-commande';

const BASE = 'http://api.test/api';

// jsdom ne calcule aucune mise en page : le piège de focus du CDK n'y
// trouverait rien à focaliser.
const atteignable = (element: HTMLElement) =>
  element.tabIndex >= 0 && !(element as HTMLButtonElement).disabled;
const toujoursFocalisable: Partial<InteractivityChecker> = {
  isFocusable: atteignable,
  isTabbable: atteignable,
  isVisible: () => true,
  isDisabled: (element) => (element as HTMLButtonElement).disabled,
};

@Component({ template: '' })
class Ecran {}

/** L'écran ouvert et la barre, comme dans l'application. */
@Component({
  imports: [RouterOutlet, BarreDeCommande],
  template: '<router-outlet /><pos-barre-de-commande />',
})
class Racine {
  readonly barre = viewChild.required(BarreDeCommande);
}

const pause = () => new Promise((resolve) => setTimeout(resolve));

const ESPACES: Scope[] = [
  { id: 'espace-foyer', kind: 'HOUSEHOLD', label: 'Foyer' },
  { id: 'espace-a', kind: 'PERSONAL', label: 'Personne A' },
];

const ECRANS_FACTICES: Routes = [
  { path: 'agenda', component: Ecran },
  { path: 'calendrier/evenements/nouveau', component: Ecran },
];

async function monter({ routes = ECRANS_FACTICES, depart = '/agenda' } = {}) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      { provide: RouteReuseStrategy, useClass: ReutilisationDesEcrans },
      provideHttpClient(withInterceptors(INTERCEPTEURS)),
      provideHttpClientTesting(),
      { provide: API_BASE_URL, useValue: BASE },
      { provide: InteractivityChecker, useValue: toujoursFocalisable },
    ],
  });
  const router = TestBed.inject(Router);
  const httpMock = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(Racine);
  document.body.appendChild(fixture.nativeElement);
  await router.navigateByUrl(depart);

  // Laisse filer ce qui est en route (une navigation, une requête servie)
  // sans attendre la stabilité : une lecture en cours la retarderait jusqu'à
  // sa réponse.
  const stable = async () => {
    for (let tour = 0; tour < 3; tour++) {
      await pause();
      TestBed.tick();
    }
  };
  await stable();
  const palette = () =>
    document.querySelector<HTMLElement>('[data-slot="command-bar-palette"]');

  /** Ouvre la barre par Ctrl+K, écrit la phrase et l'envoie. */
  const commander = async (texte: string) => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
    );
    await stable();
    const champ = palette()?.querySelector('input') as HTMLInputElement;
    champ.value = texte;
    champ.dispatchEvent(new Event('input'));
    await stable();
    champ.form?.requestSubmit();
    await stable();
    const requete = httpMock.expectOne(`${BASE}/command-bar/resolve`);
    expect(requete.request.method).toBe('POST');
    expect(requete.request.body).toEqual({ text: texte });
    return requete;
  };

  const repondre = async (
    requete: ReturnType<HttpTestingController['expectOne']>,
    resolution: CommandResolution,
  ) => {
    requete.flush(resolution);
    await stable();
  };

  /** Les lectures de l'écran ouvert : les Espaces, et un mois vide. */
  const servirLesLectures = async () => {
    for (const demande of httpMock.match(({ method }) => method === 'GET')) {
      demande.flush(demande.request.url.endsWith('/espaces') ? ESPACES : []);
    }
    await stable();
  };

  return {
    fixture,
    router,
    httpMock,
    palette,
    commander,
    repondre,
    stable,
    servirLesLectures,
  };
}

const echap = () =>
  document
    .querySelector('[data-slot="command-bar-palette"] input')
    ?.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        keyCode: 27,
        bubbles: true,
      }),
    );

const titre = () =>
  document.querySelector<HTMLInputElement>('[data-test="titre"]')?.value;

afterEach(() => {
  document.body.innerHTML = '';
});

describe('BarreDeCommande', () => {
  it('ouvre le formulaire prérempli d’une intention connue, sans rien enregistrer', async () => {
    const { router, httpMock, palette, commander, repondre } = await monter();

    const requete = await commander('ajoute un dentiste jeudi à 9h30');
    await repondre(requete, {
      kind: 'action',
      url: '/calendrier/evenements/nouveau?title=Dentiste&startsAt=2026-11-05T08:30:00.000Z',
      ignored: [],
    });

    expect(router.url).toBe(
      '/calendrier/evenements/nouveau?title=Dentiste&startsAt=2026-11-05T08:30:00.000Z',
    );
    expect(palette()).toBeNull();
    // La résolution est la seule requête : rien n'est écrit.
    httpMock.verify();
  });

  it('dit franchement qu’elle ne sait pas, et propose l’écran le plus proche', async () => {
    const { router, httpMock, palette, commander, repondre } = await monter();

    const requete = await commander('quel temps fera-t-il demain ?');
    await repondre(requete, {
      kind: 'none',
      nearestUrl: '/calendrier/evenements/nouveau',
    });

    expect(router.url).toBe('/agenda');
    const statut = palette()?.querySelector('[role="status"]');
    expect(statut?.textContent).toContain('Je ne sais pas encore faire ça.');
    expect(statut?.querySelector('a')?.getAttribute('href')).toBe(
      '/calendrier/evenements/nouveau',
    );
    httpMock.verify();
  });

  it('affiche le message de l’API quand la résolution échoue', async () => {
    const { router, httpMock, palette, commander, stable } = await monter();

    const requete = await commander('ajoute un dentiste');
    requete.flush(
      {
        status: 422,
        code: 'ai.monthly_cap_reached',
        message: 'Le plafond mensuel de l’IA est atteint.',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await stable();

    expect(router.url).toBe('/agenda');
    expect(palette()?.querySelector('[role="alert"]')?.textContent).toContain(
      'Le plafond mensuel de l’IA est atteint.',
    );
    httpMock.verify();
  });

  it('repart vierge à la réouverture', async () => {
    const { fixture, httpMock, palette, commander, repondre, stable } =
      await monter();
    const requete = await commander('quel temps fera-t-il demain ?');
    await repondre(requete, { kind: 'none' });

    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        keyCode: 27,
        bubbles: true,
      }),
    );
    (palette()?.querySelector('input') as HTMLInputElement).dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        keyCode: 27,
        bubbles: true,
      }),
    );
    await stable();
    expect(palette()).toBeNull();

    fixture.componentInstance.barre().open();
    await stable();
    expect(
      palette()?.querySelector('[role="status"]')?.textContent?.trim(),
    ).toBe('');
    httpMock.verify();
  });

  it('abandonne la résolution dès que la barre commence à se fermer', async () => {
    const { router, httpMock, commander, stable } = await monter();
    const requete = await commander('ajoute un dentiste jeudi');

    // Échap pendant « Je cherche… », puis la réponse arrive pendant
    // l'animation de sortie, avant que la barre ait fini de se fermer.
    echap();
    if (!requete.cancelled) {
      requete.flush({
        kind: 'action',
        url: '/calendrier/evenements/nouveau?title=Dentiste',
        ignored: [],
      } satisfies CommandResolution);
    }
    await stable();

    expect(router.url).toBe('/agenda');
    httpMock.verify();
  });

  it('reste utilisable, rouverte avant la fin de sa fermeture', async () => {
    const { router, httpMock, palette, commander, repondre, stable } =
      await monter();
    await commander('ajoute un dentiste jeudi');

    // Échap pendant « Je cherche… », puis Ctrl+K avant la fin de l'animation
    // de sortie : la fermeture est annulée, la palette reste ouverte.
    echap();
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
    );
    await stable();
    expect(palette()).not.toBeNull();
    expect(
      palette()?.querySelector('[data-slot="command-bar-pending"]'),
    ).toBeNull();

    const champ = palette()?.querySelector('input') as HTMLInputElement;
    champ.value = 'ajoute un dentiste vendredi';
    champ.dispatchEvent(new Event('input'));
    await stable();
    champ.form?.requestSubmit();
    await stable();
    const requete = httpMock.expectOne(`${BASE}/command-bar/resolve`);
    expect(requete.request.body).toEqual({
      text: 'ajoute un dentiste vendredi',
    });

    await repondre(requete, {
      kind: 'action',
      url: '/calendrier/evenements/nouveau?title=Dentiste',
      ignored: [],
    });
    expect(router.url).toBe('/calendrier/evenements/nouveau?title=Dentiste');
    httpMock.verify();
  });

  describe('vers le formulaire d’un Événement', () => {
    const FORMULAIRE = '/calendrier/evenements/nouveau';

    it('repréremplit le formulaire déjà ouvert', async () => {
      const { httpMock, commander, repondre, servirLesLectures } = await monter(
        {
          routes: appRoutes,
          depart: `${FORMULAIRE}?title=Yoga`,
        },
      );
      await servirLesLectures();
      expect(titre()).toBe('Yoga');

      await repondre(await commander('ajoute un dentiste'), {
        kind: 'action',
        url: `${FORMULAIRE}?title=Dentiste`,
        ignored: [],
      });
      await servirLesLectures();

      expect(titre()).toBe('Dentiste');
      httpMock.verify();
    });

    it('rouvre l’écran prérempli quand la commande mène à la même adresse', async () => {
      const { httpMock, commander, repondre, stable, servirLesLectures } =
        await monter({
          routes: appRoutes,
          depart: `${FORMULAIRE}?title=Dentiste`,
        });
      await servirLesLectures();
      const champ = document.querySelector<HTMLInputElement>(
        '[data-test="titre"]',
      );
      (champ as HTMLInputElement).value = 'Dentiste du jeudi';
      champ?.dispatchEvent(new Event('input'));
      await stable();

      await repondre(await commander('ajoute un dentiste'), {
        kind: 'action',
        url: `${FORMULAIRE}?title=Dentiste`,
        ignored: [],
      });
      await servirLesLectures();

      expect(titre()).toBe('Dentiste');
      httpMock.verify();
    });

    it('signale les paramètres que le résolveur a écartés', async () => {
      const { router, httpMock, commander, repondre, servirLesLectures } =
        await monter({ routes: appRoutes, depart: '/calendrier' });
      await servirLesLectures();

      await repondre(await commander('ajoute du yoga tous les mardis'), {
        kind: 'action',
        url: `${FORMULAIRE}?title=Yoga`,
        ignored: ['recurrence'],
      });
      await servirLesLectures();

      expect(titre()).toBe('Yoga');
      expect(
        document.querySelector('[data-test="ignores"]')?.textContent,
      ).toContain('recurrence');
      expect(router.url).toBe(`${FORMULAIRE}?title=Yoga&ignored=recurrence`);
      httpMock.verify();
    });
  });
});
