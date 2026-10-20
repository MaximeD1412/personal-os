import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  LANGUES,
  LIBELLES_DES_LANGUES,
  zLang,
  zPublicPresentationInput,
  type Lang,
  type PublicPresentation,
  type PublicPresentationInput,
} from '@personal-os/contracts';
import { HlmAlertImports } from '@personal-os/ui/alert';
import { DccmPageHeader, DccmState, stateOf } from '@personal-os/ui/dccm';
import { HlmToggleGroupImports } from '@personal-os/ui/toggle-group';
import { prefillDepuisRequete } from '../formulaire';
import { EditeurDePresentation } from './presentation-editor';
import { PresentationService } from './presentation.service';
import { ProjectService } from './project.service';
import { OngletsDuProjet } from './project-tabs';
import { FIL_DES_PROJETS } from './projects';

/**
 * La Présentation publique d'un Projet, `/projets/:id/presentation` : un
 * texte par langue, chacun avec son État de publication. Sur grand écran, les
 * deux langues côte à côte ; en dessous, l'une ou l'autre.
 *
 * Le lien préremplit le texte d'une langue, aux noms des champs du contrat
 * (`?lang=EN&title=Bookbinding&summary=…&body=…`, le français sans `lang`).
 * Rien ne s'enregistre sans « Enregistrer » (ADR 0030).
 */
@Component({
  imports: [
    HlmAlertImports,
    HlmToggleGroupImports,
    DccmPageHeader,
    DccmState,
    EditeurDePresentation,
    OngletsDuProjet,
  ],
  templateUrl: './project-presentation.html',
})
export class PresentationDuProjet {
  private readonly route = inject(ActivatedRoute).snapshot;

  protected readonly id = this.route.paramMap.get('id') ?? '';
  private readonly lectureDuProjet = inject(ProjectService).projet(
    () => this.id,
  );
  protected readonly lecture = inject(PresentationService).presentations(
    () => this.id,
  );
  protected readonly etat = computed(() => stateOf(this.lecture, () => false));

  protected readonly titre = computed(
    () =>
      (this.lectureDuProjet.hasValue()
        ? this.lectureDuProjet.value()?.title
        : undefined) ?? 'Projet',
  );
  protected readonly fil = computed(() => [
    ...FIL_DES_PROJETS,
    { label: this.titre(), link: `/projets/${this.id}` },
    { label: 'Présentation publique' },
  ]);

  private readonly texteDuLien = prefillDepuisRequete(
    zPublicPresentationInput,
    this.route.queryParamMap,
  );
  /** La langue que vise le lien ; le français s'il n'en dit rien. */
  private readonly langueDuLien = langueDe(
    this.route.queryParamMap.get('lang'),
  );
  protected readonly ignores = [
    ...this.texteDuLien.ignores,
    ...(this.langueDuLien.ignore ? [this.langueDuLien.ignore] : []),
  ];

  protected readonly langues = LANGUES;
  protected readonly libelles = LIBELLES_DES_LANGUES;
  /** La langue montrée sous 1024 px. */
  protected readonly langue = signal<Lang>(this.langueDuLien.lang);

  /**
   * Les présentations lues ; rien tant que la lecture n'a pas abouti. Les
   * éditeurs partent de leur texte : ils n'existent qu'une fois lui arrivé.
   */
  protected readonly lu = computed(() =>
    this.lecture.hasValue() ? this.lecture.value() : undefined,
  );
  /** Les présentations par langue, tenues à jour par chaque écriture. */
  protected readonly parLangue = computed(
    (): Partial<Record<Lang, PublicPresentation>> =>
      Object.fromEntries(
        (this.lu() ?? []).map((presentation) => [
          presentation.lang,
          presentation,
        ]),
      ),
  );

  protected prefillDe(lang: Lang): Partial<PublicPresentationInput> {
    return lang === this.langueDuLien.lang ? this.texteDuLien.valeurs : {};
  }

  protected ecrite(presentation: PublicPresentation): void {
    this.lecture.update((presentations = []) => [
      ...presentations.filter(({ lang }) => lang !== presentation.lang),
      presentation,
    ]);
  }

  protected choisir(valeur: unknown): void {
    const lue = zLang.safeParse(valeur);
    if (lue.success) this.langue.set(lue.data);
  }
}

function langueDe(brut: string | null): { lang: Lang; ignore?: string } {
  if (brut === null) return { lang: 'FR' };
  const lue = zLang.safeParse(brut);
  return lue.success
    ? { lang: lue.data }
    : { lang: 'FR', ignore: `lang=${brut}` };
}
