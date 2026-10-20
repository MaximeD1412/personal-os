import type { Route, Routes } from '@angular/router';
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
} from '@ng-icons/material-symbols/outline';
import type { DccmNavEntry, DccmNavGroup } from '@personal-os/ui/dccm';

/**
 * La navigation du tableau de bord, décrite une seule fois : la Sidebar, le
 * Rail et le panneau « Plus » la lisent.
 *
 * Une entrée sans chemin est hors V1 et reste « À venir ». Une entrée avec un
 * chemin s'active d'elle-même le jour où le ticket de son module ajoute la
 * route (`selonLesEcrans`) : rien n'est à changer ici.
 */
export const NAVIGATION: readonly DccmNavGroup[] = [
  {
    label: 'Organisation',
    entries: [
      { label: 'Accueil', icon: 'matHomeOutline', link: '/' },
      { label: 'Agenda', icon: 'matCalendarViewDayOutline', link: '/agenda' },
      {
        label: 'Calendrier',
        icon: 'matCalendarMonthOutline',
        link: '/calendrier',
      },
      { label: 'Sport', icon: 'matFitnessCenterOutline', link: '/sport' },
    ],
  },
  {
    label: 'Cuisine & Nutrition',
    entries: [
      {
        label: 'Planning des repas',
        icon: 'matRestaurantOutline',
        link: '/repas/planning',
      },
      {
        label: 'Recettes',
        icon: 'matMenuBookOutline',
        link: '/repas/recettes',
      },
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
      // Le CV est pour l'instant le seul écran du portfolio.
      { label: 'Portfolio', icon: 'matCasesOutline', link: '/portfolio/cv' },
      { label: 'Documentation', icon: 'matArticleOutline' },
    ],
  },
  {
    label: 'Système',
    entries: [
      // Aucun écran des sauvegardes n'est au backlog : l'état des
      // sauvegardes est un widget de l'accueil (DASH-3).
      { label: 'Sauvegardes', icon: 'matCloudSyncOutline' },
      { label: 'Intégrations', icon: 'matHubOutline' },
      {
        label: 'Paramètres',
        icon: 'matSettingsOutline',
        link: '/foyer/preferences',
      },
    ],
  },
];

/** Le pied de la Sidebar. */
export const PIED_DE_NAVIGATION: readonly DccmNavEntry[] = [
  { label: 'Aide et support', icon: 'matHelpOutline' },
];

/** Les quatre onglets de la barre mobile ; le cinquième, « Plus », ouvre le panneau. */
export const ONGLETS: readonly DccmNavEntry[] = [
  { label: 'Accueil', icon: 'matDashboardOutline', link: '/' },
  { label: 'Agenda', icon: 'matCalendarTodayOutline', link: '/agenda' },
  { label: 'Sport', icon: 'matFitnessCenterOutline', link: '/sport' },
  { label: 'Repas', icon: 'matRestaurantOutline', link: '/repas/planning' },
];

/** Les icônes que la navigation nomme, à fournir par `provideIcons`. */
export const ICONES_DE_NAVIGATION = {
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
};

/**
 * Les entrées telles que la configuration du routeur les permet : une entrée
 * dont l'écran n'a pas de route est « À venir ».
 *
 * Une route ne compte que si elle affiche un écran : une redirection seule
 * (`''` vers l'Agenda, en attendant l'Accueil) ne fait pas exister l'écran de
 * l'entrée, et la route attrape-tout ne fait pas exister tous les écrans. Les
 * enfants d'un module chargé à la demande (`loadChildren`) ne sont connus
 * qu'à son chargement : rien n'y est deviné, ses entrées restent « À venir ».
 * Un écran chargé à la demande se déclare donc dans `app.routes.ts`, avec
 * `loadComponent` (`navigation.spec.ts` le vérifie).
 */
export function selonLesEcrans(
  entrees: readonly DccmNavEntry[],
  routes: Routes,
): DccmNavEntry[] {
  return entrees.map((entree) => ({
    ...entree,
    comingSoon:
      entree.comingSoon ||
      !entree.link ||
      !aUnEcran(routes, segments(entree.link)),
  }));
}

/** Les groupes, chacun selon les écrans. */
export function groupesSelonLesEcrans(
  groupes: readonly DccmNavGroup[],
  routes: Routes,
): DccmNavGroup[] {
  return groupes.map((groupe) => ({
    ...groupe,
    entries: selonLesEcrans(groupe.entries, routes),
  }));
}

function segments(chemin: string): string[] {
  return chemin.split('/').filter(Boolean);
}

function aUnEcran(routes: Routes, cherches: string[]): boolean {
  return routes.some((route) => couvre(route, cherches));
}

function couvre(route: Route, cherches: string[]): boolean {
  if (route.path === undefined || route.path === '**') {
    return false;
  }

  const propres = segments(route.path);
  const debut = cherches.slice(0, propres.length);
  if (
    debut.length !== propres.length ||
    debut.some((segment, i) => segment !== propres[i])
  ) {
    return false;
  }

  const reste = cherches.slice(propres.length);
  if (reste.length === 0 && (route.component || route.loadComponent)) {
    return true;
  }
  return aUnEcran(route.children ?? [], reste);
}
