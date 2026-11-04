import { Route } from '@angular/router';
import { Agenda } from './agenda';
import { Calendrier } from './calendrier';
import { FormulaireDEvenement } from './formulaire-d-evenement';
import { FormulaireDOccurrence } from './formulaire-d-occurrence';
import { FicheDIngredient } from './repas/ingredient-detail';
import { FormulaireDIngredient } from './repas/ingredient-form';
import { Ingredients } from './repas/ingredients';
import { Recettes } from './repas/recipes';

export const appRoutes: Route[] = [
  // L'Accueil : ce qui m'attend, les À faire et le résumé de chaque module.
  // Chargé à la demande, comme le planning, pour le budget du bundle initial.
  {
    path: '',
    pathMatch: 'full',
    loadComponent: async () => (await import('./accueil')).Accueil,
  },
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
  // La saisie d'une Recette, préremplie par sa requête (ADR 0030), chargée à
  // la demande ; « nouvelle » passe avant l'identifiant.
  {
    path: 'repas/recettes/nouvelle',
    loadComponent: async () =>
      (await import('./repas/recipe-form')).FormulaireDeRecette,
  },
  {
    path: 'repas/recettes/:id/modifier',
    loadComponent: async () =>
      (await import('./repas/recipe-form')).FormulaireDeRecette,
  },
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
  {
    path: 'repas/planning/generer',
    loadComponent: async () =>
      (await import('./repas/generation-form')).FormulaireDeGeneration,
  },
  // La Trace IA d'un Tour de génération, ouverte depuis le planning.
  {
    path: 'repas/generation/traces/:traceId',
    loadComponent: async () =>
      (await import('./repas/trace-de-generation')).TraceDeGeneration,
  },
  // La déclaration d'un Repas cuisiné (`?mealPlanEntryId=`), ouverte depuis
  // un repas approuvé du planning, et chargée à la demande comme lui.
  {
    path: 'repas/cuisine/nouveau',
    loadComponent: async () =>
      (await import('./repas/cooked-meal-form')).FormulaireDeRepasCuisine,
  },
  // La fiche d'une Recette, chargée à la demande, pour que le bundle initial
  // tienne son budget.
  {
    path: 'repas/recettes/:id',
    loadComponent: async () =>
      (await import('./repas/recipe-detail')).FicheDeRecette,
  },
  // Le Stock domestique, éditable en place ; l'ajout d'un Ingrédient est un
  // formulaire, prérempli par sa requête (ADR 0030). Chargés à la demande,
  // pour que le bundle initial tienne son budget.
  {
    path: 'repas/stock',
    loadComponent: async () => (await import('./repas/stock')).Stock,
  },
  {
    path: 'repas/stock/nouveau',
    loadComponent: async () =>
      (await import('./repas/stock-form')).FormulaireDeStock,
  },
  // La Liste de courses : la plus récente des listes ouvertes, ou une liste
  // donnée. Chargée à la demande, pour que le bundle initial tienne son budget.
  {
    path: 'courses',
    loadComponent: async () => (await import('./courses/courses')).Courses,
  },
  // L'ajout d'un Article à la liste ouverte, prérempli par sa requête : la
  // barre de commande y mène (ADR 0018).
  {
    path: 'courses/articles/nouveau',
    loadComponent: async () =>
      (await import('./courses/nouvel-article')).NouvelArticle,
  },
  {
    path: 'courses/:id',
    loadComponent: async () => (await import('./courses/courses')).Courses,
  },
  // Les Préférences alimentaires du Foyer, et l'ajout d'une Préférence,
  // prérempli par sa requête (ADR 0030). Chargées à la demande, comme les
  // Projets : le bundle initial reste sous son budget.
  {
    path: 'foyer/preferences',
    loadComponent: async () =>
      (await import('./foyer/preferences')).Preferences,
  },
  {
    path: 'foyer/preferences/nouvelle',
    loadComponent: async () =>
      (await import('./foyer/preference-form')).FormulaireDePreference,
  },
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
    path: 'projets/:id/presentation',
    loadComponent: async () =>
      (await import('./projets/project-presentation')).PresentationDuProjet,
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
  // Le CV du portfolio, un PDF par langue.
  {
    path: 'portfolio/cv',
    loadComponent: async () => (await import('./portfolio/cv')).CurriculumVitae,
  },
  // Les Pages de contenu du portfolio, chargées à la demande comme les
  // Projets : leur aperçu rend du markdown. Préremplies par leur requête
  // (ADR 0030).
  {
    path: 'portfolio/pages',
    loadComponent: async () =>
      (await import('./portfolio/pages')).PagesDuPortfolio,
  },
  // Les Séances, chargées à la demande pour que le bundle initial tienne son
  // budget.
  {
    path: 'sport',
    loadComponent: async () => (await import('./sport/sport')).Sport,
  },
  // Préremplie par sa requête (ADR 0030) ; déclarée avant `:id`, qu'elle
  // n'est pas.
  {
    path: 'sport/seances/nouvelle',
    loadComponent: async () =>
      (await import('./sport/nouvelle-seance')).NouvelleSeance,
  },
  // Les Objectifs et leurs séries ; `nouveau` est déclaré avant `:id`.
  {
    path: 'sport/objectifs',
    loadComponent: async () => (await import('./sport/objectifs')).Objectifs,
  },
  {
    path: 'sport/objectifs/nouveau',
    loadComponent: async () =>
      (await import('./sport/formulaire-d-objectif')).FormulaireDObjectif,
  },
  {
    path: 'sport/objectifs/:id/modifier',
    loadComponent: async () =>
      (await import('./sport/formulaire-d-objectif')).FormulaireDObjectif,
  },
  {
    path: 'sport/objectifs/:id/seances/nouvelles',
    loadComponent: async () =>
      (await import('./sport/nouvelle-serie')).NouvelleSerie,
  },
  {
    path: 'sport/objectifs/:id',
    loadComponent: async () => (await import('./sport/objectif')).Objectif,
  },
  {
    path: 'sport/seances/:id',
    loadComponent: async () => (await import('./sport/seance')).Seance,
  },
];
