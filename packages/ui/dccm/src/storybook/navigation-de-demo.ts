import {
  Component,
  inject,
  provideAppInitializer,
  type EnvironmentProviders,
  type Provider,
} from '@angular/core';
import {
  provideRouter,
  Router,
  withDisabledInitialNavigation,
  withHashLocation,
} from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import {
  matAccountBalanceWalletOutline,
  matApartmentOutline,
  matArticleOutline,
  matCalendarMonthOutline,
  matCalendarTodayOutline,
  matCalendarViewDayOutline,
  matCasesOutline,
  matCloudSyncOutline,
  matDashboardOutline,
  matFitnessCenterOutline,
  matFolderOutline,
  matHelpOutline,
  matHomeOutline,
  matHubOutline,
  matInventory2Outline,
  matMenuBookOutline,
  matMoreHorizOutline,
  matRestaurantOutline,
  matRocketLaunchOutline,
  matSettingsOutline,
  matShoppingCartOutline,
  matTerminalOutline,
} from '@ng-icons/material-symbols/outline';
import type { DccmNavEntry, DccmNavGroup } from '../nav-item/nav-item';

// La navigation des stories : celle du master `Sidebar`, sur un routeur qui
// accepte tous les chemins et part de l'Agenda. Hors du build de la
// bibliothèque (`tsconfig.lib.json`).

@Component({ template: '' })
class PageDeDemo {}

export const GROUPES_DE_DEMO: DccmNavGroup[] = [
  {
    label: 'Organisation',
    entries: [
      { label: 'Accueil', icon: 'matHomeOutline', link: '/' },
      { label: 'Agenda', icon: 'matCalendarViewDayOutline', link: '/agenda' },
      { label: 'Calendrier', icon: 'matCalendarMonthOutline', link: '/calendrier' },
      { label: 'Sport', icon: 'matFitnessCenterOutline', link: '/sport' },
    ],
  },
  {
    label: 'Cuisine & Nutrition',
    entries: [
      { label: 'Planning des repas', icon: 'matRestaurantOutline', link: '/repas/planning' },
      { label: 'Recettes', icon: 'matMenuBookOutline', link: '/repas/recettes' },
      { label: 'Stock', icon: 'matInventory2Outline', link: '/repas/stock' },
      { label: 'Courses', icon: 'matShoppingCartOutline', link: '/courses' },
    ],
  },
  {
    label: 'Gestion',
    entries: [
      { label: 'Finances', icon: 'matAccountBalanceWalletOutline' },
      { label: 'Documents', icon: 'matFolderOutline' },
      { label: 'Immobilier', icon: 'matApartmentOutline' },
    ],
  },
  {
    label: 'Professionnel',
    entries: [
      { label: 'Projets', icon: 'matRocketLaunchOutline', link: '/projets' },
      { label: 'Portfolio', icon: 'matCasesOutline', link: '/portfolio' },
      { label: 'Documentation', icon: 'matArticleOutline' },
    ],
  },
  {
    label: 'Système',
    entries: [
      { label: 'Sauvegardes', icon: 'matCloudSyncOutline', link: '/sauvegardes' },
      { label: 'Intégrations', icon: 'matHubOutline' },
      { label: 'Paramètres', icon: 'matSettingsOutline', link: '/foyer/preferences' },
    ],
  },
];

export const PIED_DE_DEMO: DccmNavEntry[] = [
  { label: 'Aide et support', icon: 'matHelpOutline' },
];

export const ONGLETS_DE_DEMO: DccmNavEntry[] = [
  { label: 'Accueil', icon: 'matDashboardOutline', link: '/' },
  { label: 'Agenda', icon: 'matCalendarTodayOutline', link: '/agenda' },
  { label: 'Sport', icon: 'matFitnessCenterOutline', link: '/sport' },
  { label: 'Repas', icon: 'matRestaurantOutline', link: '/repas/planning' },
];

/** Le routeur et les icônes des stories ; `url` est l'écran affiché. */
export function navigationDeDemo(
  url = '/agenda',
): (Provider | EnvironmentProviders)[] {
  return [
    provideRouter(
      [{ path: '**', component: PageDeDemo }],
      withHashLocation(),
      withDisabledInitialNavigation(),
    ),
    provideAppInitializer(() => {
      void inject(Router).navigateByUrl(url);
    }),
    provideIcons({
      matAccountBalanceWalletOutline,
      matApartmentOutline,
      matArticleOutline,
      matCalendarMonthOutline,
      matCalendarTodayOutline,
      matCalendarViewDayOutline,
      matCasesOutline,
      matCloudSyncOutline,
      matDashboardOutline,
      matFitnessCenterOutline,
      matFolderOutline,
      matHelpOutline,
      matHomeOutline,
      matHubOutline,
      matInventory2Outline,
      matMenuBookOutline,
      matMoreHorizOutline,
      matRestaurantOutline,
      matRocketLaunchOutline,
      matSettingsOutline,
      matShoppingCartOutline,
      matTerminalOutline,
    }),
  ];
}
