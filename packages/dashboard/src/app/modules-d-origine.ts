import {
  lundiDe,
  SOURCE_CALENDRIER,
  SOURCE_CUISINE,
  type AgendaItem,
} from '@personal-os/contracts';
import {
  matCalendarMonthOutline,
  matEventOutline,
  matRestaurantOutline,
} from '@ng-icons/material-symbols/outline';
import { jourDe } from './dates';
import { moisDe } from './mois';

/**
 * La couleur d'un pilier (docs/design-system.md, « Cartes et piliers ») :
 * Agenda `primary`, Sport `secondary`, Repas `tertiary`, le reste `outline`.
 */
export type TonDePilier = 'primary' | 'secondary' | 'tertiary' | 'outline';

/** Où mène une Entrée d'agenda, et sous quel nom son module se présente. */
export interface ModuleDOrigine {
  libelle: string;
  /** L'icône du pilier, en SVG (`ng-icon [svg]`). */
  icone: string;
  ton: TonDePilier;
  /** L'écran qui possède l'objet, et les paramètres qui l'y retrouvent. */
  lien(entree: AgendaItem): {
    chemin: string;
    parametres: Record<string, string>;
  };
}

/**
 * Le paramètre du mois que le Calendrier affiche. Le lien le porte : le
 * Calendrier ne lit qu'un mois à la fois, et l'Événement visé doit s'y trouver.
 */
export const PARAMETRE_DE_MOIS = 'mois';

/**
 * L'occurrence visée d'une série, par son identité : l'instant où la règle la
 * place (`originalStart`), qui ne bouge pas quand une exception la déplace.
 * C'est ce que portent les pastilles du Calendrier. Il est nommé ici plutôt
 * que dans le Calendrier, pour que le lien et l'écran qui le lit ne puissent
 * pas diverger.
 */
export const PARAMETRE_D_OCCURRENCE = 'occurrence';

/**
 * L'occurrence visée par son seul début affiché, faute de mieux : c'est tout
 * ce que l'Agenda en connaît, son contrat ne portant que la période d'une
 * entrée (ADR 0011). Deux occurrences d'une série au même instant y sont
 * indiscernables : le Calendrier demande alors laquelle est visée.
 */
export const PARAMETRE_DE_DEBUT = 'debut';

/**
 * Le registre du tableau de bord : par où l'on retourne au module qui possède
 * l'objet. C'est le pendant, côté écran, du registre de l'API — et il vit à
 * part pour la même raison : un module nouveau s'ajoute ici, jamais dans
 * l'Agenda lui-même.
 */
const MODULES: Readonly<Record<string, ModuleDOrigine>> = {
  [SOURCE_CALENDRIER]: {
    libelle: 'Calendrier',
    icone: matCalendarMonthOutline,
    ton: 'primary',
    lien: (entree) => ({
      chemin: `/calendrier/evenements/${entree.sourceId}`,
      parametres: {
        [PARAMETRE_DE_MOIS]: moisDe(entree.startsAt),
        [PARAMETRE_DE_DEBUT]: entree.startsAt,
      },
    }),
  },
  // Un Repas planifié se décide et se déplace dans le planning de sa semaine,
  // à Paris : c'est le seul écran qui le montre. Le paramètre est celui que
  // le planning lit (`PARAMETRE_DE_SEMAINE`), écrit ici pour ne pas tirer
  // l'écran, chargé à la demande, dans le bundle initial.
  [SOURCE_CUISINE]: {
    libelle: 'Repas',
    icone: matRestaurantOutline,
    ton: 'tertiary',
    lien: (entree) => ({
      chemin: '/repas/planning',
      parametres: { semaine: lundiDe(jourDe(entree.startsAt)) },
    }),
  },
};

/** Les modules connus, dans l'ordre de la légende de l'Agenda. */
export const MODULES_D_ORIGINE: readonly ModuleDOrigine[] =
  Object.values(MODULES);

/**
 * Une source absente n'est pas une erreur : l'entrée s'affiche, sans lien, sous
 * le nom de sa source. Un module peut très bien se présenter à l'Agenda de
 * l'API avant d'avoir son écran.
 */
export function moduleDOrigine(entree: AgendaItem): ModuleDOrigine | null {
  return moduleNomme(entree.source);
}

/**
 * Un module par son identifiant, celui que portent aussi ses Résumés et ses
 * À faire (`ModuleSummary.module`, `Todo.module`).
 */
export function moduleNomme(module: string): ModuleDOrigine | null {
  return MODULES[module] ?? null;
}

/** L'icône d'une entrée dont le module n'a pas encore d'écran. */
export const ICONE_INCONNUE = matEventOutline;
