import { Injectable } from '@nestjs/common';
import type { AgendaContributor } from '@personal-os/contracts';

/**
 * Le registre par lequel un module se présente à l'Agenda.
 *
 * C'est ici que l'inversion de dépendance se noue (ADR 0011) : les modules
 * pointent vers ce registre, et l'Agenda aussi. L'Agenda ne pointe vers aucun
 * module, et en ajouter un ne le modifie donc pas.
 */
@Injectable()
export class AgendaRegistry {
  private readonly contributeurs = new Map<string, AgendaContributor>();

  /**
   * Une source est l'identité d'un module. Deux modules qui la partagent en
   * éclipseraient un, et le renvoi vers le module d'origine mènerait au
   * mauvais : le conflit est refusé au démarrage, pas découvert à l'usage.
   */
  enregistrer(contributeur: AgendaContributor): void {
    if (this.contributeurs.has(contributeur.source)) {
      throw new Error(
        `Deux contributeurs se présentent à l'Agenda sous la source « ${contributeur.source} ».`,
      );
    }

    this.contributeurs.set(contributeur.source, contributeur);
  }

  tous(): readonly AgendaContributor[] {
    return [...this.contributeurs.values()];
  }
}
