import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import {
  matAddOutline,
  matFlagOutline,
} from '@ng-icons/material-symbols/outline';
import { aujourdhui, type TrainingGoal } from '@personal-os/contracts';
import { HlmBadge } from '@personal-os/ui/badge';
import { HlmButton } from '@personal-os/ui/button';
import { HlmCard } from '@personal-os/ui/card';
import {
  DccmListRow,
  DccmPageHeader,
  DccmState,
  stateOf,
} from '@personal-os/ui/dccm';
import { HlmProgress, HlmProgressIndicator } from '@personal-os/ui/progress';
import { formaterJour } from '../dates';
import { avancementDe, echeanceDe } from './avancement';
import { TrainingGoalService } from './training-goal.service';

/** Un Objectif, tel que la liste l'affiche. */
interface LigneDObjectif {
  objectif: TrainingGoal;
  meta: string;
  echeance: { libelle: string; passee: boolean };
  avancement: ReturnType<typeof avancementDe>;
}

/**
 * Les Objectifs du Compte, du plus proche au plus lointain : une course, une
 * date, une intention, et l'avancement des Séances qui y mènent (ADR 0022).
 * Chaque ligne ouvre l'Objectif.
 */
@Component({
  selector: 'pos-objectifs',
  templateUrl: './objectifs.html',
  imports: [
    RouterLink,
    NgIcon,
    HlmBadge,
    HlmButton,
    HlmCard,
    HlmProgress,
    HlmProgressIndicator,
    DccmListRow,
    DccmPageHeader,
    DccmState,
  ],
})
export class Objectifs {
  protected readonly icones = { ajouter: matAddOutline, vide: matFlagOutline };

  protected readonly lecture = inject(TrainingGoalService).lecture();
  protected readonly etat = computed(() =>
    stateOf(this.lecture, (objectifs) => objectifs.length === 0),
  );
  protected readonly lignes = computed<LigneDObjectif[]>(() => {
    const jour = aujourdhui();
    return (this.lecture.hasValue() ? this.lecture.value() : []).map(
      (objectif) => ({
        objectif,
        meta: [
          formaterJour(objectif.date, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }),
          objectif.intent,
        ]
          .filter(Boolean)
          .join(' · '),
        echeance: echeanceDe(objectif.date, jour),
        avancement: avancementDe(objectif.progress),
      }),
    );
  });
}
