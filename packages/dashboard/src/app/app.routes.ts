import { Route } from '@angular/router';
import { Agenda } from './agenda';
import { Calendrier } from './calendrier';
import { Traces } from './traces';

export const appRoutes: Route[] = [
  { path: '', pathMatch: 'full', redirectTo: 'agenda' },
  { path: 'agenda', component: Agenda },
  { path: 'calendrier', component: Calendrier },
  // Le fil traceur du cloisonnement (#6). Il quittera l'écran le jour où on
  // retirera l'entité jouet qui le porte.
  { path: 'fil-traceur', component: Traces },
];
