import { Component, computed, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import type { CurrentUser, HealthProbeSnapshot } from '@personal-os/contracts';
import { HlmButton } from '@personal-os/ui/button';
import { AuthService } from './auth.service';
import { HealthService } from './health.service';
import { Redirection } from './redirection';

@Component({
  imports: [RouterModule, HlmButton],
  selector: 'pos-root',
  templateUrl: './app.html',
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly health = inject(HealthService);
  private readonly redirection = inject(Redirection);

  protected readonly utilisateur = signal<CurrentUser | null>(null);
  protected readonly probe = signal<HealthProbeSnapshot | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly nom = computed(() => {
    const compte = this.utilisateur();
    return compte ? (compte.displayName ?? compte.email) : null;
  });

  constructor() {
    this.auth.moi().subscribe({
      next: (compte) => this.utilisateur.set(compte),
      error: () => undefined,
    });

    this.health.read().subscribe({
      next: (response) => this.probe.set(response.database),
      error: () => this.error.set("L'API n'a pas pu lire la sonde en base."),
    });
  }

  protected seDeconnecter(): void {
    this.auth.seDeconnecter().subscribe({
      next: ({ endSessionUrl }) => this.redirection.vers(endSessionUrl ?? '/'),
      error: () => this.redirection.vers('/'),
    });
  }
}
