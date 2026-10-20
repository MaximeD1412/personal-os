import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  LANGUES,
  LIBELLES_DES_LANGUES,
  LIBELLES_DES_PAGES,
  PAGES_DE_CONTENU,
  zLang,
  zPageContentInput,
  zPageSlug,
  type Lang,
  type PageContent,
  type PageContentInput,
  type PageSlug,
} from '@personal-os/contracts';
import { HlmAlertImports } from '@personal-os/ui/alert';
import { HlmCardImports } from '@personal-os/ui/card';
import {
  DccmPageHeader,
  DccmState,
  stateOf,
  type DccmCrumb,
} from '@personal-os/ui/dccm';
import { HlmToggleGroupImports } from '@personal-os/ui/toggle-group';
import { prefillDepuisRequete } from '../formulaire';
import { EditeurDePageDeContenu } from './page-content-editor';
import { PageContentService } from './page-content.service';

/** Ce que chaque page porte sur le portfolio, sous son titre. */
const DESCRIPTIONS: Readonly<Record<PageSlug, string>> = {
  about: 'Qui vous êtes, en quelques paragraphes.',
  experience: 'Votre parcours, raconté plutôt que listé.',
  skills: 'Ce que vous savez faire, et comment.',
};

export const FIL_DU_PORTFOLIO: readonly DccmCrumb[] = [{ label: 'Portfolio' }];

/**
 * Les Pages de contenu du portfolio, `/portfolio/pages` : les trois pages,
 * chacune dans ses deux langues côte à côte (l'une ou l'autre sous 1024 px),
 * avec l'aperçu de leur rendu et leur État de publication.
 *
 * Le lien préremplit le texte d'une page dans une langue, aux noms des champs
 * du contrat (`?slug=skills&lang=EN&title=Skills&body=…`) ; sans `slug`, la
 * présentation, sans `lang`, le français. Rien ne s'enregistre sans
 * « Enregistrer » (ADR 0030).
 */
@Component({
  imports: [
    HlmAlertImports,
    HlmCardImports,
    HlmToggleGroupImports,
    DccmPageHeader,
    DccmState,
    EditeurDePageDeContenu,
  ],
  templateUrl: './pages.html',
})
export class PagesDuPortfolio {
  private readonly route = inject(ActivatedRoute).snapshot;

  protected readonly lecture = inject(PageContentService).pages();
  protected readonly etat = computed(() => stateOf(this.lecture, () => false));
  protected readonly fil = [...FIL_DU_PORTFOLIO, { label: 'Pages' }];

  private readonly texteDuLien = prefillDepuisRequete(
    zPageContentInput,
    this.route.queryParamMap,
  );
  /** La page et la langue que vise le lien. */
  private readonly pageDuLien = valeurDuLien(
    zPageSlug,
    'slug',
    this.route.queryParamMap.get('slug'),
    'about',
  );
  private readonly langueDuLien = valeurDuLien(
    zLang,
    'lang',
    this.route.queryParamMap.get('lang'),
    'FR',
  );
  protected readonly ignores = [
    ...this.texteDuLien.ignores,
    ...[this.pageDuLien.ignore, this.langueDuLien.ignore].filter(
      (ignore): ignore is string => !!ignore,
    ),
  ];

  protected readonly pagesDeContenu = PAGES_DE_CONTENU;
  protected readonly langues = LANGUES;
  protected readonly libellesDesLangues = LIBELLES_DES_LANGUES;
  protected readonly libelles = LIBELLES_DES_PAGES;
  protected readonly descriptions = DESCRIPTIONS;

  /** La langue montrée sous 1024 px, page par page. */
  protected readonly langueVue = signal<Record<PageSlug, Lang>>({
    about: 'FR',
    experience: 'FR',
    skills: 'FR',
    [this.pageDuLien.valeur]: this.langueDuLien.valeur,
  });

  /**
   * Les textes lus ; rien tant que la lecture n'a pas abouti. Les éditeurs
   * partent de leur texte : ils n'existent qu'une fois lui arrivé.
   */
  protected readonly lu = computed(() =>
    this.lecture.hasValue() ? this.lecture.value() : undefined,
  );
  /** Les textes par page et par langue, tenus à jour par chaque écriture. */
  protected readonly parPage = computed(() => {
    const pages: Partial<Record<string, PageContent>> = {};
    for (const page of this.lu() ?? []) pages[cle(page.slug, page.lang)] = page;
    return pages;
  });

  protected texteDe(slug: PageSlug, lang: Lang): PageContent | undefined {
    return this.parPage()[cle(slug, lang)];
  }

  protected prefillDe(slug: PageSlug, lang: Lang): Partial<PageContentInput> {
    return slug === this.pageDuLien.valeur && lang === this.langueDuLien.valeur
      ? this.texteDuLien.valeurs
      : {};
  }

  protected ecrite(page: PageContent): void {
    this.lecture.update((pages = []) => [
      ...pages.filter(
        ({ slug, lang }) => slug !== page.slug || lang !== page.lang,
      ),
      page,
    ]);
  }

  protected choisir(slug: PageSlug, valeur: unknown): void {
    const lue = zLang.safeParse(valeur);
    if (lue.success) {
      this.langueVue.update((vues) => ({ ...vues, [slug]: lue.data }));
    }
  }
}

function cle(slug: PageSlug, lang: Lang): string {
  return `${slug}/${lang}`;
}

/** Une valeur admise du lien, ou sa valeur par défaut et le paramètre écarté. */
function valeurDuLien<T extends string>(
  schema: {
    safeParse(brut: unknown): { success: true; data: T } | { success: false };
  },
  nom: string,
  brut: string | null,
  defaut: T,
): { valeur: T; ignore?: string } {
  if (brut === null) return { valeur: defaut };
  const lue = schema.safeParse(brut);
  return lue.success
    ? { valeur: lue.data }
    : { valeur: defaut, ignore: `${nom}=${brut}` };
}
