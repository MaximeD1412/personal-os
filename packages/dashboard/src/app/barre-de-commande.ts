import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import {
  BaseRouteReuseStrategy,
  Router,
  type ActivatedRouteSnapshot,
} from '@angular/router';
import type { CommandResolution } from '@personal-os/contracts';
import { DccmCommandBar, type DccmCommandFailure } from '@personal-os/ui/dccm';
import type { Subscription } from 'rxjs';
import { CommandBarService } from './command-bar.service';
import type { ErreurApi } from './erreur-api.interceptor';
import { PARAMETRE_DES_ECARTES } from './formulaire';

/** La marque, dans l'état de la navigation, d'un écran ouvert par la barre. */
const OUVERT_PAR_LA_BARRE = 'ouvertParLaBarre';

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
      (closing)="abandonner()"
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
          this.ouvrir(resolution);
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

  /**
   * Ouvre l'écran prérempli, toujours dans une instance neuve (voir
   * `ReutilisationDesEcrans`), même s'il est déjà affiché. Les paramètres que
   * le résolveur a écartés n'ont plus de valeur dans l'URL : ils y passent
   * par leur nom, que le formulaire signale (`prefillDepuisRequete`).
   */
  private ouvrir({
    url,
    ignored,
  }: Extract<CommandResolution, { kind: 'action' }>): void {
    const cible = this.router.parseUrl(url);
    if (ignored.length > 0) {
      cible.queryParams = {
        ...cible.queryParams,
        [PARAMETRE_DES_ECARTES]: ignored,
      };
    }
    void this.router.navigateByUrl(cible, {
      onSameUrlNavigation: 'reload',
      state: { [OUVERT_PAR_LA_BARRE]: true },
    });
  }

  /**
   * Dès que la barre commence à se fermer, la résolution en cours est
   * abandonnée : sa réponse, même arrivée pendant l'animation de sortie,
   * n'ouvre plus rien.
   */
  protected abandonner(): void {
    this.resolution?.unsubscribe();
    this.resolution = null;
  }

  /** La barre fermée repart vierge. */
  protected oublier(): void {
    this.abandonner();
    this.enCours.set(false);
    this.echec.set(null);
    this.erreur.set(null);
  }
}

/**
 * La réutilisation des écrans par le routeur, sauf celui qu'ouvre la barre.
 *
 * Angular garde le composant d'une route quand seule la requête change, or un
 * formulaire se préremplit une fois, à sa création. Depuis
 * `/calendrier/evenements/nouveau?title=Yoga`, une commande vers le même
 * formulaire avec `title=Dentiste` garderait « Yoga ». L'écran feuille d'une
 * navigation de la barre est donc toujours recréé ; ses parents (le
 * Calendrier autour du formulaire) restent en place.
 */
export class ReutilisationDesEcrans extends BaseRouteReuseStrategy {
  // Le routeur dépend de cette stratégie : il ne se lit qu'à l'usage.
  private readonly injecteur = inject(Injector);

  override shouldReuseRoute(
    futur: ActivatedRouteSnapshot,
    courant: ActivatedRouteSnapshot,
  ): boolean {
    return (
      super.shouldReuseRoute(futur, courant) &&
      !(futur.firstChild === null && this.navigationDeLaBarre())
    );
  }

  private navigationDeLaBarre(): boolean {
    const etat = this.injecteur.get(Router).currentNavigation()?.extras.state;
    return etat?.[OUVERT_PAR_LA_BARRE] === true;
  }
}
