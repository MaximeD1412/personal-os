import { DOCUMENT, inject, Injectable } from '@angular/core';
import type { Lang } from '@personal-os/contracts';

/** La langue du portfolio, telle qu'elle s'écrit dans ses URL : `/fr/…`, `/en/…`. */
export type Langue = 'fr' | 'en';

export const LANGUES: readonly Langue[] = ['fr', 'en'];

/**
 * La langue d'un visiteur dont le navigateur ne demande ni le français, ni
 * l'anglais : l'anglais, la langue que lit le plus de visiteurs étrangers.
 */
export const LANGUE_PAR_DEFAUT: Langue = 'en';

const CLE = 'portfolio.langue';

export function estUneLangue(valeur: unknown): valeur is Langue {
  return LANGUES.includes(valeur as Langue);
}

/** La langue de l'API : `FR`, `EN`. */
export function versLang(langue: Langue): Lang {
  return langue === 'fr' ? 'FR' : 'EN';
}

/**
 * La première langue du portfolio parmi celles du navigateur, dans son ordre
 * de préférence : `navigator.languages` est l'`Accept-Language` qu'il envoie.
 * `fr-CA` compte pour `fr` ; aucune géolocalisation n'entre en jeu.
 */
export function langueDuNavigateur(
  preferences: readonly string[],
): Langue | null {
  for (const preference of preferences) {
    const principale = preference.split('-')[0]?.toLowerCase();
    if (estUneLangue(principale)) {
      return principale;
    }
  }
  return null;
}

/**
 * Le choix de langue du visiteur, retenu dans `localStorage`. Le stockage
 * peut refuser de servir (navigation privée, cookies bloqués, quota) : le
 * portfolio suit alors le navigateur, et le sélecteur change la langue sans
 * la retenir.
 */
@Injectable({ providedIn: 'root' })
export class ChoixDeLangue {
  private readonly fenetre = inject(DOCUMENT).defaultView;

  /** La langue à l'arrivée sur la racine du site. */
  initiale(): Langue {
    return (
      this.memorisee() ??
      langueDuNavigateur(this.preferencesDuNavigateur()) ??
      LANGUE_PAR_DEFAUT
    );
  }

  memoriser(langue: Langue): void {
    try {
      this.fenetre?.localStorage.setItem(CLE, langue);
    } catch {
      // Le choix vaut pour cette visite seulement.
    }
  }

  private memorisee(): Langue | null {
    try {
      const valeur = this.fenetre?.localStorage.getItem(CLE);
      return estUneLangue(valeur) ? valeur : null;
    } catch {
      return null;
    }
  }

  private preferencesDuNavigateur(): readonly string[] {
    const navigateur = this.fenetre?.navigator;
    if (!navigateur) {
      return [];
    }
    return navigateur.languages?.length
      ? navigateur.languages
      : [navigateur.language];
  }
}
