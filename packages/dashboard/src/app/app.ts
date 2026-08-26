import { Component, computed, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import type { CurrentUser, HealthProbeSnapshot } from '@personal-os/contracts';
import { AuthService } from './auth.service';
import { HealthService } from './health.service';
import { Redirection } from './redirection';

@Component({
  imports: [RouterModule],
  selector: 'pos-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly health = inject(HealthService);
  private readonly redirection = inject(Redirection);

  protected readonly utilisateur = signal<CurrentUser | null>(null);
  protected readonly probe = signal<HealthProbeSnapshot | null>(null);
  protected readonly error = signal<string | null>(null);

  /**
   * Authentik ne rend pas toujours un nom : le compte reste identifiable par
   * son adresse, qui elle est toujours là.
   */
  protected readonly nom = computed(() => {
    const compte = this.utilisateur();
    return compte ? (compte.displayName ?? compte.email) : null;
  });

  constructor() {
    // L'absence de session n'est pas traitée ici : l'intercepteur renvoie vers
    // Authentik pour toute requête refusée, et il le fait une fois pour toutes
    // les requêtes plutôt qu'écran par écran.
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
      // La session est déjà révoquée quand cette réponse arrive. Le détour par
      // Authentik ne sert qu'à fermer *sa* session : sans lui, le clic suivant
      // sur « se connecter » rouvrirait sans rien demander.
      next: ({ endSessionUrl }) => this.redirection.vers(endSessionUrl ?? '/'),
      error: () => this.redirection.vers('/'),
    });
  }
}
