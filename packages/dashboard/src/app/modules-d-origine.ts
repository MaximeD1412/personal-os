import { SOURCE_CALENDRIER, type AgendaItem } from '@personal-os/contracts';
import {
  matCalendarMonthOutline,
  matEventOutline,
} from '@ng-icons/material-symbols/outline';
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
 * L'occurrence visée d'une série, par son début : le Calendrier la reprend
 * plutôt que la première du mois. Il est nommé ici plutôt que dans le
 * Calendrier, pour que le lien et l'écran qui le lit ne puissent pas diverger.
 */
export const PARAMETRE_D_OCCURRENCE = 'occurrence';

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
        [PARAMETRE_D_OCCURRENCE]: entree.startsAt,
      },
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
  return MODULES[entree.source] ?? null;
}

/** L'icône d'une entrée dont le module n'a pas encore d'écran. */
export const ICONE_INCONNUE = matEventOutline;
