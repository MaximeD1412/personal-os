import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import {
  matArrowForwardOutline,
  matChevronLeftOutline,
  matChevronRightOutline,
  matEventBusyOutline,
} from '@ng-icons/material-symbols/outline';
import {
  aujourdhui,
  lundiDe,
  periodeDeLaSemaine,
  type AgendaItem,
} from '@personal-os/contracts';
import { HlmBadge, type BadgeTone } from '@personal-os/ui/badge';
import { HlmButton } from '@personal-os/ui/button';
import { DccmPageHeader, DccmState, stateOf } from '@personal-os/ui/dccm';
import { AgendaService } from './agenda.service';
import {
  decaler,
  formaterInstant,
  formaterJour,
  heureDe,
  jourDe,
} from './dates';
import { Largeur, TABLETTE } from './largeur';
import {
  ICONE_INCONNUE,
  MODULES_D_ORIGINE,
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
const TEINTES: Readonly<Record<TonDePilier, { filet: string; encre: string }>> =
  {
    primary: { filet: 'border-s-primary', encre: 'text-primary' },
    secondary: { filet: 'border-s-secondary', encre: 'text-secondary' },
    tertiary: { filet: 'border-s-tertiary', encre: 'text-tertiary' },
    outline: { filet: 'border-s-outline', encre: 'text-outline' },
  };

/** Une entrée telle que l'écran la montre. */
interface VueDEntree {
  cle: string;
  heure: string;
  titre: string;
  /** La période, quand l'entrée a une fin : « 18:30 – 19:45 », « jusqu'au … ». */
  periode: string | null;
  statut: { libelle: string; ton: BadgeTone };
  source: string;
  icone: string;
  teinte: { filet: string; encre: string };
  lien: { chemin: string; parametres: Record<string, string> } | null;
}

interface Journee {
  jour: string;
  estAujourdhui: boolean;
  entrees: VueDEntree[];
}

/**
 * L'Agenda : la vue en lecture seule qui fusionne, pour une semaine, les
 * objets datés des modules.
 *
 * Rien ne s'écrit ici, et c'est la décision : déplacer une Séance se fait dans
 * le module Sport (ADR 0011). Une entrée n'offre donc qu'un chemin — celui qui
 * ramène à son module d'origine.
 */
@Component({
  selector: 'pos-agenda',
  templateUrl: './agenda.html',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    NgIcon,
    HlmBadge,
    HlmButton,
    DccmPageHeader,
    DccmState,
  ],
})
export class Agenda {
  private readonly aujourdhui = aujourdhui();

  protected readonly large = inject(Largeur).auMoins(TABLETTE);

  /** Le lundi de la semaine affichée. */
  protected readonly semaine = signal(lundiDe(this.aujourdhui));

  protected readonly lecture = inject(AgendaService).lecture(() =>
    periodeDeLaSemaine(this.semaine()),
  );

  protected readonly etat = computed(() =>
    stateOf(this.lecture, (entrees) => entrees.length === 0),
  );

  protected readonly titre = computed(() => titreDeLaSemaine(this.semaine()));

  /**
   * Les sept jours de la semaine, chacun avec les entrées qui y commencent, à
   * Paris. L'API rend déjà une suite triée : l'ordre se garde.
   */
  protected readonly journees = computed((): Journee[] => {
    const entrees = this.lecture.hasValue() ? this.lecture.value() : [];

    return Array.from({ length: 7 }, (_, indice) => {
      const jour = decaler(this.semaine(), indice);
      return {
        jour,
        estAujourdhui: jour === this.aujourdhui,
        entrees: entrees
          .filter((entree) => jourDe(entree.startsAt) === jour)
          .map(vueDe),
      };
    });
  });

  /** Sous 768 px, seuls les jours qui portent quelque chose. */
  protected readonly journeesOccupees = computed(() =>
    this.journees().filter((journee) => journee.entrees.length > 0),
  );

  protected readonly legende = MODULES_D_ORIGINE.map((module) => ({
    libelle: module.libelle,
    icone: module.icone,
    encre: TEINTES[module.ton].encre,
  }));

  protected readonly icones = {
    precedente: matChevronLeftOutline,
    suivante: matChevronRightOutline,
    vide: matEventBusyOutline,
    ouvrir: matArrowForwardOutline,
  };

  protected readonly formaterJour = formaterJour;

  protected changerDeSemaine(sens: -1 | 1): void {
    this.semaine.update((lundi) => decaler(lundi, 7 * sens));
  }

  protected revenirAujourdhui(): void {
    this.semaine.set(lundiDe(this.aujourdhui));
  }

  protected nombreDEntrees(journee: Journee): string {
    const n = journee.entrees.length;
    return `${n} ${n > 1 ? 'entrées' : 'entrée'}`;
  }
}

function vueDe(entree: AgendaItem): VueDEntree {
  const module = moduleDOrigine(entree);

  return {
    cle: `${entree.source}:${entree.sourceId}:${entree.startsAt}`,
    heure: heureDe(entree.startsAt),
    titre: entree.title,
    periode: periodeDe(entree),
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

  if (jourDe(startsAt) === jourDe(endsAt)) {
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

/**
 * « Semaine du 14 au 20 septembre 2026 », et le mois ou l'année du lundi
 * quand la semaine les enjambe.
 */
function titreDeLaSemaine(lundi: string): string {
  const dimanche = decaler(lundi, 6);
  const memeAnnee = lundi.slice(0, 4) === dimanche.slice(0, 4);
  const memeMois = lundi.slice(0, 7) === dimanche.slice(0, 7);

  const debut = formaterJour(lundi, {
    day: 'numeric',
    ...(memeMois ? {} : { month: 'long' }),
    ...(memeAnnee ? {} : { year: 'numeric' }),
  });
  const fin = formaterJour(dimanche, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return `Semaine du ${debut} au ${fin}`;
}
