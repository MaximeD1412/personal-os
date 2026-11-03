import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { matArrowBackOutline } from '@ng-icons/material-symbols/outline';
import { HlmAlertImports } from '@personal-os/ui/alert';
import { HlmButton } from '@personal-os/ui/button';
import { HlmCardImports } from '@personal-os/ui/card';
import {
  DccmPageHeader,
  DccmState,
  stateOf,
  type DccmCrumb,
} from '@personal-os/ui/dccm';
import { AiTraceService } from '../ai-trace.service';
import { formaterMontant } from '../projets/montant';
import {
  FIL_DU_PLANNING,
  PARAMETRE_DE_SEMAINE,
  semaineDemandee,
} from './planning';

const NOMBRE = new Intl.NumberFormat('fr-FR');

const INSTANT = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Europe/Paris',
});

/** Un compte de jetons, ou un tiret quand le fournisseur n'a pas répondu. */
function jetons(nombre: number | null): string {
  return nombre === null ? '—' : NOMBRE.format(nombre);
}

/**
 * La Trace IA d'un Tour de génération :
 * `/repas/generation/traces/:traceId?semaine=YYYY-MM-DD`. Le modèle, les
 * jetons et le coût de l'appel, puis la consigne, la demande et la réponse
 * brute, telle que le modèle l'a rendue, avant tout contrôle. C'est ce qui
 * permet de comprendre une proposition étrange. `semaine` ramène au planning
 * d'où l'on vient.
 */
@Component({
  imports: [
    RouterLink,
    NgIcon,
    HlmAlertImports,
    HlmButton,
    HlmCardImports,
    DccmPageHeader,
    DccmState,
  ],
  templateUrl: './trace-de-generation.html',
})
export class TraceDeGeneration {
  private readonly route = inject(ActivatedRoute).snapshot;

  protected readonly lecture = inject(AiTraceService).trace(() =>
    this.route.paramMap.get('traceId'),
  );
  protected readonly etat = computed(() => stateOf(this.lecture, () => false));
  /** La trace lue ; rien quand la lecture a échoué (lire `value()` lèverait). */
  protected readonly trace = computed(() =>
    this.lecture.hasValue() ? this.lecture.value() : undefined,
  );

  protected readonly fil: readonly DccmCrumb[] = [
    ...FIL_DU_PLANNING,
    { label: 'Trace de génération' },
  ];

  /** Le retour au planning de la semaine d'où l'on vient. */
  protected readonly retour = {
    [PARAMETRE_DE_SEMAINE]: semaineDemandee(
      this.route.queryParamMap.get(PARAMETRE_DE_SEMAINE),
    ),
  };

  protected readonly icones = { retour: matArrowBackOutline };

  protected readonly sousTitre = computed(() => {
    const trace = this.trace();
    return trace ? `Appel du ${INSTANT.format(new Date(trace.createdAt))}` : '';
  });

  protected readonly cout = computed(() => {
    const trace = this.trace();
    return trace
      ? formaterMontant({ cents: trace.costCents, currency: 'EUR' })
      : '';
  });

  protected readonly jetons = computed(() => {
    const trace = this.trace();
    return trace
      ? `${jetons(trace.inputTokens)} en entrée, ${jetons(trace.outputTokens)} en sortie`
      : '';
  });
}
