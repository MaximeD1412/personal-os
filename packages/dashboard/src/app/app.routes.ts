import { Route } from '@angular/router';
import { Agenda } from './agenda';
import { Calendrier } from './calendrier';
import { NouvelleSeance } from './sport/nouvelle-seance';
import { Seance } from './sport/seance';
import { Sport } from './sport/sport';
import { Traces } from './traces';

export const appRoutes: Route[] = [
  { path: '', pathMatch: 'full', redirectTo: 'agenda' },
  { path: 'agenda', component: Agenda },
  { path: 'calendrier', component: Calendrier },
  // Le formulaire de création, adressable et prérempli par sa requête
  // (ADR 0030). C'est le même écran, qui lit alors la requête.
  {
    path: 'calendrier/evenements/nouveau',
    component: Calendrier,
    data: { creation: true },
  },
  { path: 'sport', component: Sport },
  // Préremplie par sa requête (ADR 0030) ; déclarée avant `:id`, qu'elle
  // n'est pas.
  { path: 'sport/seances/nouvelle', component: NouvelleSeance },
  { path: 'sport/seances/:id', component: Seance },
  // Le fil traceur du cloisonnement (#6). Il quittera l'écran le jour où on
  // retirera l'entité jouet qui le porte.
  { path: 'fil-traceur', component: Traces },
];
