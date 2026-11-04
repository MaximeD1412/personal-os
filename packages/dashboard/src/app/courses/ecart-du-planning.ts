import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matPlaylistAddOutline } from '@ng-icons/material-symbols/outline';
import type { MealPlanStatus } from '@personal-os/contracts';
import { HlmAlertImports } from '@personal-os/ui/alert';
import { HlmButton } from '@personal-os/ui/button';
import { DccmConfirm, DccmState } from '@personal-os/ui/dccm';
import { showToast } from '@personal-os/ui/sonner';
import { ErreurApi } from '../erreur-api.interceptor';
import { ShoppingListService } from './shopping-list.service';

/** « a, b et c » : la cible ES du tableau de bord n'a pas `Intl.ListFormat`. */
function enumerer(noms: readonly string[]): string {
  return noms.length < 2
    ? (noms[0] ?? '')
    : `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`;
}

/**
 * L'écart entre un Planning de repas et ses listes figées (ADR 0012), en
 * bandeau, sur la Liste de courses et sur le planning : il n'apparaît que si
 * un Ingrédient manque. Les listes déjà produites ne changent jamais ; le
 * bandeau propose une liste de complément, des seuls manquants, puis l'ouvre.
 *
 * Un planning ouvert a aussi son écart : on le voit pendant qu'on le modifie.
 * Le complément ne se produit que d'un planning arrêté : ouvert, le bandeau le
 * dit au lieu de le proposer. Sans statut connu (la Liste de courses ne porte
 * que l'identifiant de son planning), il le propose, et l'API tranche.
 *
 * Chaque nouvelle valeur de `planning` relit l'écart.
 */
@Component({
  selector: 'pos-ecart-du-planning',
  imports: [NgIcon, HlmAlertImports, HlmButton, DccmState],
  providers: [provideIcons({ matPlaylistAddOutline })],
  templateUrl: './ecart-du-planning.html',
  // Sans écart, rien ne prend de place dans la colonne de l'écran.
  host: { class: 'contents' },
})
export class EcartDuPlanning {
  private readonly service = inject(ShoppingListService);
  private readonly confirmation = inject(DccmConfirm);
  private readonly router = inject(Router);

  /** Le planning dont on compare les listes ; aucun, rien n'est lu. */
  readonly planning = input.required<{
    id: string;
    status?: MealPlanStatus;
  } | null>();

  protected readonly lecture = this.service.ecart(this.planning);
  protected readonly manquants = computed(() =>
    this.lecture.hasValue() ? (this.lecture.value()?.missing ?? []) : [],
  );

  /** Le complément se propose, sauf d'un planning qu'on sait ouvert. */
  protected readonly productible = computed(
    () => this.planning()?.status !== 'OPEN',
  );

  protected readonly titre = computed(() => {
    const n = this.manquants().length;
    return n === 1
      ? 'Le planning a changé : 1 ingrédient manque.'
      : `Le planning a changé : ${n} ingrédients manquent.`;
  });
  protected readonly description = computed(() => {
    const manquants = this.manquants();
    const noms = enumerer(
      manquants.map(({ ingredient }) => ingredient.displayName),
    );
    const suite = this.productible()
      ? 'Elles ne changent pas : le complément part sur une nouvelle liste.'
      : 'Elles ne changent pas : le complément se produit sur une nouvelle liste, une fois le planning arrêté.';
    return `${manquants.length === 1 ? 'Manque' : 'Manquent'} aux listes déjà produites : ${noms}. ${suite}`;
  });

  protected readonly envoi = signal(false);
  /** Le refus de la production, en bandeau : jamais en toast seul. */
  protected readonly refus = signal<ErreurApi | null>(null);

  protected async produire(): Promise<void> {
    const planning = this.planning();
    const n = this.manquants().length;
    if (!planning || n === 0 || !this.productible() || this.envoi()) return;
    const confirme = await this.confirmation.confirm({
      title: 'Produire une liste de complément ?',
      description: `${n === 1 ? "L'ingrédient qui manque part" : `Les ${n} ingrédients qui manquent partent`} sur une nouvelle liste. Les listes déjà produites ne changent pas.`,
      confirmLabel: 'Produire le complément',
    });
    if (!confirme) return;

    this.envoi.set(true);
    this.refus.set(null);
    this.service.produireLeComplement(planning.id).subscribe({
      next: (liste) => {
        this.envoi.set(false);
        // Le complément couvre l'écart : on le relit, l'écran a pu rester.
        this.lecture.reload();
        showToast({
          tone: 'success',
          message: 'La liste de complément est produite.',
        });
        void this.router.navigate(['/courses', liste.id]);
      },
      error: (erreur: ErreurApi) => {
        this.envoi.set(false);
        this.refus.set(erreur);
        this.lecture.reload();
      },
    });
  }
}
