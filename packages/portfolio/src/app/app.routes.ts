import { inject } from '@angular/core';
import type { Route, UrlSegment } from '@angular/router';
import { Accueil } from './accueil';
import { Cadre } from './cadre';
import { ChoixDeLangue, estUneLangue } from './langue';
import { Projet } from './projet';

/** La racine, ou une URL inconnue : vers la langue choisie, sinon celle du navigateur. */
const versLaLangueInitiale = () => `/${inject(ChoixDeLangue).initiale()}`;

export const appRoutes: Route[] = [
  { path: '', pathMatch: 'full', redirectTo: versLaLangueInitiale },
  {
    path: ':lang',
    canMatch: [
      (_route: Route, segments: UrlSegment[]) =>
        estUneLangue(segments[0]?.path),
    ],
    component: Cadre,
    children: [
      { path: '', component: Accueil },
      { path: 'projets/:id', component: Projet },
    ],
  },
  { path: '**', redirectTo: versLaLangueInitiale },
];
