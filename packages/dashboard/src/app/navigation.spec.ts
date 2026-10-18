import { Component } from '@angular/core';
import type { Routes } from '@angular/router';
import type { DccmNavEntry } from '@personal-os/ui/dccm';
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
      { path: 'repas', loadChildren: async () => [] },
    ];

    expect(aVenir(routes, '/foyer/preferences')).toBe(false);
    expect(aVenir(routes, '/foyer')).toBe(true);
    expect(aVenir(routes, '/repas/planning')).toBe(false);
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

describe('NAVIGATION', () => {
  it('suit les groupes du master Sidebar, sans le fil traceur', () => {
    expect(NAVIGATION.map(({ label }) => label)).toEqual([
      'Organisation',
      'Cuisine & Nutrition',
      'Gestion',
      'Professionnel',
      'Système',
    ]);
    expect(
      NAVIGATION.flatMap(({ entries }) => entries).map(({ label }) => label),
    ).not.toContain('Fil traceur');
  });
});
