import { calendar } from './calendar';
import { food } from './food';
import { ai, commandBar, portfolio } from './modules-without-data';
import { projects } from './projects';
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
];
