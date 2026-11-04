import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, type ParamMap } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import {
  matEventBusyOutline,
  matFitnessCenterOutline,
  matNotesOutline,
} from '@ng-icons/material-symbols/outline';
import {
  zTrainingSessionUpdate,
  type ApiError,
  type TrainingSession,
  type TrainingSessionCompletion,
  type TrainingSessionUpdate,
} from '@personal-os/contracts';
import { HlmAlertImports } from '@personal-os/ui/alert';
import { HlmBadge } from '@personal-os/ui/badge';
import { HlmButton } from '@personal-os/ui/button';
import {
  HlmCard,
  HlmCardContent,
  HlmCardHeader,
  HlmCardTitle,
} from '@personal-os/ui/card';
import {
  DccmConfirm,
  DccmFormPage,
  DccmPageHeader,
  DccmState,
  stateOf,
} from '@personal-os/ui/dccm';
import { showToast } from '@personal-os/ui/sonner';
import { HlmTableImports } from '@personal-os/ui/table';
import { map } from 'rxjs';
import { erreursDeChamp, prefillDepuisRequete } from '../formulaire';
import { ChampsDeMesures } from './champs-de-mesures';
import {
  lireLesMesures,
  saisieDesMesures,
  SAISIE_VIERGE,
  type MesuresLues,
  type SaisieDeMesures,
} from './saisie-de-seance';
import { heureDe, semaineDe } from './semaine';
import { PARAMETRE_DE_SEMAINE } from './sport';
import { TrainingSessionService } from './training-session.service';
import { vueDeSeance } from './vue-de-seance';

const DATE_LONGUE = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Paris',
});

/**
 * Une Séance, ouverte depuis la liste ou l'Agenda (ADR 0011) : l'écart entre
 * le prévu et le réalisé, la modification de l'un et de l'autre, et les deux
 * transitions d'une Séance prévue (ADR 0022).
 *
 * - « Marquer réalisée » déclare le réalisé, le prévu reste à côté ;
 *   « Marquer manquée » garde le prévu. Toutes deux sont des transitions, et
 *   se confirment donc (docs/design-system.md) ;
 * - la modification ne touche jamais au statut (ADR 0030) : le réalisé ne s'y
 *   modifie que sur une Séance réalisée ;
 * - elle est adressable et préremplie par son lien
 *   (`/sport/seances/:id?plannedDistanceM=12000`, ADR 0030) : les paramètres
 *   portent les noms des champs de `zTrainingSessionUpdate` et s'appliquent
 *   sur la Séance lue, une fois par lien, sans rien enregistrer : une autre
 *   Séance ou d'autres paramètres, dans le même écran, sont un autre lien. Un paramètre refusé
 *   par le contrat, ou qui vise un champ que l'écran ne modifie pas sur cette
 *   Séance, est signalé, jamais appliqué.
 */
@Component({
  selector: 'pos-seance',
  templateUrl: './seance.html',
  imports: [
    ChampsDeMesures,
    DccmFormPage,
    DccmPageHeader,
    DccmState,
    HlmAlertImports,
    HlmBadge,
    HlmButton,
    HlmCard,
    HlmCardContent,
    HlmCardHeader,
    HlmCardTitle,
    HlmTableImports,
    NgIcon,
  ],
})
export class Seance {
  private readonly api = inject(TrainingSessionService);
  private readonly router = inject(Router);
  private readonly confirmation = inject(DccmConfirm);
  private readonly route = inject(ActivatedRoute);

  protected readonly icones = {
    manquee: matEventBusyOutline,
    notes: matNotesOutline,
    sport: matFitnessCenterOutline,
  };

