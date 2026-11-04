import type { AgendaItem } from '@personal-os/contracts';
import type { BadgeTone } from '@personal-os/ui/badge';
import { formaterInstant, formaterJour, heureDe, jourDe } from './dates';
import {
  ICONE_INCONNUE,
  moduleDOrigine,
  type TonDePilier,
} from './modules-d-origine';

const STATUTS: Readonly<
  Record<AgendaItem['status'], { libelle: string; ton: BadgeTone }>
> = {
  PLANNED: { libelle: 'Prévu', ton: 'neutral' },
  DONE: { libelle: 'Réalisé', ton: 'success' },
  MISSED: { libelle: 'Manqué', ton: 'error' },
};

/** La couleur du pilier : le filet de la carte et l'icône de sa source. */
export const TEINTES: Readonly<
  Record<TonDePilier, { filet: string; encre: string }>
> = {
  primary: { filet: 'border-s-primary', encre: 'text-primary' },
  secondary: { filet: 'border-s-secondary', encre: 'text-secondary' },
  tertiary: { filet: 'border-s-tertiary', encre: 'text-tertiary' },
  outline: { filet: 'border-s-outline', encre: 'text-outline' },
};

/**
 * Une Entrée d'agenda telle qu'un écran la montre : l'Agenda de la semaine,
 * et les sept prochains jours de l'Accueil.
 */
export interface VueDEntree {
  cle: string;
  /**
   * Le jour où l'entrée se montre : celui où elle commence, ou le premier
   * jour affiché pour une entrée déjà en cours.
   */
  jour: string;
  /** L'heure de début, ou « depuis le … » pour une entrée déjà en cours. */
  heure: string;
  /**
   * L'horaire sur une ligne : « 14:30 – 15:15 » quand l'entrée finit le jour
   * où elle commence, l'heure seule sinon.
   */
  horaire: string;
  titre: string;
  /** La période, quand l'entrée a une fin : « 18:30 – 19:45 », « jusqu'au … ». */
  periode: string | null;
  statut: { libelle: string; ton: BadgeTone };
  source: string;
  icone: string;
  teinte: { filet: string; encre: string };
  lien: { chemin: string; parametres: Record<string, string> } | null;
}

/**
 * L'entrée, vue depuis une période qui commence `premierJour` : ce qui a
 * commencé avant s'y montre comme une suite, le premier jour.
 */
export function vueDEntree(
  entree: AgendaItem,
  premierJour: string,
): VueDEntree {
  const module = moduleDOrigine(entree);
  const debut = jourDe(entree.startsAt);
  const enCours = debut < premierJour;
  const heure = enCours
    ? `depuis le ${formaterJour(debut, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })}`
    : heureDe(entree.startsAt);
  const periode = periodeDe(entree);

  return {
    cle: `${entree.source}:${entree.sourceId}:${entree.startsAt}`,
    jour: enCours ? premierJour : debut,
    heure,
    horaire: !enCours && finitLeMemeJour(entree) ? (periode as string) : heure,
    titre: entree.title,
    periode,
    statut: STATUTS[entree.status],
    source: module?.libelle ?? entree.source,
    icone: module?.icone ?? ICONE_INCONNUE,
    teinte: TEINTES[module?.ton ?? 'outline'],
    lien: module?.lien(entree) ?? null,
  };
}

function periodeDe({ startsAt, endsAt }: AgendaItem): string | null {
  if (!endsAt) {
    return null;
  }

  if (finitLeMemeJour({ startsAt, endsAt })) {
    return `${heureDe(startsAt)} – ${heureDe(endsAt)}`;
  }

  return `jusqu'au ${formaterInstant(endsAt, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function finitLeMemeJour({
  startsAt,
  endsAt,
}: Pick<AgendaItem, 'startsAt' | 'endsAt'>): boolean {
  return endsAt !== null && jourDe(startsAt) === jourDe(endsAt);
}
