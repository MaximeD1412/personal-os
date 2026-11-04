import { ViewportScroller } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  effect,
  inject,
  Injector,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matArrowDownwardOutline,
  matArrowForwardOutline,
  matDescriptionOutline,
  matDownloadOutline,
  matPsychologyOutline,
  matWorkHistoryOutline,
} from '@ng-icons/material-symbols/outline';
import type { PublicPage } from '@personal-os/contracts';
import { HlmBadge } from '@personal-os/ui/badge';
import { HlmButton } from '@personal-os/ui/button';
import { HlmCard } from '@personal-os/ui/card';
import { DccmEmptyState } from '@personal-os/ui/dccm';
import { ContenuPublic } from './contenu-public';
import { Intitule, type TonDIntitule } from './intitule';
import type { Lecture } from './lecture';
import { premierParagrapheDuMarkdown } from './markdown';
import { Metadonnees } from './metadonnees';
import { TextePublie } from './texte-publie';

interface Section {
  readonly ancre: string;
  readonly intitule: string;
  readonly icone: string;
  readonly teinte: TonDIntitule;
  readonly lecture: Lecture<PublicPage>;
}

/**
 * L'accueil d'une langue : la Présentation, les Expériences, les
 * Compétences, les Projets publiés et le CV. Une section que cette langue
 * n'a pas publiée n'apparaît pas : l'autre langue ne la remplace jamais.
 */
@Component({
  selector: 'pos-accueil',
  imports: [
    RouterLink,
    NgIcon,
    HlmBadge,
    HlmButton,
    HlmCard,
    DccmEmptyState,
    Intitule,
    TextePublie,
  ],
  providers: [
    provideIcons({
      matArrowDownwardOutline,
      matArrowForwardOutline,
      matDescriptionOutline,
      matDownloadOutline,
      matPsychologyOutline,
      matWorkHistoryOutline,
    }),
  ],
  templateUrl: './accueil.html',
})
export class Accueil {
  protected readonly contenu = inject(ContenuPublic);
  protected readonly textes = this.contenu.textes;
  protected readonly langue = this.contenu.langue;

  protected readonly sections = computed<readonly Section[]>(() => {
    const { sections } = this.textes();
    return [
      {
        ancre: 'experiences',
        intitule: sections.experience,
        icone: 'matWorkHistoryOutline',
        teinte: 'secondary',
        lecture: this.contenu.experience(),
      },
      {
        ancre: 'competences',
        intitule: sections.skills,
        icone: 'matPsychologyOutline',
        teinte: 'primary',
        lecture: this.contenu.competences(),
      },
    ];
  });

  /**
   * La suite de la page, sous la Présentation, ne se pose qu'une fois toutes
   * ses lectures arrivées : une section qui arriverait après les autres
   * décalerait ce qu'on lit déjà.
   */
  protected readonly suitePrete = computed(() =>
    [
      this.contenu.presentation(),
      this.contenu.experience(),
      this.contenu.competences(),
      this.contenu.projets(),
      this.contenu.cv(),
    ].every((lecture) => lecture.etat !== 'chargement'),
  );

  constructor() {
    const metadonnees = inject(Metadonnees);
    effect(() => {
      const presentation = this.contenu.presentation();
      const publiee = presentation.etat === 'present';
      metadonnees.poser({
        langue: this.langue(),
        titre: publiee ? presentation.valeur.title : undefined,
        description: publiee
          ? premierParagrapheDuMarkdown(presentation.valeur.body)
          : undefined,
        type: 'website',
        versions: { fr: '/fr', en: '/en' },
        parDefaut: '/',
      });
    });

    // Le routeur défile vers le fragment une seule fois, à la navigation : si
    // sa section n'était pas encore posée (une URL à fragment, ou « Voir les
    // projets » pendant le chargement), le défilement reprend à sa venue.
    const route = inject(ActivatedRoute);
    const defilement = inject(ViewportScroller);
    const injector = inject(Injector);
    effect(() => {
      if (!this.suitePrete()) return;
      afterNextRender(
        () => {
          const ancre = route.snapshot.fragment;
          if (ancre) defilement.scrollToAnchor(ancre);
        },
        { injector },
      );
    });
  }
}