  private readonly id = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id') ?? '')),
    { initialValue: '' },
  );
  protected readonly lecture = this.api.lectureDe(this.id);
  protected readonly etat = computed(() => stateOf(this.lecture, () => false));
  protected readonly vue = computed(() => {
    const seance = this.lecture.hasValue() ? this.lecture.value() : undefined;
    return seance ? vueDeSeance(seance) : null;
  });

  protected readonly titre = computed(() => this.vue()?.titre ?? 'Séance');
  protected readonly sousTitre = computed(() => {
    const seance = this.vue()?.seance;
    return seance
      ? `${DATE_LONGUE.format(new Date(seance.startsAt))} à ${heureDe(seance.startsAt)}`
      : undefined;
  });
  protected readonly fil = computed(() => [
    { label: 'Sport', link: this.lienDeLaSemaine() },
    { label: this.titre() },
  ]);

  /** Les champs de la modification, repris de la Séance lue. */
  protected readonly prevu = signal<SaisieDeMesures>({ ...SAISIE_VIERGE });
  protected readonly realiseModifie = signal<SaisieDeMesures>({
    ...SAISIE_VIERGE,
  });
  /** Les champs de « Marquer réalisée », vierges : le réalisé est à déclarer. */
  protected readonly realiseDeclare = signal<SaisieDeMesures>({
    ...SAISIE_VIERGE,
  });

  /**
   * Les paramètres du lien, suivis : le routeur réutilise l'écran d'une
   * Séance à l'autre, et quand seuls les paramètres changent.
   */
  private readonly requete = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  /** Ce que le lien apporte à la modification. */
  private readonly lien = computed(() =>
    prefillDepuisRequete(zTrainingSessionUpdate, this.requete()),
  );
  /**
   * Le dernier lien appliqué (la Séance et ses paramètres) : un lien ne
   * s'applique qu'une fois, pas de nouveau à la relecture qui suit une
   * écriture.
   */
  private lienApplique: string | null = null;
  /** Les paramètres du lien écartés, montrés sur la modification. */
  protected readonly ignoresDuLien = signal<string[]>([]);

  protected readonly envoi = signal<'modifier' | 'completer' | null>(null);
  protected readonly refusDeModification = signal<ApiError | null>(null);
  protected readonly refusDeDeclaration = signal<ApiError | null>(null);
  /** L'échec d'une transition qui n'a pas de formulaire : « Marquer manquée ». */
  protected readonly refusDeTransition = signal<ApiError | null>(null);
  private readonly illisiblesDeModification = signal<Record<string, string>>(
    {},
  );
  private readonly illisiblesDeDeclaration = signal<Record<string, string>>({});

  protected readonly erreursDeModification = computed(() => ({
    ...erreursDeChamp(this.refusDeModification()),
    ...this.illisiblesDeModification(),
  }));
  protected readonly erreursDeDeclaration = computed(() => ({
    ...erreursDeChamp(this.refusDeDeclaration()),
    ...this.illisiblesDeDeclaration(),
  }));

  constructor() {
    // Chaque lecture aboutie remet les champs à ce qu'est la Séance.
    effect(() => {
      const seance = this.vue()?.seance;
      if (seance) {
        this.reprendre(seance);
      }
    });
  }

  protected enregistrer(): void {
    const seance = this.vue()?.seance;
    if (!seance) {
      return;
    }
    const prevu = lireLesMesures(this.prevu(), 'planned');
    const realise = lireLesMesures(this.realiseModifie(), 'actual');
    const illisibles = {
      ...prevu.erreurs,
      ...(seance.status === 'DONE' ? realise.erreurs : {}),
    };
    this.illisiblesDeModification.set(illisibles);
    if (Object.keys(illisibles).length > 0) {
      return;
    }

    const changements = changementsSur(
      seance,
      prevu.mesures,
      seance.status === 'DONE' ? realise.mesures : null,
    );
    if (Object.keys(changements).length === 0) {
      showToast({ tone: 'neutral', message: 'Rien à enregistrer.' });
      return;
    }

    this.envoi.set('modifier');
    this.api.modifier(seance.id, changements).subscribe({
      next: () => this.apres('Séance enregistrée.'),
      error: (refus: ApiError) => {
        this.envoi.set(null);
        this.refusDeModification.set(refus);
      },
    });
  }

  protected async completer(): Promise<void> {
    const seance = this.vue()?.seance;
    if (!seance) {
      return;
    }
    const { mesures, erreurs } = lireLesMesures(
      this.realiseDeclare(),
      'actual',
    );
    this.illisiblesDeDeclaration.set(erreurs);
    if (Object.keys(erreurs).length > 0) {
      return;
    }

    const realise: TrainingSessionCompletion = {};
    if (mesures.distanceM !== null) realise.actualDistanceM = mesures.distanceM;
    if (mesures.dureeS !== null) realise.actualDurationS = mesures.dureeS;
    if (mesures.texte !== null) realise.actualNotes = mesures.texte;

    const confirme = await this.confirmation.confirm({
      title: 'Marquer la séance réalisée ?',
      description:
        'Le réalisé déclaré reste à côté du prévu. Elle ne pourra plus être marquée manquée.',
      confirmLabel: 'Marquer réalisée',
    });
    if (!confirme) {
      return;
    }

    this.envoi.set('completer');
    this.api.completer(seance.id, realise).subscribe({
      next: () => this.apres('Séance marquée réalisée.'),
      error: (refus: ApiError) => {
        this.envoi.set(null);
        this.refusDeDeclaration.set(refus);
      },
    });
  }

  protected async manquer(): Promise<void> {
    const seance = this.vue()?.seance;
    if (!seance) {
      return;
    }
    const confirme = await this.confirmation.confirm({
      title: 'Marquer la séance manquée ?',
      description:
        'Elle garde son prévu et ne pourra plus être marquée réalisée.',
      confirmLabel: 'Marquer manquée',
    });
    if (!confirme) {
      return;
    }

    this.api.manquer(seance.id).subscribe({
      next: () => this.apres('Séance marquée manquée.'),
      error: (refus: ApiError) => this.refusDeTransition.set(refus),
    });
  }

  protected fermer(): void {
    void this.router.navigateByUrl(this.lienDeLaSemaine());
  }

  private apres(message: string): void {
    this.envoi.set(null);
    this.refusDeModification.set(null);
    this.refusDeDeclaration.set(null);
    this.refusDeTransition.set(null);
    showToast({ message });
    this.lecture.reload();
  }

  private reprendre(lue: TrainingSession): void {
    const lien = `${this.id()}?${enChaine(this.requete())}`;
    // Une lecture encore celle de la Séance précédente attend la sienne.
    const nouveau = lue.id === this.id() && lien !== this.lienApplique;
    if (nouveau) {
      this.lienApplique = lien;
    }
    const seance = nouveau ? this.appliquerLeLien(lue) : lue;
    this.prevu.set(
      saisieDesMesures({
        distanceM: seance.plannedDistanceM,
        dureeS: seance.plannedDurationS,
        texte: seance.plannedIntent,
      }),
    );
    this.realiseModifie.set(
      saisieDesMesures({
        distanceM: seance.actualDistanceM,
        dureeS: seance.actualDurationS,
        texte: seance.actualNotes,
      }),
    );
    this.realiseDeclare.set({ ...SAISIE_VIERGE });
    this.illisiblesDeModification.set({});
    this.illisiblesDeDeclaration.set({});
  }

  /**
   * La Séance lue, avec ce que le lien y change : seulement les champs que la
   * modification porte pour ce statut. Le reste du lien est signalé.
   */
  private appliquerLeLien(seance: TrainingSession): TrainingSession {
    const { valeurs, ignores: refuses } = this.lien();
    const modifiables = new Set<string>([
      'plannedDistanceM',
      'plannedDurationS',
      'plannedIntent',
      ...(seance.status === 'DONE'
        ? ['actualDistanceM', 'actualDurationS', 'actualNotes']
        : []),
    ]);
    const appliques: Partial<TrainingSession> = {};
    const ignores = [...refuses];
    for (const [champ, valeur] of Object.entries(valeurs)) {
      if (modifiables.has(champ)) {
        Object.assign(appliques, { [champ]: valeur });
      } else {
        ignores.push(`${champ}=${this.requete().get(champ)}`);
      }
    }
    this.ignoresDuLien.set(ignores);
    return { ...seance, ...appliques };
  }

  private lienDeLaSemaine(): string {
    const seance = this.vue()?.seance;
    return seance
      ? `/sport?${PARAMETRE_DE_SEMAINE}=${semaineDe(seance.startsAt)}`
      : '/sport';
  }
}

