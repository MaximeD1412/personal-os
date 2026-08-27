import { Component, computed, inject, signal } from '@angular/core';
import type { Scope, Trace } from '@personal-os/contracts';
import { HlmBadge } from '@personal-os/ui/badge';
import { HlmButton } from '@personal-os/ui/button';
import {
  HlmCard,
  HlmCardContent,
  HlmCardDescription,
  HlmCardHeader,
  HlmCardTitle,
} from '@personal-os/ui/card';
import { HlmInput } from '@personal-os/ui/input';
import { HlmLabel } from '@personal-os/ui/label';
import { HlmSelectImports } from '@personal-os/ui/select';
import { EspaceService } from './espace.service';
import { TraceService } from './trace.service';

/**
 * Le fil traceur du cloisonnement, vu de l'interface. Chaque Trace nomme
 * l'Espace auquel elle appartient, et la création oblige à en choisir un :
 * l'Espace est toujours explicite, jamais déduit d'un contexte (ADR 0014).
 */
@Component({
  selector: 'pos-traces',
  templateUrl: './traces.html',
  imports: [
    HlmBadge,
    HlmButton,
    HlmCard,
    HlmCardContent,
    HlmCardDescription,
    HlmCardHeader,
    HlmCardTitle,
    HlmInput,
    HlmLabel,
    ...HlmSelectImports,
  ],
})
export class Traces {
  private readonly espacesApi = inject(EspaceService);
  private readonly tracesApi = inject(TraceService);

  protected readonly espaces = signal<Scope[]>([]);
  protected readonly traces = signal<Trace[]>([]);
  protected readonly erreur = signal<string | null>(null);

  protected readonly libelle = signal('');
  protected readonly espaceChoisi = signal('');

  protected readonly pretACreer = computed(
    () => this.libelle().trim().length > 0 && this.espaceChoisi().length > 0,
  );

  constructor() {
    this.espacesApi.mesEspaces().subscribe({
      next: (espaces) => {
        this.espaces.set(espaces);
        this.espaceChoisi.set(espaces[0]?.id ?? '');
      },
      error: () => this.erreur.set("Les Espaces n'ont pas pu être lus."),
    });

    this.tracesApi.lister().subscribe({
      next: (traces) => this.traces.set(traces),
      error: () => this.erreur.set("Les Traces n'ont pas pu être lues."),
    });
  }

  /**
   * Une propriété-flèche et non une méthode : `hlm-select` la reçoit comme
   * `itemToString` et l'appelle détachée de l'instance.
   */
  protected readonly nomDeLEspace = (id: string | null | undefined): string =>
    this.espaces().find((espace) => espace.id === id)?.label ?? id ?? '';

  protected saisirLibelle(evenement: Event): void {
    this.libelle.set((evenement.target as HTMLInputElement).value);
  }

  /** `hlm-select` rend `null` quand il ne porte plus de choix. */
  protected choisirEspace(espaceId: string | null | undefined): void {
    this.espaceChoisi.set(espaceId ?? '');
  }

  protected creer(): void {
    if (!this.pretACreer()) {
      return;
    }

    this.tracesApi
      .creer({ label: this.libelle().trim(), scopeId: this.espaceChoisi() })
      .subscribe({
        next: (creee) => {
          this.traces.update((traces) => [creee, ...traces]);
          this.libelle.set('');
        },
        error: () => this.erreur.set("La Trace n'a pas pu être créée."),
      });
  }

  protected supprimer(id: string): void {
    this.tracesApi.supprimer(id).subscribe({
      next: () =>
        this.traces.update((traces) =>
          traces.filter((trace) => trace.id !== id),
        ),
      error: () => this.erreur.set("La Trace n'a pas pu être supprimée."),
    });
  }
}
