import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matAddOutline,
  matDeleteOutline,
  matStarOutline,
} from '@ng-icons/material-symbols/outline';
import {
  FORMES_DE_PRODUIT,
  LIBELLES_DES_FORMES,
  type Ingredient,
  type Product,
  type ProductForm,
  type ProductInput,
} from '@personal-os/contracts';
import { HlmAlertImports } from '@personal-os/ui/alert';
import { HlmBadge } from '@personal-os/ui/badge';
import { HlmButton } from '@personal-os/ui/button';
import { HlmCardImports } from '@personal-os/ui/card';
import {
  DccmConfirm,
  DccmListRow,
  DccmState,
  stateOf,
} from '@personal-os/ui/dccm';
import { HlmFieldImports } from '@personal-os/ui/field';
import { HlmInputImports } from '@personal-os/ui/input';
import { HlmSelectImports } from '@personal-os/ui/select';
import { showToast } from '@personal-os/ui/sonner';
import type { ErreurApi } from '../erreur-api.interceptor';
import { erreursDeChamp } from '../formulaire';
import { ProductService } from './product.service';
import { quantiteCanonique, UNITES_CANONIQUES } from './quantite';

/** Un Produit se nomme par sa marque, sinon par sa forme. */
function nomDuProduit(produit: Product): string {
  return produit.brand ?? LIBELLES_DES_FORMES[produit.form];
}

/**
 * Les Produits d'un Ingrédient, sur sa fiche (CUISINE-12) : les façons
 * concrètes de l'acheter, chacune avec son conditionnement, dans l'Unité
 * canonique de l'Ingrédient. L'un d'eux peut être le Produit préféré : la
 * Liste de courses compte alors l'Ingrédient en conditionnements de ce
 * Produit. Un Produit s'ajoute en bas de la section et se retire après
 * confirmation ; retirer le préféré retire la préférence.
 *
 * Le choix du préféré rend l'Ingrédient à jour : la fiche le reprend.
 */
@Component({
  selector: 'pos-produits-de-l-ingredient',
  imports: [
    NgIcon,
    HlmAlertImports,
    HlmBadge,
    HlmButton,
    HlmCardImports,
    HlmFieldImports,
    HlmInputImports,
    HlmSelectImports,
    DccmListRow,
    DccmState,
  ],
  providers: [
    provideIcons({ matAddOutline, matDeleteOutline, matStarOutline }),
  ],
  templateUrl: './produits-de-l-ingredient.html',
})
export class ProduitsDeLIngredient {
  private readonly service = inject(ProductService);
  private readonly confirmation = inject(DccmConfirm);

  readonly ingredient = input.required<Ingredient>();
  /** L'Ingrédient tel que le serveur le rend après un changement de préféré. */
  readonly ingredientChange = output<Ingredient>();

  /**
   * Un changement de préféré rend un nouvel Ingrédient, de même identifiant :
   * la lecture ne suit que l'identifiant, pour ne pas relire les Produits.
   */
  private readonly ingredientId = computed(() => this.ingredient().id);
  protected readonly lecture = this.service.produits(this.ingredientId);
  /** Sans Produit, la section le dit d'une ligne : l'ajout reste dessous. */
  protected readonly etat = computed(() => stateOf(this.lecture, () => false));
  protected readonly produits = computed(() =>
    this.lecture.hasValue() ? this.lecture.value() : [],
  );

  protected readonly nomDuProduit = nomDuProduit;
  protected readonly unite = computed(
    () => UNITES_CANONIQUES[this.ingredient().canonicalUnit],
  );

  /** « Conserve · boîte de 400 g ». */
  protected conditionnement(produit: Product): string {
    const contenance = quantiteCanonique(
      produit.packageQuantity,
      this.ingredient().canonicalUnit,
    );
    return `${LIBELLES_DES_FORMES[produit.form]} · ${produit.packageLabel} de ${contenance}`;
  }

  protected estPrefere(produit: Product): boolean {
    return this.ingredient().preferredProductId === produit.id;
  }

  /** Le refus d'un geste sur un Produit (préférer, retirer), en bandeau. */
  protected readonly refus = signal<ErreurApi | null>(null);
  protected readonly enCours = signal<string | null>(null);

  protected preferer(produit: Product | null): void {
    const ingredient = this.ingredient();
    this.refus.set(null);
    this.enCours.set(produit?.id ?? ingredient.preferredProductId);
    this.service.preferer(ingredient.id, produit?.id ?? null).subscribe({
      next: (aJour) => {
        this.enCours.set(null);
        this.ingredientChange.emit(aJour);
        showToast({
          tone: 'success',
          message: produit
            ? `«\u00a0${nomDuProduit(produit)}\u00a0» est le produit préféré.`
            : "L'ingrédient n'a plus de produit préféré.",
        });
      },
      error: (erreur: ErreurApi) => {
        this.enCours.set(null);
        this.refus.set(erreur);
      },
    });
  }

