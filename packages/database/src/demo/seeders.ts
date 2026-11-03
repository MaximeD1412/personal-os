import { calendar } from './calendar';
import type { Semeur } from './seeder';
import { traces } from './traces';

/**
 * Les semeurs, un par module, dans l'ordre où ils sèment. Un module qui
 * dépend des données d'un autre (une Liste de courses issue du Planning de
 * repas) vient après lui ; le vidage, lui, parcourt la liste à l'envers.
 */
export const SEMEURS: readonly Semeur[] = [traces, calendar];
