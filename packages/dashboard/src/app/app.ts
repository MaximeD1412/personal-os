import { Component, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import type { HealthProbeSnapshot } from '@personal-os/contracts';
import { HealthService } from './health.service';

@Component({
  imports: [RouterModule],
  selector: 'pos-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly health = inject(HealthService);

  protected readonly probe = signal<HealthProbeSnapshot | null>(null);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.health.read().subscribe({
      next: (response) => this.probe.set(response.database),
      error: () => this.error.set("L'API n'a pas pu lire la sonde en base."),
    });
  }
}
