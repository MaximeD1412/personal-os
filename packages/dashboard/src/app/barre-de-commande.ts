import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { DccmCommandBar, type DccmCommandFailure } from '@personal-os/ui/dccm';
import type { Subscription } from 'rxjs';
import { CommandBarService } from './command-bar.service';
import type { ErreurApi } from './erreur-api.interceptor';

/**
 * La barre de commande du tableau de bord : la palette `DccmCommandBar`,
 * reliée à `POST /command-bar/resolve`. Une action connue ferme la barre et
 * ouvre son écran prérempli, qui n'enregistre rien de lui-même ; sinon la
 * barre le dit et propose l'écran le plus proche.
 */
@Component({
  selector: 'pos-barre-de-commande',
  imports: [DccmCommandBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <dccm-command-bar
      [pending]="enCours()"
      [failure]="echec()"
      [error]="erreur()"
      (submitted)="resoudre($event)"
      (closed)="oublier()"
    />
  `,
})
export class BarreDeCommande {
  private readonly commandes = inject(CommandBarService);
  private readonly router = inject(Router);
  private readonly barre = viewChild.required(DccmCommandBar);

  protected readonly enCours = signal(false);
  protected readonly echec = signal<DccmCommandFailure | null>(null);
  protected readonly erreur = signal<string | null>(null);
  private resolution: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.resolution?.unsubscribe());
  }

  /** Ouvre la barre (le déclencheur de la `TopBar` ou du `MobileHeader`). */
  open(): void {
    this.barre().open();
  }

  protected resoudre(texte: string): void {
    this.echec.set(null);
    this.erreur.set(null);
    this.enCours.set(true);
    this.resolution = this.commandes.resoudre(texte).subscribe({
      next: (resolution) => {
        this.enCours.set(false);
        if (resolution.kind === 'action') {
          this.barre().close();
          void this.router.navigateByUrl(resolution.url);
        } else {
          this.echec.set({ nearestUrl: resolution.nearestUrl });
        }
      },
      error: (erreur: ErreurApi) => {
        this.enCours.set(false);
        this.erreur.set(erreur.message);
      },
    });
  }

  /** La barre fermée repart vierge ; une réponse tardive n'y change rien. */
  protected oublier(): void {
    this.resolution?.unsubscribe();
    this.resolution = null;
    this.enCours.set(false);
    this.echec.set(null);
    this.erreur.set(null);
  }
}
