import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { PublicPage } from '@personal-os/contracts';
import { HlmButton } from '@personal-os/ui/button';
import { HlmCard } from '@personal-os/ui/card';
import { DccmEmptyState } from '@personal-os/ui/dccm';
import { ContenuPublic } from './contenu-public';
import type { Lecture } from './lecture';
import { TextePublie } from './texte-publie';

interface Section {
  readonly ancre: string;
  readonly lecture: Lecture<PublicPage>;
}

/**
 * L'accueil d'une langue : la Présentation, les Expériences, les
 * Compétences, les Projets publiés et le CV. Une section que cette langue
 * n'a pas publiée n'apparaît pas : l'autre langue ne la remplace jamais.
 */
@Component({
  selector: 'pos-accueil',
  imports: [RouterLink, HlmButton, HlmCard, DccmEmptyState, TextePublie],
  templateUrl: './accueil.html',
})
export class Accueil {
  protected readonly contenu = inject(ContenuPublic);
  protected readonly textes = this.contenu.textes;
  protected readonly langue = this.contenu.langue;

  protected readonly sections = computed<readonly Section[]>(() => [
    { ancre: 'experiences', lecture: this.contenu.experience() },
    { ancre: 'competences', lecture: this.contenu.competences() },
  ]);
}
