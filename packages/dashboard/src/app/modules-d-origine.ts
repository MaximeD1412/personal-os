import { SOURCE_CALENDRIER, type AgendaItem } from '@personal-os/contracts';
import { moisDe } from './mois';

/** Où mène une Entrée d'agenda, et sous quel nom son module se présente. */
export interface ModuleDOrigine {
  /** Le chemin de l'écran qui possède l'objet. */
  chemin: string;
  /** Les paramètres par lesquels l'écran retrouve l'objet à ouvrir. */
  parametres(entree: AgendaItem): Record<string, string>;
  libelle: string;
}

/**
 * Le registre du tableau de bord : par où l'on retourne au module qui possède
 * l'objet. C'est le pendant, côté écran, du registre de l'API — et il vit à
 * part pour la même raison : un module nouveau s'ajoute ici, jamais dans
 * l'Agenda lui-même.
 *
 * Une source absente n'est pas une erreur : l'entrée s'affiche, sans lien. Un
 * module peut très bien se présenter à l'Agenda de l'API avant d'avoir son
 * écran.
 */
/**
 * Le paramètre par lequel le Calendrier reconnaît l'Événement à ouvrir. Il est
 * nommé ici plutôt que dans le Calendrier, pour que le lien et l'écran qui le
 * lit ne puissent pas diverger.
 */
export const PARAMETRE_D_EVENEMENT = 'evenement';

/**
 * Le paramètre du mois que le Calendrier affiche. Le lien le porte : le
 * Calendrier ne lit qu'un mois à la fois, et l'Événement visé doit s'y trouver.
 */
export const PARAMETRE_DE_MOIS = 'mois';

const MODULES: Readonly<Record<string, ModuleDOrigine>> = {
  [SOURCE_CALENDRIER]: {
    chemin: '/calendrier',
    parametres: (entree) => ({
      [PARAMETRE_D_EVENEMENT]: entree.sourceId,
      [PARAMETRE_DE_MOIS]: moisDe(entree.startsAt),
    }),
    libelle: 'Calendrier',
  },
};

export function moduleDOrigine(entree: AgendaItem): ModuleDOrigine | null {
  return MODULES[entree.source] ?? null;
}
