import { Route } from '@angular/router';
import { Agenda } from './agenda';
import { Calendrier } from './calendrier';
import { FicheDIngredient } from './repas/ingredient-detail';
import { FormulaireDIngredient } from './repas/ingredient-form';
import { Ingredients } from './repas/ingredients';

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
  // Le catalogue d'Ingrédients, global au Foyer. Le formulaire de création est
  // adressable et prérempli par sa requête (ADR 0030) ; « nouveau » passe
  // avant l'identifiant.
  { path: 'repas/ingredients', component: Ingredients },
  { path: 'repas/ingredients/nouveau', component: FormulaireDIngredient },
  { path: 'repas/ingredients/:id', component: FicheDIngredient },
  { path: 'repas/ingredients/:id/modifier', component: FormulaireDIngredient },
];
