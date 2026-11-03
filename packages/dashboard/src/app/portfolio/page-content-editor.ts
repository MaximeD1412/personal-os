import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matCheckCircleOutline,
  matPublicOffOutline,
  matSaveOutline,
  matSendOutline,
  matUndoOutline,
} from '@ng-icons/material-symbols/outline';
import {
  LIBELLES_DES_LANGUES,
  LIBELLES_DES_PAGES,
  transitionsPossibles,
  type Lang,
  type PageContent,
  type PageContentInput,
  type PageSlug,
  type PublicationState,
  type PublicationTransition,
} from '@personal-os/contracts';
import { HlmAlertImports } from '@personal-os/ui/alert';
import { HlmBadge, type BadgeTone } from '@personal-os/ui/badge';
import { HlmButton } from '@personal-os/ui/button';
import { DccmConfirm } from '@personal-os/ui/dccm';
import { HlmFieldImports } from '@personal-os/ui/field';
import { HlmInput } from '@personal-os/ui/input';
import { showToast } from '@personal-os/ui/sonner';
import { HlmToggleGroupImports } from '@personal-os/ui/toggle-group';
import type { Observable } from 'rxjs';
import type { ErreurApi } from '../erreur-api.interceptor';
import { erreursDeChamp } from '../formulaire';
import { rendreLeMarkdown } from '../projets/markdown';
import { PageContentService } from './page-content.service';

const TONS: Readonly<Record<PublicationState, BadgeTone>> = {
  UNPUBLISHED: 'neutral',
  READY: 'warning',
  PUBLISHED: 'success',
};

/** L'état accordé à « la page » : son badge le prend en majuscule. */
const ETATS_ACCORDES: Readonly<Record<PublicationState, string>> = {
  UNPUBLISHED: 'non publiée',
  READY: 'prête à publier',
  PUBLISHED: 'publiée',
};

const CHAMPS: readonly string[] = ['title', 'body'];

/** La langue dans la phrase : « la page Compétences en anglais ». */
const EN_TOUTES_LETTRES: Readonly<Record<Lang, string>> = {
  FR: 'en français',
  EN: 'en anglais',
};

type Vue = 'texte' | 'apercu';

/**
 * Une Page de contenu dans une langue : son titre, son texte en markdown et
 * son aperçu rendu, son État de publication et les transitions qu'il
 * accepte. « Enregistrer » ne change jamais l'état, sauf pour retirer du
 * portfolio un texte publié qu'on modifie ; chaque transition se confirme, et
 * n'est offerte qu'une fois le texte enregistré : on ne publie jamais autre
 * chose que ce qu'on lit.
 */
@Component({
  selector: 'pos-page-content-editor',
  imports: [
    NgIcon,
    HlmAlertImports,
    HlmBadge,
    HlmButton,
    HlmFieldImports,
    HlmInput,
    HlmToggleGroupImports,
  ],
  providers: [
    provideIcons({
      matCheckCircleOutline,
      matPublicOffOutline,
      matSaveOutline,
      matSendOutline,
      matUndoOutline,
    }),
  ],
  templateUrl: './page-content-editor.html',
})
export class EditeurDePageDeContenu {
  private readonly service = inject(PageContentService);
  private readonly confirmation = inject(DccmConfirm);

  readonly slug = input.required<PageSlug>();
  readonly lang = input.required<Lang>();
  /** Le texte enregistré ; rien tant que cette langue n'est pas rédigée. */
  readonly page = input<PageContent>();
  /** Ce que le lien apporte au texte, par-dessus l'enregistré. */
  readonly prefill = input<Partial<PageContentInput>>({});

  /** La page, telle que l'API l'a rendue après une écriture. */
  readonly ecrite = output<PageContent>();

  protected readonly titre = signal('');
  protected readonly texte = signal('');
  protected readonly vue = signal<Vue>('texte');
  protected readonly apercu = computed(() => rendreLeMarkdown(this.texte()));

  protected readonly envoi = signal(false);
  protected readonly refus = signal<ErreurApi | null>(null);
  protected readonly erreurs = computed(() => erreursDeChamp(this.refus()));
  /** Un refus qui ne vise aucun champ de la colonne : son bandeau. */
  protected readonly refusSansChamp = computed(() => {
    const refus = this.refus();
    const vise = (refus?.fields ?? []).some(({ path }) =>
      CHAMPS.includes(path),
    );
    return refus && !vise ? refus.message : null;
  });

