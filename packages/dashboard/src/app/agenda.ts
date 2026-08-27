import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import type { AgendaItem } from '@personal-os/contracts';
import { HlmBadge } from '@personal-os/ui/badge';
import {
  HlmCard,
  HlmCardContent,
  HlmCardDescription,
  HlmCardHeader,
  HlmCardTitle,
} from '@personal-os/ui/card';
import { HlmInput } from '@personal-os/ui/input';
import { HlmLabel } from '@personal-os/ui/label';
import { AgendaService } from './agenda.service';
import { moduleDOrigine, type ModuleDOrigine } from './modules-d-origine';

/** La fenêtre qu'on ouvre à l'arrivée, faute d'en avoir demandé une autre. */
const JOURS_OFFERTS = 30;

const STATUTS: Readonly<Record<AgendaItem['status'], string>> = {
  PLANNED: 'Prévu',
  DONE: 'Réalisé',
  MISSED: 'Manqué',
};

/**
 * L'Agenda : la vue en lecture seule qui fusionne, pour une période donnée,
 * les objets datés des modules.
 *
 * Rien ne s'écrit ici, et c'est la décision : déplacer une Séance se fait dans
 * le module Sport (ADR 0011). Une entrée n'offre donc qu'un chemin — celui qui
 * ramène à son module d'origine.
 */
@Component({
  selector: 'pos-agenda',
  templateUrl: './agenda.html',
  imports: [
    DatePipe,
    RouterModule,
    HlmBadge,
    HlmCard,
    HlmCardContent,
    HlmCardDescription,
    HlmCardHeader,
    HlmCardTitle,
    HlmInput,
    HlmLabel,
  ],
})
export class Agenda {
  private readonly api = inject(AgendaService);

  protected readonly du = signal(jourLocal(new Date()));
  protected readonly au = signal(jourLocal(dansNJours(JOURS_OFFERTS)));

  protected readonly entrees = signal<AgendaItem[]>([]);
  protected readonly erreur = signal<string | null>(null);

  /**
   * Les entrées rangées par jour. L'Agenda se lit par journées, et l'API rend
   * déjà une suite triée : il n'y a qu'à la découper.
   */
  protected readonly journees = computed(() => {
    const journees: { jour: string; entrees: AgendaItem[] }[] = [];

    for (const entree of this.entrees()) {
      const jour = entree.startsAt.slice(0, 10);
      const derniere = journees[journees.length - 1];

      if (derniere?.jour === jour) {
        derniere.entrees.push(entree);
      } else {
        journees.push({ jour, entrees: [entree] });
      }
    }

    return journees;
  });

  constructor() {
    effect(() => this.relire(this.du(), this.au()));
  }

  protected borner(champ: 'du' | 'au', evenement: globalThis.Event): void {
    const valeur = (evenement.target as HTMLInputElement).value;
    if (!valeur) {
      return;
    }

    this[champ].set(valeur);
  }

  protected nomDuStatut(statut: AgendaItem['status']): string {
    return STATUTS[statut];
  }

  /** Le module qui possède l'objet, quand le tableau de bord en a l'écran. */
  protected origine(entree: AgendaItem): ModuleDOrigine | null {
    return moduleDOrigine(entree);
  }

  protected retour(entree: AgendaItem): Record<string, string> {
    const module = this.origine(entree);
    return module ? { [module.parametre]: entree.sourceId } : {};
  }

  private relire(du: string, au: string): void {
    this.api
      .lister({ from: versIso(du, '00:00'), to: versIso(au, '23:59:59.999') })
      .subscribe({
        next: (entrees) => {
          this.erreur.set(null);
          this.entrees.set(entrees);
        },
        error: () => this.erreur.set("L'Agenda n'a pas pu être lu."),
      });
  }
}

function dansNJours(jours: number): Date {
  const instant = new Date();
  instant.setDate(instant.getDate() + jours);
  return instant;
}

/** Une date, telle qu'un champ `date` la saisit — en heure locale. */
function jourLocal(instant: Date): string {
  const deuxChiffres = (valeur: number) => valeur.toString().padStart(2, '0');

  return (
    `${instant.getFullYear()}-${deuxChiffres(instant.getMonth() + 1)}` +
    `-${deuxChiffres(instant.getDate())}`
  );
}

/** Le jour saisi en heure locale, rendu au contrat en ISO-8601. */
function versIso(jour: string, heure: string): string {
  return new Date(`${jour}T${heure}`).toISOString();
}
