import { Route } from '@angular/router';
import { Agenda } from './agenda';
import { Calendrier } from './calendrier';
import { FormulaireDEvenement } from './formulaire-d-evenement';
import { FicheDIngredient } from './repas/ingredient-detail';
import { FormulaireDIngredient } from './repas/ingredient-form';
import { Ingredients } from './repas/ingredients';

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
  // Le catalogue d'Ingrédients, global au Foyer. Le formulaire de création est
  // adressable et prérempli par sa requête (ADR 0030) ; « nouveau » passe
  // avant l'identifiant.
  { path: 'repas/ingredients', component: Ingredients },
  { path: 'repas/ingredients/nouveau', component: FormulaireDIngredient },
  { path: 'repas/ingredients/:id', component: FicheDIngredient },
  { path: 'repas/ingredients/:id/modifier', component: FormulaireDIngredient },
];
