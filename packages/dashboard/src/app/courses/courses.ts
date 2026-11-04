import {
  Component,
  computed,
  ElementRef,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matAddOutline,
  matDeleteOutline,
  matShoppingCartOutline,
} from '@ng-icons/material-symbols/outline';
import {
  designation,
  type Ingredient,
  type ShoppingList,
  type ShoppingListItem,
  type ShoppingListItemInput,
  zShoppingListItemInput,
} from '@personal-os/contracts';
import { HlmAlertImports } from '@personal-os/ui/alert';
import { HlmBadge } from '@personal-os/ui/badge';
import { HlmButton } from '@personal-os/ui/button';
import { HlmCardImports } from '@personal-os/ui/card';
import {
  DccmConfirm,
  DccmListRow,
  DccmPageHeader,
  DccmState,
  stateOf,
  type DccmCrumb,
  type DccmStateStatus,
} from '@personal-os/ui/dccm';
import { HlmFieldImports } from '@personal-os/ui/field';
import { HlmInputImports } from '@personal-os/ui/input';
import { showToast } from '@personal-os/ui/sonner';
import { map } from 'rxjs';
import { formaterInstant, formaterJour } from '../dates';
import { ErreurApi } from '../erreur-api.interceptor';
import { erreursDeChamp, prefillDepuisRequete } from '../formulaire';
import { IngredientService } from '../repas/ingredient.service';
import { quantiteCanonique, UNITES_CANONIQUES } from '../repas/quantite';
import { ShoppingListService } from './shopping-list.service';

/** Le fil d'Ariane des écrans de courses. */
export const FIL_DES_COURSES: readonly DccmCrumb[] = [
  { label: 'Cuisine' },
  { label: 'Courses', link: '/courses' },
];

/** Le catalogue ne se cherche qu'à partir de deux lettres. */
const LETTRES_POUR_CHERCHER = 2;

const NOMBRE = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });

/** La quantité d'un article : en Unité canonique, ou un compte pour un libellé. */
export function quantiteDArticle(
  article: Pick<ShoppingListItem, 'quantity' | 'unit'>,
): string | undefined {
  if (article.quantity === null) return undefined;
  return article.unit
    ? quantiteCanonique(article.quantity, article.unit)
    : `×\u00a0${NOMBRE.format(article.quantity)}`;
}

/** « Semaine du 2 novembre », pour nommer une liste par son planning. */
function nomDeListe(liste: ShoppingList): string {
  return liste.mealPlan
    ? `Semaine du ${formaterJour(liste.mealPlan.week, { day: 'numeric', month: 'long' })}`
    : `Liste du ${formaterInstant(liste.producedAt, { day: 'numeric', month: 'long' })}`;
}

/**
 * La Liste de courses, à cocher au magasin : `/courses` montre la plus
 * récente des listes ouvertes, `/courses/:id` une liste donnée. Elle est
 * figée à sa production (ADR 0012) : ses articles viennent du planning, puis
 * des ajouts manuels, et rien ne la recalcule.
 *
 * Cocher un article s'enregistre en un geste, sans bouton. L'ajout manuel,
 * en tête de liste, prend un Ingrédient du catalogue (la recherche le
 * propose) ou un simple libellé, et s'envoie par Entrée. Retirer un ajout
 * manuel se confirme ; un article du planning ne se retire pas.
 */
@Component({
  imports: [
    RouterLink,
    NgIcon,
    HlmAlertImports,
    HlmBadge,
    HlmButton,
    HlmCardImports,
    HlmFieldImports,
    HlmInputImports,
    DccmListRow,
    DccmPageHeader,
    DccmState,
  ],
  providers: [provideIcons({ matAddOutline, matDeleteOutline })],
  templateUrl: './courses.html',
})
export class Courses {
  private readonly service = inject(ShoppingListService);
  private readonly ingredients = inject(IngredientService);
  private readonly confirmation = inject(DccmConfirm);

  protected readonly iconeVide = matShoppingCartOutline;
  protected readonly designation = designation;
  protected readonly quantiteDArticle = quantiteDArticle;
  protected readonly nomDeListe = nomDeListe;

