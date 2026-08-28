import { SOURCE_CALENDRIER, type AgendaItem } from '@personal-os/contracts';

/** Où mène une Entrée d'agenda, et sous quel nom son module se présente. */
export interface ModuleDOrigine {
  /** Le chemin de l'écran qui possède l'objet. */
  chemin: string;
  /** Le paramètre par lequel l'écran reconnaît l'objet à ouvrir. */
  parametre: string;
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

const MODULES: Readonly<Record<string, ModuleDOrigine>> = {
  [SOURCE_CALENDRIER]: {
    chemin: '/calendrier',
    parametre: PARAMETRE_D_EVENEMENT,
    libelle: 'Calendrier',
  },
};

export function moduleDOrigine(entree: AgendaItem): ModuleDOrigine | null {
  return MODULES[entree.source] ?? null;
}
