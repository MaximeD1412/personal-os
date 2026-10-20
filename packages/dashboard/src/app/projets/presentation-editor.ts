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
  LIBELLES_DES_ETATS_DE_PUBLICATION,
  LIBELLES_DES_LANGUES,
  transitionsPossibles,
  type Lang,
  type PublicationState,
  type PublicationTransition,
  type PublicPresentation,
  type PublicPresentationInput,
} from '@personal-os/contracts';
import { HlmAlertImports } from '@personal-os/ui/alert';
import { HlmBadge, type BadgeTone } from '@personal-os/ui/badge';
import { HlmButton } from '@personal-os/ui/button';
import { HlmCardImports } from '@personal-os/ui/card';
import { DccmConfirm } from '@personal-os/ui/dccm';
import { HlmFieldImports } from '@personal-os/ui/field';
import { HlmInput } from '@personal-os/ui/input';
import { showToast } from '@personal-os/ui/sonner';
import type { Observable } from 'rxjs';
import type { ErreurApi } from '../erreur-api.interceptor';
import { erreursDeChamp } from '../formulaire';
import { PresentationService } from './presentation.service';

const TONS: Readonly<Record<PublicationState, BadgeTone>> = {
  UNPUBLISHED: 'neutral',
  READY: 'warning',
  PUBLISHED: 'success',
};

const CHAMPS: readonly string[] = ['title', 'summary', 'body'];

/** La langue dans la phrase : « le texte en anglais ». */
const EN_TOUTES_LETTRES: Readonly<Record<Lang, string>> = {
  FR: 'en français',
  EN: 'en anglais',
};

/**
 * La Présentation publique d'un Projet dans une langue : son texte, son État
 * de publication et les transitions qu'il accepte. « Enregistrer » ne change
 * jamais l'état, sauf pour retirer du portfolio un texte publié qu'on
 * modifie ; publier ou dépublier se confirme. Une transition n'est offerte
 * qu'une fois le texte enregistré : on ne publie jamais autre chose que ce
 * qu'on lit.
 */
@Component({
  selector: 'pos-presentation-editor',
  imports: [
    NgIcon,
    HlmAlertImports,
    HlmBadge,
    HlmButton,
    HlmCardImports,
    HlmFieldImports,
    HlmInput,
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
  templateUrl: './presentation-editor.html',
})
export class EditeurDePresentation {
  private readonly service = inject(PresentationService);
  private readonly confirmation = inject(DccmConfirm);

  readonly projectId = input.required<string>();
  readonly lang = input.required<Lang>();
  /** La présentation enregistrée ; rien tant que cette langue n'est pas rédigée. */
  readonly presentation = input<PublicPresentation>();
  /** Ce que le lien apporte au texte, par-dessus l'enregistré. */
  readonly prefill = input<Partial<PublicPresentationInput>>({});

  /** La présentation, telle que l'API l'a rendue après une écriture. */
  readonly ecrite = output<PublicPresentation>();

  protected readonly titre = signal('');
  protected readonly accroche = signal('');
  protected readonly texte = signal('');

  protected readonly envoi = signal(false);
  protected readonly refus = signal<ErreurApi | null>(null);
  protected readonly erreurs = computed(() => erreursDeChamp(this.refus()));
  /** Un refus qui ne vise aucun champ de la carte : son bandeau. */
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
  protected readonly enLettres = computed(() => EN_TOUTES_LETTRES[this.lang()]);
  protected readonly etat = computed(
    (): PublicationState =>
      this.presentation()?.publicationState ?? 'UNPUBLISHED',
  );
  protected readonly libelleDeLEtat = computed(
    () => LIBELLES_DES_ETATS_DE_PUBLICATION[this.etat()],
  );
  protected readonly ton = computed(() => TONS[this.etat()]);

  /** Le texte saisi diffère de l'enregistré, ou rien n'est encore enregistré. */
  protected readonly modifie = computed(() => {
    const enregistree = this.presentation();
    return (
      !enregistree ||
      enregistree.title !== this.titre() ||
      enregistree.summary !== this.accroche() ||
      enregistree.body !== this.texte()
    );
  });
  protected readonly transitions = computed(() =>
    this.presentation() ? transitionsPossibles(this.etat()) : [],
  );

  constructor() {
    // Le texte part de l'enregistré, une seule fois, et le lien le complète :
    // une relecture n'efface pas ce qu'on a saisi depuis.
    let rempli = false;
    effect(() => {
      const presentation = this.presentation();
      const prefill = this.prefill();
      if (rempli) return;
      rempli = true;
      untracked(() => this.remplir({ ...presentation, ...prefill }));
    });
  }

  protected valeur(evenement: Event): string {
    return (evenement.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  protected enregistrer(): void {
    const avant = this.presentation()?.publicationState;
    this.envoyer(
      this.service.rediger(this.projectId(), this.lang(), {
        title: this.titre(),
        summary: this.accroche(),
        body: this.texte(),
      }),
      (presentation) => {
        this.remplir(presentation);
        showToast({
          message:
            avant === 'PUBLISHED' && presentation.publicationState === 'READY'
              ? `Le texte ${this.enLettres()} est enregistré. Il quitte le portfolio jusqu’à sa republication.`
              : `Le texte ${this.enLettres()} est enregistré.`,
        });
      },
    );
  }

  protected async changer(transition: PublicationTransition): Promise<void> {
    const confirmee = await this.confirmer(transition);
    if (!confirmee) return;

    this.envoyer(
      this.service.transition(this.projectId(), this.lang(), transition),
      (presentation) =>
        showToast({
          message: `Le texte ${this.enLettres()} est ${LIBELLES_DES_ETATS_DE_PUBLICATION[presentation.publicationState].toLowerCase()}.`,
        }),
    );
  }

  /** Publier et dépublier changent ce que voit Internet : ils se confirment. */
  private async confirmer(transition: PublicationTransition): Promise<boolean> {
    if (transition === 'publish') {
      return !!(await this.confirmation.confirm({
        title: `Publier le texte ${this.enLettres()} ?`,
        description:
          'Il apparaîtra sur le portfolio public, tel qu’il est enregistré.',
        confirmLabel: 'Publier',
      }));
    }
    if (transition === 'unpublish' && this.etat() === 'PUBLISHED') {
      return !!(await this.confirmation.confirm({
        title: `Dépublier le texte ${this.enLettres()} ?`,
        description:
          'Il quitte le portfolio public. Son texte reste ici, non publié.',
        confirmLabel: 'Dépublier',
        destructive: true,
      }));
    }
    return true;
  }

  private envoyer(
    requete: Observable<PublicPresentation>,
    reussite: (presentation: PublicPresentation) => void,
  ): void {
    this.envoi.set(true);
    this.refus.set(null);
    requete.subscribe({
      next: (presentation) => {
        this.envoi.set(false);
        this.ecrite.emit(presentation);
        reussite(presentation);
      },
      error: (erreur: ErreurApi) => {
        this.envoi.set(false);
        this.refus.set(erreur);
      },
    });
  }

  private remplir(valeurs: Partial<PublicPresentationInput>): void {
    if (valeurs.title !== undefined) this.titre.set(valeurs.title);
    if (valeurs.summary !== undefined) this.accroche.set(valeurs.summary);
    if (valeurs.body !== undefined) this.texte.set(valeurs.body);
  }
}
