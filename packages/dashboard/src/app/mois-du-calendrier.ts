import { Injectable, computed, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { periodeDuMois } from '@personal-os/contracts';
import { map } from 'rxjs';
import { EspaceService } from './espace.service';
import { EventService } from './event.service';
import { PARAMETRE_DE_MOIS } from './modules-d-origine';
import { estUnMois, moisCourant } from './mois';

/**
 * Le mois que le Calendrier affiche, et ce qu'il en a lu : l'écran du mois et
 * le formulaire ouvert à côté le partagent. Fourni par le Calendrier, il vit
 * tant que l'on reste sous `/calendrier`, formulaire ouvert ou non.
 *
 * Le mois est celui du lien (`?mois=YYYY-MM`), ou le mois en cours : changer
 * de mois change l'URL, et un mois s'ouvre donc par son adresse.
 */
@Injectable()
export class MoisDuCalendrier {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Un mois mal formé dans le lien est ignoré : on ouvre le mois en cours. */
  readonly mois = toSignal(
    this.route.queryParamMap.pipe(
      map((parametres) => {
        const demande = parametres.get(PARAMETRE_DE_MOIS);
        return estUnMois(demande) ? demande : moisCourant();
      }),
    ),
    { requireSync: true },
  );

  readonly lecture = inject(EventService).lecture(() =>
    periodeDuMois(this.mois()),
  );
  readonly espaces = inject(EspaceService).lecture();

  /** Les occurrences du mois, par date : une série en a plusieurs. */
  readonly occurrences = computed(() =>
    [...(this.lecture.hasValue() ? this.lecture.value() : [])].sort(
      (gauche, droite) => gauche.startsAt.localeCompare(droite.startsAt),
    ),
  );

  /** Une écriture a abouti pendant une lecture, peut-être partie avant elle. */
  private relectureDue = false;

  constructor() {
    // La lecture en cours au moment d'une écriture est relue à son terme.
    effect(() => {
      const statut = this.lecture.status();
      if (this.relectureDue && (statut === 'resolved' || statut === 'error')) {
        this.relectureDue = false;
        untracked(() => this.lecture.reload());
      }
    });
  }

  /** Le nom d'un Espace, jamais son seul identifiant. */
  nomDeLEspace(id: string | null | undefined): string {
    const espaces = this.espaces.hasValue() ? this.espaces.value() : [];
    return espaces.find((espace) => espace.id === id)?.label ?? id ?? '';
  }

  /** Afficher un autre mois, sans fermer le formulaire ouvert à côté. */
  afficher(mois: string): Promise<boolean> {
    return this.router.navigate([], {
      queryParams: { [PARAMETRE_DE_MOIS]: mois },
      queryParamsHandling: 'merge',
    });
  }

  /** Revenir au mois affiché, formulaire fermé. */
  fermer(): Promise<boolean> {
    return this.router.navigate(['/calendrier'], {
      queryParams: { [PARAMETRE_DE_MOIS]: this.mois() },
    });
  }

  /**
   * Une écriture a abouti : le mois est relu, et non retouché sur place. Une
   * liste retouchée pendant une lecture remplacerait cette lecture par une
   * liste partielle, et l'Événement écrit n'est pas forcément du mois affiché.
   */
  relire(): void {
    if (!this.lecture.reload()) {
      this.relectureDue = true;
    }
  }
}
