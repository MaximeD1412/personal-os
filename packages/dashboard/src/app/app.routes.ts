import { Route } from '@angular/router';
import { Agenda } from './agenda';
import { Calendrier } from './calendrier';
import { FormulaireDEvenement } from './formulaire-d-evenement';

export const appRoutes: Route[] = [
  { path: '', pathMatch: 'full', redirectTo: 'agenda' },
  { path: 'agenda', component: Agenda },
  {
    path: 'calendrier',
    component: Calendrier,
    // Le formulaire d'un Événement, adressable et prérempli par sa requête
    // (ADR 0030), s'ouvre dans le Calendrier : le mois reste visible à côté.
    children: [
      {
        path: 'evenements/nouveau',
        component: FormulaireDEvenement,
        data: { creation: true },
      },
      { path: 'evenements/:id', component: FormulaireDEvenement },
    ],
  },
];