  protected async retirer(produit: Product): Promise<void> {
    const nom = nomDuProduit(produit);
    const prefere = this.estPrefere(produit);
    const confirme = await this.confirmation.confirm({
      title: `Retirer le produit «\u00a0${nom}\u00a0» ?`,
      description: prefere
        ? "C'est le produit préféré : les prochaines listes de courses compteront l'ingrédient dans son unité. Les listes déjà produites gardent leurs conditionnements."
        : 'Les listes de courses déjà produites gardent leurs conditionnements.',
      confirmLabel: 'Retirer le produit',
      destructive: true,
    });
    if (!confirme) return;

    this.refus.set(null);
    this.enCours.set(produit.id);
    this.service.retirer(produit.id).subscribe({
      next: () => {
        this.enCours.set(null);
        this.lecture.set(this.produits().filter(({ id }) => id !== produit.id));
        if (prefere) {
          this.ingredientChange.emit({
            ...this.ingredient(),
            preferredProductId: null,
          });
        }
        showToast({
          tone: 'success',
          message: `«\u00a0${nom}\u00a0» est retiré.`,
        });
      },
      error: (erreur: ErreurApi) => {
        this.enCours.set(null);
        this.refus.set(erreur);
        this.lecture.reload();
      },
    });
  }

  // L'ajout d'un Produit. La forme et la contenance n'ont pas de valeur par
  // défaut : le contrat les exige, et son refus pointe le champ.
  protected readonly formes = FORMES_DE_PRODUIT.map((valeur) => ({
    valeur,
    libelle: LIBELLES_DES_FORMES[valeur],
  }));
  protected readonly nomDeLaForme = (
    forme: ProductForm | null | undefined,
  ): string => (forme ? LIBELLES_DES_FORMES[forme] : '');
  protected readonly marque = signal('');
  protected readonly forme = signal<ProductForm | null>(null);
  protected readonly contenance = signal<number | null>(null);
  protected readonly libelle = signal('');
  protected readonly envoi = signal(false);
  protected readonly refusDAjout = signal<ErreurApi | null>(null);
  protected readonly erreurs = computed(() =>
    erreursDeChamp(this.refusDAjout()),
  );
  /** Un refus qui ne vise aucun champ s'affiche en bandeau. */
  protected readonly refusSansChamp = computed(() => {
    const refus = this.refusDAjout();
    return refus && !refus.fields?.length ? refus : null;
  });

  protected saisir(champ: 'marque' | 'libelle', evenement: Event): void {
    this[champ].set((evenement.target as HTMLInputElement).value);
  }

  protected saisirLaContenance(evenement: Event): void {
    const champ = evenement.target as HTMLInputElement;
    this.contenance.set(
      champ.value === '' || Number.isNaN(champ.valueAsNumber)
        ? null
        : champ.valueAsNumber,
    );
  }

  protected choisirLaForme(valeur: unknown): void {
    this.forme.set(
      FORMES_DE_PRODUIT.includes(valeur as ProductForm)
        ? (valeur as ProductForm)
        : null,
    );
  }

  protected ajouter(evenement: Event): void {
    evenement.preventDefault();
    if (this.envoi()) return;
    const forme = this.forme();
    const contenance = this.contenance();
    const marque = this.marque().trim();
    // Une saisie incomplète part telle quelle : le contrat dit ce qui manque.
    const saisie = {
      ingredientId: this.ingredient().id,
      brand: marque || null,
      ...(forme ? { form: forme } : {}),
      ...(contenance === null ? {} : { packageQuantity: contenance }),
      packageLabel: this.libelle(),
    };

    this.envoi.set(true);
    this.refusDAjout.set(null);
    this.service.creer(saisie as ProductInput).subscribe({
      next: (produit) => {
        this.envoi.set(false);
        this.lecture.set([...this.produits(), produit]);
        this.marque.set('');
        this.forme.set(null);
        this.contenance.set(null);
        this.libelle.set('');
        showToast({
          tone: 'success',
          message: `«\u00a0${nomDuProduit(produit)}\u00a0» est ajouté aux produits.`,
        });
      },
      error: (erreur: ErreurApi) => {
        this.envoi.set(false);
        this.refusDAjout.set(erreur);
      },
    });
  }
}