  protected readonly libelle = computed(
    () => LIBELLES_DES_LANGUES[this.lang()],
  );
  /** « la page Compétences en anglais », pour les confirmations et les toasts. */
  private readonly nom = computed(
    () =>
      `la page ${LIBELLES_DES_PAGES[this.slug()]} ${EN_TOUTES_LETTRES[this.lang()]}`,
  );
  protected readonly id = computed(() => `page-${this.slug()}-${this.lang()}`);
  protected readonly etat = computed(
    (): PublicationState => this.page()?.publicationState ?? 'UNPUBLISHED',
  );
  protected readonly libelleDeLEtat = computed(() =>
    majuscule(ETATS_ACCORDES[this.etat()]),
  );
  protected readonly ton = computed(() => TONS[this.etat()]);

  /**
   * Le texte saisi diffère de l'enregistré ; tant que rien ne l'est, d'une
   * langue vide.
   */
  protected readonly modifie = computed(() => {
    const enregistree = this.page() ?? { title: '', body: '' };
    return (
      enregistree.title !== this.titre() || enregistree.body !== this.texte()
    );
  });
  protected readonly transitions = computed(() =>
    this.page() ? transitionsPossibles(this.etat()) : [],
  );

  constructor() {
    // Le texte part de l'enregistré, une seule fois, et le lien le complète :
    // une relecture n'efface pas ce qu'on a saisi depuis.
    let rempli = false;
    effect(() => {
      const page = this.page();
      const prefill = this.prefill();
      if (rempli) return;
      rempli = true;
      untracked(() => this.remplir({ ...page, ...prefill }));
    });
  }

  protected valeur(evenement: Event): string {
    return (evenement.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  protected choisirLaVue(valeur: unknown): void {
    if (valeur === 'texte' || valeur === 'apercu') this.vue.set(valeur);
  }

  protected enregistrer(): void {
    const avant = this.page()?.publicationState;
    const envoye: PageContentInput = {
      title: this.titre(),
      body: this.texte(),
    };
    this.envoyer(
      this.service.rediger(this.slug(), this.lang(), envoye),
      (page) => {
        // Le texte rendu (rogné par l'API) ne remplace que les champs restés
        // tels qu'envoyés : ce qu'on a écrit pendant l'envoi reste à enregistrer.
        this.remplir({
          title: this.titre() === envoye.title ? page.title : undefined,
          body: this.texte() === envoye.body ? page.body : undefined,
        });
        const nom = majuscule(this.nom());
        showToast({
          message:
            avant === 'PUBLISHED' && page.publicationState === 'READY'
              ? `${nom} est enregistrée. Elle quitte le portfolio jusqu’à sa republication.`
              : `${nom} est enregistrée.`,
        });
      },
    );
  }

  protected async changer(transition: PublicationTransition): Promise<void> {
    const confirmee = await this.confirmer(transition);
    if (!confirmee) return;

    this.envoyer(
      this.service.transition(this.slug(), this.lang(), transition),
      (page) =>
        showToast({
          message: `${majuscule(this.nom())} est ${ETATS_ACCORDES[page.publicationState]}.`,
        }),
    );
  }

  /** Toute transition se confirme ; dépublier un texte en ligne est destructif. */
  private async confirmer(transition: PublicationTransition): Promise<boolean> {
    if (transition === 'ready') {
      return !!(await this.confirmation.confirm({
        title: `Marquer ${this.nom()} prête à publier ?`,
        description:
          'Elle pourra être publiée sur le portfolio. Rien n’y apparaît encore.',
        confirmLabel: 'Marquer prête',
      }));
    }
    if (transition === 'publish') {
      return !!(await this.confirmation.confirm({
        title: `Publier ${this.nom()} ?`,
        description:
          'Elle apparaîtra sur le portfolio public, telle qu’elle est enregistrée.',
        confirmLabel: 'Publier',
      }));
    }
    if (transition === 'unpublish' && this.etat() === 'PUBLISHED') {
      return !!(await this.confirmation.confirm({
        title: `Dépublier ${this.nom()} ?`,
        description:
          'Elle quitte le portfolio public. Son texte reste ici, non publié.',
        confirmLabel: 'Dépublier',
        destructive: true,
      }));
    }
    return !!(await this.confirmation.confirm({
      title: `Repasser ${this.nom()} en non publiée ?`,
      description:
        'Elle ne pourra être publiée qu’une fois de nouveau marquée prête.',
      confirmLabel: 'Repasser en non publiée',
    }));
  }

  private envoyer(
    requete: Observable<PageContent>,
    reussite: (page: PageContent) => void,
  ): void {
    this.envoi.set(true);
    this.refus.set(null);
    requete.subscribe({
      next: (page) => {
        this.envoi.set(false);
        this.ecrite.emit(page);
        reussite(page);
      },
      error: (erreur: ErreurApi) => {
        this.envoi.set(false);
        this.refus.set(erreur);
      },
    });
  }

  private remplir(valeurs: Partial<PageContentInput>): void {
    if (valeurs.title !== undefined) this.titre.set(valeurs.title);
    if (valeurs.body !== undefined) this.texte.set(valeurs.body);
  }
}

function majuscule(phrase: string): string {
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}
