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
} from '@personal-os/contracts';
import { HlmBadge } from '@personal-os/ui/badge';
import { HlmButton } from '@personal-os/ui/button';
import { DccmPageHeader, DccmState, stateOf } from '@personal-os/ui/dccm';
import { AgendaService } from './agenda.service';
import { decaler, formaterJour } from './dates';
import { TEINTES, vueDEntree, type VueDEntree } from './entree-d-agenda';
import { Largeur, TABLETTE } from './largeur';
import { MODULES_D_ORIGINE } from './modules-d-origine';

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
   * Paris. L'API rend aussi celles qui ont commencé avant et sont encore en
   * cours : elles ouvrent le lundi, comme une suite. L'API rend déjà une suite
   * triée : l'ordre se garde.
   */
  protected readonly journees = computed((): Journee[] => {
    const lundi = this.semaine();
    const entrees = (this.lecture.hasValue() ? this.lecture.value() : []).map(
      (entree) => vueDEntree(entree, lundi),
    );

    return Array.from({ length: 7 }, (_, indice) => {
      const jour = decaler(lundi, indice);
      return {
        jour,
        estAujourdhui: jour === this.aujourdhui,
        entrees: entrees.filter((entree) => entree.jour === jour),
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
