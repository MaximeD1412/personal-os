import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import {
  matAddOutline,
  matBoltOutline,
  matChevronLeftOutline,
  matChevronRightOutline,
  matFitnessCenterOutline,
  matNotesOutline,
} from '@ng-icons/material-symbols/outline';
import { periodeDeLaSemaine } from '@personal-os/contracts';
import { HlmBadge } from '@personal-os/ui/badge';
import { HlmButton } from '@personal-os/ui/button';
import { HlmCard } from '@personal-os/ui/card';
import { DccmPageHeader, DccmState, stateOf } from '@personal-os/ui/dccm';
import { map } from 'rxjs';
import {
  decalerLaSemaine,
  estUneSemaine,
  heureDe,
  jourDe,
  libelleDeLaSemaine,
  semaineCourante,
} from './semaine';
import { TrainingSessionService } from './training-session.service';
import { vueDeSeance } from './vue-de-seance';

/** Le paramètre du lien qui désigne la semaine affichée, par son lundi. */
export const PARAMETRE_DE_SEMAINE = 'semaine';

/**
 * Le Sport : les Séances d'une semaine, prévu et réalisé sur le même objet
 * (ADR 0022). Chaque carte lit l'écart champ par champ ; une Séance s'ouvre
 * pour être modifiée, marquée réalisée ou manquée.
 *
 * La semaine est celle du lien (`?semaine=2026-10-19`), sinon la semaine en
 * cours, à Paris. Un lien qui ne désigne pas un lundi ouvre la semaine en
 * cours.
 */
@Component({
  selector: 'pos-sport',
  templateUrl: './sport.html',
  imports: [
    RouterLink,
    NgIcon,
    HlmBadge,
    HlmButton,
    HlmCard,
    DccmPageHeader,
    DccmState,
  ],
})
export class Sport {
  private readonly api = inject(TrainingSessionService);

  protected readonly icones = {
    ajouter: matAddOutline,
    nonPlanifiee: matBoltOutline,
    precedente: matChevronLeftOutline,
    suivante: matChevronRightOutline,
    vide: matFitnessCenterOutline,
    notes: matNotesOutline,
  };

  protected readonly semaine = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(
      map((parametres) => {
        const demandee = parametres.get(PARAMETRE_DE_SEMAINE);
        return estUneSemaine(demandee) ? demandee : semaineCourante();
      }),
    ),
    { initialValue: semaineCourante() },
  );

  protected readonly libelle = computed(() =>
    libelleDeLaSemaine(this.semaine()),
  );
  protected readonly precedente = computed(() =>
    decalerLaSemaine(this.semaine(), -1),
  );
  protected readonly suivante = computed(() =>
    decalerLaSemaine(this.semaine(), 1),
  );
  protected readonly courante = semaineCourante();

  protected readonly lecture = this.api.lecture(() =>
    periodeDeLaSemaine(this.semaine()),
  );
  protected readonly etat = computed(() =>
    stateOf(this.lecture, (seances) => seances.length === 0),
  );
  protected readonly seances = computed(() =>
    (this.lecture.hasValue() ? this.lecture.value() : []).map(vueDeSeance),
  );

  protected readonly jourDe = jourDe;
  protected readonly heureDe = heureDe;
}
