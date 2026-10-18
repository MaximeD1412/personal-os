import { Injectable, inject, signal } from '@angular/core';
import type { Scope } from '@personal-os/contracts';
import { EspaceService } from './espace.service';

/**
 * L'Espace pré-choisi pour une création, que le sélecteur de la TopBar
 * retient et que les formulaires lisent pour préremplir leur champ Espace.
 *
 * Il ne filtre rien : ce que l'on voit est ce que l'API renvoie (ADR 0014,
 * 0028). Et il ne fait qu'une proposition : l'Espace reste un champ explicite
 * du formulaire, que l'on voit et que l'on change.
 */
@Injectable({ providedIn: 'root' })
export class EspaceCourant {
  private readonly api = inject(EspaceService);

  /** Les Espaces que le compte atteint, tels que l'API les renvoie. */
  readonly espaces = signal<readonly Scope[]>([]);
  /** L'Espace pré-choisi ; nul tant que les Espaces ne sont pas lus. */
  readonly espace = signal<Scope | null>(null);

  /**
   * Lit les Espaces et pré-choisit l'Espace personnel, faute d'un choix
   * encore valable.
   */
  charger(): void {
    this.api.mesEspaces().subscribe({
      next: (espaces) => {
        this.espaces.set(espaces);
        const retenu = this.espace();
        if (!retenu || !espaces.some(({ id }) => id === retenu.id)) {
          this.espace.set(
            espaces.find(({ kind }) => kind === 'PERSONAL') ??
              espaces[0] ??
              null,
          );
        }
      },
      // Sans Espaces, pas de sélecteur : les formulaires gardent leur champ.
      error: () => undefined,
    });
  }

  choisir(id: string | null): void {
    const espace = this.espaces().find((candidat) => candidat.id === id);
    if (espace) {
      this.espace.set(espace);
    }
  }
}
