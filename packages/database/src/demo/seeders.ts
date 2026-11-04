import { backup } from './backup';
import { calendar } from './calendar';
import { food } from './food';
import { ai, commandBar, portfolio } from './modules-without-data';
import { projects } from './projects';
import { training } from './training';
import type { Prisma } from '../generated/prisma/client';
import type { Semeur } from './seeder';

/**
 * Les semeurs, un par module, dans l'ordre où ils sèment. Un module qui
 * dépend des données d'un autre (une Liste de courses issue du Planning de
 * repas) vient après lui ; le vidage, lui, parcourt la liste à l'envers. Un
 * Tour de génération cite sa Trace IA : `ai` passe avant `food`.
 */
export const SEMEURS: readonly Semeur[] = [
  calendar,
  ai,
  commandBar,
  food,
  projects,
  portfolio,
  training,
  backup,
];

/**
 * Les seuls modèles que le semis ne vide pas : le Foyer, ses Espaces, les
 * Comptes et leurs Sessions, que les Comptes réels gardent d'un déploiement à
 * l'autre, et la sonde de santé. Tout autre modèle, cloisonné ou global (le
 * catalogue d'Ingrédients, les Pages de contenu), appartient à un semeur.
 */
export const HORS_DU_JEU: readonly Prisma.ModelName[] = [
  'HealthProbe',
  'Household',
  'Scope',
  'User',
  'Session',
  'LoginTransaction',
];