/**
 * Une modification ne porte que ce qui change : un champ vidé est retiré
 * (`null`), un champ intact n'est pas envoyé. Le réalisé n'en fait partie que
 * sur une Séance réalisée.
 */
function changementsSur(
  seance: TrainingSession,
  prevu: MesuresLues,
  realise: MesuresLues | null,
): TrainingSessionUpdate {
  const voulu: TrainingSessionUpdate = {
    plannedDistanceM: prevu.distanceM,
    plannedDurationS: prevu.dureeS,
    plannedIntent: prevu.texte,
    ...(realise
      ? {
          actualDistanceM: realise.distanceM,
          actualDurationS: realise.dureeS,
          actualNotes: realise.texte,
        }
      : {}),
  };

  return Object.fromEntries(
    Object.entries(voulu).filter(
      ([champ, valeur]) => seance[champ as keyof TrainingSession] !== valeur,
    ),
  ) as TrainingSessionUpdate;
}

/** Les paramètres d'un lien, dans un ordre stable : deux liens égaux s'écrivent pareil. */
function enChaine(parametres: ParamMap): string {
  return [...parametres.keys]
    .sort()
    .flatMap((nom) =>
      parametres.getAll(nom).map((valeur) => `${nom}=${valeur}`),
    )
    .join('&');
}
