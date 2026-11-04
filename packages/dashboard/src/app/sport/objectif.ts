import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import {
  matAddOutline,
  matDeleteOutline,
  matEditOutline,
  matEventRepeatOutline,
  matFlagOutline,
} from '@ng-icons/material-symbols/outline';
import { aujourdhui, type ApiError } from '@personal-os/contracts';
import { HlmAlertImports } from '@personal-os/ui/alert';
import { HlmBadge } from '@personal-os/ui/badge';
import { HlmButton } from '@personal-os/ui/button';
import { HlmCardImports } from '@personal-os/ui/card';
import {
  DccmConfirm,
  DccmListRow,
  DccmPageHeader,
  DccmState,
  stateOf,
} from '@personal-os/ui/dccm';
import { HlmProgressImports } from '@personal-os/ui/progress';
import { showToast } from '@personal-os/ui/sonner';
import { map } from 'rxjs';
import { formaterInstant, formaterJour } from '../dates';
import { avancementDe, echeanceDe } from './avancement';
import { heureDe } from './semaine';
import { TrainingGoalService } from './training-goal.service';
import { vueDeSeance } from './vue-de-seance';

/**
 * Un Objectif : sa course, son jour, son intention, et l'avancement des
 * Séances qui y mènent (faites, manquées, à venir), lu sur les Séances liées
 * sans rien stocker de plus (ADR 0022). Chaque Séance s'ouvre pour être
 * modifiée ou marquée ; la série en crée d'autres, prévues.
 *
 * Supprimer l'Objectif se confirme : ses Séances restent, sans lien.
 */
@Component({
  selector: 'pos-objectif',
  templateUrl: './objectif.html',
  imports: [
    RouterLink,
    NgIcon,
    HlmAlertImports,
    HlmBadge,
    HlmButton,
    HlmCardImports,
    HlmProgressImports,
    DccmListRow,
    DccmPageHeader,
    DccmState,
  ],
})
export class Objectif {
  private readonly api = inject(TrainingGoalService);
  private readonly router = inject(Router);
  private readonly confirmation = inject(DccmConfirm);

  protected readonly icones = {
    ajouter: matAddOutline,
    modifier: matEditOutline,
    serie: matEventRepeatOutline,
    supprimer: matDeleteOutline,
    objectif: matFlagOutline,
  };

  protected readonly id = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('id') ?? '')),
    { initialValue: '' },
  );
  protected readonly lecture = this.api.lectureDe(this.id);
  protected readonly lectureDesSeances = this.api.lectureDesSeances(this.id);
  protected readonly etat = computed(() => stateOf(this.lecture, () => false));
  protected readonly etatDesSeances = computed(() =>
    stateOf(this.lectureDesSeances, (seances) => seances.length === 0),
  );

  protected readonly objectif = computed(() =>
    this.lecture.hasValue() ? this.lecture.value() : undefined,
  );
  protected readonly titre = computed(
    () => this.objectif()?.title ?? 'Objectif',
  );
  protected readonly sousTitre = computed(() => {
    const objectif = this.objectif();
    if (!objectif) {
      return undefined;
    }
    const jour = formaterJour(objectif.date, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return `${jour} · ${echeanceDe(objectif.date, aujourdhui()).libelle}`;
  });
  protected readonly fil = computed(() => [
    { label: 'Sport', link: '/sport' },
    { label: 'Objectifs', link: '/sport/objectifs' },
    { label: this.titre() },
  ]);
  protected readonly avancement = computed(() => {
    const objectif = this.objectif();
    return objectif ? avancementDe(objectif.progress) : null;
  });

  protected readonly seances = computed(() =>
    (this.lectureDesSeances.hasValue()
      ? this.lectureDesSeances.value()
      : []
    ).map((seance) => {
      const vue = vueDeSeance(seance);
      const jour = formaterInstant(seance.startsAt, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
      return {
        ...vue,
        meta: `${jour} · ${heureDe(seance.startsAt)} · ${vue.sport}`,
      };
    }),
  );

  protected readonly suppression = signal(false);
  protected readonly refus = signal<ApiError | null>(null);

  protected async supprimer(): Promise<void> {
    const objectif = this.objectif();
    if (!objectif) {
      return;
    }
    const confirme = await this.confirmation.confirm({
      title: `Supprimer «\u00a0${objectif.title}\u00a0» ?`,
      description:
        'Ses séances restent dans le Sport, sans lien vers cet objectif.',
      confirmLabel: 'Supprimer l’objectif',
      destructive: true,
    });
    if (!confirme) {
      return;
    }

    this.suppression.set(true);
    this.refus.set(null);
    this.api.supprimer(objectif.id).subscribe({
      next: () => {
        this.suppression.set(false);
        showToast({ message: `«\u00a0${objectif.title}\u00a0» est supprimé.` });
        void this.router.navigate(['/sport/objectifs']);
      },
      error: (refus: ApiError) => {
        this.suppression.set(false);
        this.refus.set(refus);
      },
    });
  }
}