  /** La liste du lien ; aucune sur `/courses`, qui montre la plus récente. */
  private readonly idDemande = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('id'))),
    { requireSync: true },
  );

  protected readonly ouvertes = this.service.ouvertes();
  private readonly demandee = this.service.liste(this.idDemande);

  /** La lecture qui porte la liste affichée. */
  protected readonly lecture = computed(() =>
    this.idDemande() ? this.demandee : this.ouvertes,
  );
  protected readonly etat = computed<DccmStateStatus>(() =>
    this.idDemande()
      ? stateOf(this.demandee, () => false)
      : stateOf(this.ouvertes, (listes) => listes.length === 0),
  );

  protected readonly liste = computed<ShoppingList | undefined>(() => {
    if (this.idDemande()) {
      return this.demandee.hasValue() ? this.demandee.value() : undefined;
    }
    return this.ouvertes.hasValue() ? this.ouvertes.value()[0] : undefined;
  });
  protected readonly ouverte = computed(() => this.liste()?.status === 'OPEN');
  /** Les autres listes ouvertes, où l'on peut passer. */
  protected readonly autres = computed(() => {
    const affichee = this.liste()?.id;
    return (this.ouvertes.hasValue() ? this.ouvertes.value() : []).filter(
      ({ id }) => id !== affichee,
    );
  });

  protected readonly duPlanning = computed(() =>
    (this.liste()?.items ?? []).filter(({ origin }) => origin === 'PLAN'),
  );
  protected readonly ajouts = computed(() =>
    (this.liste()?.items ?? []).filter(({ origin }) => origin === 'MANUAL'),
  );
  protected readonly achetes = computed(
    () => (this.liste()?.items ?? []).filter(({ checked }) => checked).length,
  );

  protected readonly sousTitre = computed(() => {
    const liste = this.liste();
    if (!liste) {
      return 'Figée depuis un planning de repas arrêté, à cocher en magasin.';
    }
    const quand = { day: 'numeric', month: 'long' } as const;
    if (liste.status === 'CLOSED' && liste.closedAt) {
      return `${nomDeListe(liste)} · close le ${formaterInstant(liste.closedAt, quand)} : elle ne se modifie plus.`;
    }
    const produite = formaterInstant(liste.producedAt, {
      ...quand,
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${nomDeListe(liste)} · figée le ${produite}, à cocher en magasin. Une modification du planning ne la change plus.`;
  });

  /** Sur une liste close, la case ne se coche plus : l'achat se lit dans la ligne. */
  protected meta(article: ShoppingListItem): string | undefined {
    const quantite = quantiteDArticle(article);
    if (this.ouverte() || !article.checked) return quantite;
    return quantite ? `${quantite} · acheté` : 'Acheté';
  }

  protected readonly fil: readonly DccmCrumb[] = [
    FIL_DES_COURSES[0],
    { label: 'Courses' },
  ];

  /** Le refus d'un geste sur la liste (cocher, retirer), en bandeau. */
  protected readonly refus = signal<ErreurApi | null>(null);

  // L'ajout manuel, prérempli par le lien (ADR 0030) : `label`, ou
  // `ingredientId`, et `quantity`. Il n'enregistre rien de lui-même.
  private readonly champ =
    viewChild<ElementRef<HTMLInputElement>>('champDAjout');
  private readonly prefill = prefillDepuisRequete(
    zShoppingListItemInput,
    inject(ActivatedRoute).snapshot.queryParamMap,
  );
  /**
   * L'Ingrédient du lien, lu pour le nommer. La saisie l'emporte : dès qu'on
   * tape ou choisit un article, la lecture est abandonnée, et une réponse
   * tardive ne remplace plus rien.
   */
  private readonly idDuLien = signal(this.prefill.valeurs.ingredientId ?? null);
  protected readonly duLien = this.ingredients.ingredient(this.idDuLien);
  /** Seul un 404 dit que l'Ingrédient du lien n'existe pas. */
  private readonly lienInconnu = signal(false);
  /** Une autre erreur s'affiche telle quelle, et sa lecture se relance. */
  protected readonly echecDuLien = computed(() => {
    const erreur = this.duLien.error();
    return erreur && !(erreur instanceof ErreurApi && erreur.status === 404)
      ? erreur
      : null;
  });
  protected readonly choisi = signal<Ingredient | null>(null);
  protected readonly texte = signal(this.prefill.valeurs.label ?? '');
  protected readonly quantite = signal<number | null>(
    this.prefill.valeurs.quantity ?? null,
  );
  /** Les valeurs du lien écartées : par le contrat, ou un Ingrédient inconnu. */
  protected readonly ignores = computed(() => [
    ...this.prefill.ignores,
    ...(this.lienInconnu()
      ? [`ingredientId=${this.prefill.valeurs.ingredientId}`]
      : []),
  ]);

  constructor() {
    // L'Ingrédient du lien, une fois lu, devient l'article choisi.
    effect(() => {
      const erreur = this.duLien.error();
      const lu = this.duLien.hasValue() ? this.duLien.value() : undefined;
      untracked(() => {
        if (lu) {
          this.choisi.set(lu);
          this.texte.set(lu.displayName);
          this.idDuLien.set(null);
        } else if (erreur instanceof ErreurApi && erreur.status === 404) {
          this.lienInconnu.set(true);
          this.idDuLien.set(null);
        }
      });
    });
  }

  protected readonly envoi = signal(false);
  protected readonly refusDAjout = signal<ErreurApi | null>(null);
  protected readonly erreursDAjout = computed(() =>
    erreursDeChamp(this.refusDAjout()),
  );
  /** Un refus qui ne vise aucun champ s'affiche en bandeau, au-dessus. */
  protected readonly refusSansChamp = computed(() => {
    const refus = this.refusDAjout();
    return refus && !refus.fields?.length ? refus : null;
  });

  private readonly recherche = computed(() => this.texte().trim());
  protected readonly cherche = computed(
    () => !this.choisi() && this.recherche().length >= LETTRES_POUR_CHERCHER,
  );
  private readonly catalogue = this.ingredients.catalogue(
    this.recherche,
    this.cherche,
  );
  /** Les Ingrédients du catalogue que le texte saisi désigne. */
  protected readonly suggestions = computed(() =>
    this.cherche() && this.catalogue.hasValue()
      ? this.catalogue.value().slice(0, 5)
      : [],
  );
  protected readonly unite = computed(() => {
    const choisi = this.choisi();
    return choisi ? UNITES_CANONIQUES[choisi.canonicalUnit] : null;
  });

  /**
   * L'état voulu des articles dont un cochage est en route : un seul envoi à
   * la fois par article, le dernier geste gagne.
   */
  private readonly voulus = new Map<string, boolean>();
  private readonly enRoute = new Set<string>();

  protected uniteDe(ingredient: Ingredient): string {
    return `En ${UNITES_CANONIQUES[ingredient.canonicalUnit]}`;
  }

  protected saisirLeTexte(evenement: Event): void {
    this.idDuLien.set(null);
    this.texte.set((evenement.target as HTMLInputElement).value);
    this.choisi.set(null);
    this.refusDAjout.set(null);
  }

  protected saisirLaQuantite(evenement: Event): void {
    const champ = evenement.target as HTMLInputElement;
    this.quantite.set(
      champ.value === '' || Number.isNaN(champ.valueAsNumber)
        ? null
        : champ.valueAsNumber,
    );
  }

  protected choisir(ingredient: Ingredient): void {
    this.idDuLien.set(null);
    this.choisi.set(ingredient);
    this.texte.set(ingredient.displayName);
    this.champ()?.nativeElement.focus();
  }

  /** Revient au simple libellé : le texte reste, l'Ingrédient part. */
  protected oublierLIngredient(): void {
    this.choisi.set(null);
    this.champ()?.nativeElement.focus();
  }

  protected ajouter(evenement: Event): void {
    evenement.preventDefault();
    const liste = this.liste();
    const texte = this.recherche();
    if (!liste || !texte || this.envoi()) return;

    const choisi = this.choisi();
    const quantite = this.quantite();
    const saisie: ShoppingListItemInput = {
      ...(choisi ? { ingredientId: choisi.id } : { label: texte }),
      ...(quantite === null ? {} : { quantity: quantite }),
    };

    this.envoi.set(true);
    this.refusDAjout.set(null);
    this.service.ajouter(liste.id, saisie).subscribe({
      next: (article) => {
        this.envoi.set(false);
        this.modifier(liste.id, (articles) => [...articles, article]);
        this.texte.set('');
        this.quantite.set(null);
        this.choisi.set(null);
        this.champ()?.nativeElement.focus();
        showToast({
          tone: 'success',
          message: `«\u00a0${designation(article)}\u00a0» est ajouté à la liste.`,
        });
      },
      error: (erreur: ErreurApi) => {
        this.envoi.set(false);
        this.refusDAjout.set(erreur);
      },
    });
  }

  /** Coche ou décoche à l'instant ; l'envoi suit, et le refus revient en bandeau. */
  protected cocher(article: ShoppingListItem, coche: boolean): void {
    const liste = this.liste();
    if (!liste) return;
    this.refus.set(null);
    this.remplacer(liste.id, { ...article, checked: coche });
    this.voulus.set(article.id, coche);
    if (!this.enRoute.has(article.id)) {
      this.envoyerLeCochage(liste.id, article.id);
    }
  }

  protected async retirer(article: ShoppingListItem): Promise<void> {
    const liste = this.liste();
    if (!liste) return;
    const nom = designation(article);
    const confirme = await this.confirmation.confirm({
      title: `Retirer «\u00a0${nom}\u00a0» de la liste ?`,
      description: 'Cet ajout manuel disparaît de la liste de courses.',
      confirmLabel: "Retirer l'article",
      destructive: true,
    });
    if (!confirme) return;

    this.refus.set(null);
    this.service.retirer(liste.id, article.id).subscribe({
      next: () => {
        this.modifier(liste.id, (articles) =>
          articles.filter(({ id }) => id !== article.id),
        );
        showToast({
          tone: 'success',
          message: `«\u00a0${nom}\u00a0» est retiré de la liste.`,
        });
      },
      error: (erreur: ErreurApi) => {
        this.refus.set(erreur);
        this.lecture().reload();
      },
    });
  }

  private envoyerLeCochage(listeId: string, articleId: string): void {
    const coche = this.voulus.get(articleId) ?? false;
    this.enRoute.add(articleId);
    this.service.cocher(listeId, articleId, coche).subscribe({
      next: (article) => {
        this.enRoute.delete(articleId);
        // Un geste arrivé pendant l'envoi part à son tour.
        if (this.voulus.get(articleId) !== article.checked) {
          this.envoyerLeCochage(listeId, articleId);
          return;
        }
        this.voulus.delete(articleId);
        this.remplacer(listeId, article);
      },
      error: (erreur: ErreurApi) => {
        this.enRoute.delete(articleId);
        this.voulus.delete(articleId);
        this.refus.set(erreur);
        this.lecture().reload();
      },
    });
  }

  private remplacer(listeId: string, article: ShoppingListItem): void {
    this.modifier(listeId, (articles) =>
      articles.map((un) => (un.id === article.id ? article : un)),
    );
  }

  /** Change les articles de la liste là où l'écran la lit, si elle y est encore. */
  private modifier(
    listeId: string,
    changer: (articles: ShoppingListItem[]) => ShoppingListItem[],
  ): void {
    const changerLaListe = (liste: ShoppingList) =>
      liste.id === listeId ? { ...liste, items: changer(liste.items) } : liste;
    if (this.ouvertes.hasValue()) {
      this.ouvertes.set(this.ouvertes.value().map(changerLaListe));
    }
    if (this.demandee.hasValue()) {
      const liste = this.demandee.value();
      if (liste) this.demandee.set(changerLaListe(liste));
    }
  }
}
