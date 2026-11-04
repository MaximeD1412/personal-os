import { Component } from '@angular/core';
import type { Routes } from '@angular/router';
import type { DccmNavEntry } from '@personal-os/ui/dccm';
import { appRoutes } from './app.routes';
import { NAVIGATION, selonLesEcrans } from './navigation';

@Component({ template: '' })
class Ecran {}

const entree = (link?: string): DccmNavEntry => ({
  label: link ?? 'Sans chemin',
  icon: 'matHomeOutline',
  link,
});

const aVenir = (routes: Routes, link?: string) =>
  selonLesEcrans([entree(link)], routes)[0].comingSoon;

describe('selonLesEcrans', () => {
  it('rend active une entrée dont la route existe', () => {
    expect(aVenir([{ path: 'agenda', component: Ecran }], '/agenda')).toBe(
      false,
    );
  });

  it('annonce « À venir » une entrée sans route, ou sans chemin', () => {
    expect(aVenir([{ path: 'agenda', component: Ecran }], '/sport')).toBe(true);
    expect(aVenir([{ path: 'agenda', component: Ecran }])).toBe(true);
  });

  it("ne compte pas une redirection pour l'écran de l'entrée", () => {
    const routes: Routes = [
      { path: '', pathMatch: 'full', redirectTo: 'agenda' },
      { path: 'agenda', component: Ecran },
    ];

    expect(aVenir(routes, '/')).toBe(true);
  });

  it('suit les routes imbriquées et les écrans chargés à la demande', () => {
    const routes: Routes = [
      {
        path: 'foyer',
        children: [{ path: 'preferences', loadComponent: async () => Ecran }],
      },
    ];

    expect(aVenir(routes, '/foyer/preferences')).toBe(false);
    expect(aVenir(routes, '/foyer')).toBe(true);
  });

  it("ne devine pas les écrans d'un module chargé à la demande", () => {
    // Ses enfants ne sont connus qu'une fois chargé : « recettes » seule
    // n'y fait pas exister le planning ni le stock.
    const routes: Routes = [
      {
        path: 'repas',
        loadChildren: async () => [{ path: 'recettes', component: Ecran }],
      },
    ];

    expect(aVenir(routes, '/repas/recettes')).toBe(true);
    expect(aVenir(routes, '/repas/planning')).toBe(true);
    expect(aVenir(routes, '/repas/stock')).toBe(true);
  });

  it("ne prend ni la route attrape-tout ni un paramètre pour l'écran", () => {
    const routes: Routes = [
      { path: 'projets/:id', component: Ecran },
      { path: '**', component: Ecran },
    ];

    expect(aVenir(routes, '/projets')).toBe(true);
    expect(aVenir(routes, '/finances')).toBe(true);
  });
});

describe('appRoutes', () => {
  it('déclare chaque écran dans la configuration, sans module chargé à la demande', () => {
    // La navigation lit cette configuration pour activer ses entrées : un
    // écran caché derrière un `loadChildren` resterait « À venir ». Un écran
    // chargé à la demande se déclare ici, avec `loadComponent`.
    const sansLoadChildren = (routes: Routes): boolean =>
      routes.every(
        (route) =>
          !route.loadChildren && sansLoadChildren(route.children ?? []),
      );

    expect(sansLoadChildren(appRoutes)).toBe(true);
  });
});

describe('NAVIGATION', () => {
  it('suit les groupes du master Sidebar', () => {
    expect(NAVIGATION.map(({ label }) => label)).toEqual([
      'Organisation',
      'Cuisine & Nutrition',
      'Gestion',
      'Professionnel',
      'Système',
    ]);
  });
});
