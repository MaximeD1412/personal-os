import { Component, computed, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matDownloadOutline,
  matUploadOutline,
} from '@ng-icons/material-symbols/outline';
import {
  LANGUES,
  LIBELLES_DES_LANGUES,
  type Cv,
  type Lang,
} from '@personal-os/contracts';
import { HlmAlertImports } from '@personal-os/ui/alert';
import { HlmButton } from '@personal-os/ui/button';
import { HlmCardImports } from '@personal-os/ui/card';
import {
  DccmPageHeader,
  DccmState,
  stateOf,
  type DccmCrumb,
} from '@personal-os/ui/dccm';
import { showToast } from '@personal-os/ui/sonner';
import type { ErreurApi } from '../erreur-api.interceptor';
import { CvService } from './cv.service';

const JOUR = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Paris',
});

const MEGA_OCTETS = new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 1,
});

/** Une taille de fichier lisible : « 480 Ko », « 1,2 Mo ». */
export function formaterTaille(octets: number): string {
  const ko = octets / 1024;
  return ko < 1024
    ? `${Math.max(1, Math.round(ko))}\u00a0Ko`
    : `${MEGA_OCTETS.format(ko / 1024)}\u00a0Mo`;
}

/**
 * Le CV du portfolio, un PDF par langue : on le téléverse, on le remplace,
 * on le télécharge. Le fichier est jugé par l'API, à son contenu : l'écran
 * affiche son refus tel quel.
 */
@Component({
  imports: [
    NgIcon,
    HlmAlertImports,
    HlmButton,
    HlmCardImports,
    DccmPageHeader,
    DccmState,
  ],
  providers: [provideIcons({ matDownloadOutline, matUploadOutline })],
  templateUrl: './cv.html',
})
export class CurriculumVitae {
  private readonly service = inject(CvService);

  protected readonly fil: readonly DccmCrumb[] = [
    { label: 'Portfolio' },
    { label: 'CV' },
  ];
  protected readonly langues = LANGUES;
  protected readonly libelles = LIBELLES_DES_LANGUES;

  protected readonly lecture = this.service.cvs();
  protected readonly etat = computed(() => stateOf(this.lecture, () => false));
  /** Le CV de chaque langue, ou rien s'il n'a pas encore été téléversé. */
  protected readonly parLangue = computed(() => {
    const cvs = this.lecture.hasValue() ? this.lecture.value() : [];
    return new Map<Lang, Cv>(cvs.map((cv) => [cv.lang, cv]));
  });

  /** Le refus d'un téléversement, montré au-dessus des CV. */
  protected readonly refus = signal<ErreurApi | null>(null);
  /** La langue dont le fichier part, le temps de l'envoi. */
  protected readonly envoi = signal<Lang | null>(null);

  protected lien(lang: Lang): string {
    return this.service.lien(lang);
  }

  protected detail(cv: Cv): string {
    return `${formaterTaille(cv.size)} · Téléversé le ${JOUR.format(new Date(cv.uploadedAt))}`;
  }

  protected televerser(lang: Lang, champ: HTMLInputElement): void {
    const fichier = champ.files?.[0];
    // Vider le champ permet de choisir à nouveau le même fichier.
    champ.value = '';
    if (!fichier) return;

    this.envoi.set(lang);
    this.refus.set(null);
    this.service.televerser(lang, fichier).subscribe({
      next: () => {
        this.envoi.set(null);
        showToast({
          message: `Le CV en ${LIBELLES_DES_LANGUES[lang].toLowerCase()} est en place.`,
        });
        this.lecture.reload();
      },
      error: (erreur: ErreurApi) => {
        this.envoi.set(null);
        this.refus.set(erreur);
      },
    });
  }
}
