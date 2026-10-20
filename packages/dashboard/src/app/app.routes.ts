import { Route } from '@angular/router';
import { Agenda } from './agenda';
import { Calendrier } from './calendrier';
import { FormulaireDEvenement } from './formulaire-d-evenement';
import { FormulaireDOccurrence } from './formulaire-d-occurrence';
import { FormulaireDePreference } from './foyer/preference-form';
import { Preferences } from './foyer/preferences';
import { FicheDIngredient } from './repas/ingredient-detail';
import { FormulaireDIngredient } from './repas/ingredient-form';
import { Ingredients } from './repas/ingredients';
import { FicheDeRecette } from './repas/recipe-detail';
import { Recettes } from './repas/recipes';

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
      // Une seule occurrence d'une série, par l'instant où la règle la place.
      {
        path: 'evenements/:id/occurrences/:originalStart',
        component: FormulaireDOccurrence,
      },
    ],
  },
  // Le catalogue d'Ingrédients, global au Foyer. Le formulaire de création est
  // adressable et prérempli par sa requête (ADR 0030) ; « nouveau » passe
  // avant l'identifiant.
  { path: 'repas/ingredients', component: Ingredients },
  { path: 'repas/ingredients/nouveau', component: FormulaireDIngredient },
  { path: 'repas/ingredients/:id', component: FicheDIngredient },
  { path: 'repas/ingredients/:id/modifier', component: FormulaireDIngredient },
  { path: 'repas/recettes', component: Recettes },
  // Le Planning de repas d'une semaine (`?semaine=`, son lundi) avec ses
  // Souhaits, et l'ajout d'un repas, prérempli par sa requête (ADR 0030).
  // Chargés à la demande, pour que le bundle initial tienne son budget.
  {
    path: 'repas/planning',
    loadComponent: async () =>
      (await import('./repas/planning')).PlanningDeRepas,
  },
  {
    path: 'repas/planning/nouveau',
    loadComponent: async () =>
      (await import('./repas/meal-plan-entry-form')).FormulaireDeRepas,
  },
  { path: 'repas/recettes/:id', component: FicheDeRecette },
  // Les Préférences alimentaires du Foyer, et l'ajout d'une Préférence,
  // prérempli par sa requête (ADR 0030).
  { path: 'foyer/preferences', component: Preferences },
  { path: 'foyer/preferences/nouvelle', component: FormulaireDePreference },
  // Les Projets de l'Espace personnel, chargés à la demande : le rendu du
  // markdown n'alourdit pas le bundle initial. Les formulaires sont
  // adressables et préremplis par leur requête (ADR 0030) ; « nouveau »
  // passe avant l'identifiant.
  {
    path: 'projets',
    loadComponent: async () => (await import('./projets/projects')).Projets,
  },
  {
    path: 'projets/nouveau',
    loadComponent: async () =>
      (await import('./projets/project-form')).FormulaireDeProjet,
  },
  {
    path: 'projets/:id',
    loadComponent: async () =>
      (await import('./projets/project-detail')).FicheDeProjet,
  },
  {
    path: 'projets/:id/modifier',
    loadComponent: async () =>
      (await import('./projets/project-form')).FormulaireDeProjet,
  },
  {
    path: 'projets/:id/depenses/nouvelle',
    loadComponent: async () =>
      (await import('./projets/expense-form')).FormulaireDeDepense,
  },
];
