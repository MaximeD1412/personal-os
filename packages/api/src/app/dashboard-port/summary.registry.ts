import { Injectable } from '@nestjs/common';
import type { ResumeurDeModule } from '@personal-os/contracts';

/**
 * Le registre par lequel un module se résume au tableau de bord.
 *
 * L'inversion de dépendance se noue ici, comme pour l'Agenda (ADR 0011) : les
 * modules pointent vers ce registre, et le tableau de bord aussi. Le tableau
 * de bord ne pointe vers aucun module, et en ajouter un ne le modifie donc pas.
 */
@Injectable()
export class SummaryRegistry {
  private readonly resumeurs = new Map<string, ResumeurDeModule>();

  /**
   * Un module ne se résume qu'une fois. Deux résumeurs sous le même nom en
   * éclipseraient un : le conflit est refusé au démarrage, pas découvert à
   * l'usage.
   */
  enregistrer(resumeur: ResumeurDeModule): void {
    if (this.resumeurs.has(resumeur.module)) {
      throw new Error(
        `Deux résumeurs se présentent au tableau de bord sous le module « ${resumeur.module} ».`,
      );
    }

    this.resumeurs.set(resumeur.module, resumeur);
  }

  tous(): readonly ResumeurDeModule[] {
    return [...this.resumeurs.values()];
  }
}
