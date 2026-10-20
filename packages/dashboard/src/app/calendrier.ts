import {
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import {
  matAddOutline,
  matChevronLeftOutline,
  matChevronRightOutline,
  matEventAvailableOutline,
  matNotificationsOutline,
} from '@ng-icons/material-symbols/outline';
import {
  aujourdhui,
  estEcheance,
  lundiDe,
  type EventOccurrence,
} from '@personal-os/contracts';
import { HlmBadge } from '@personal-os/ui/badge';
import { HlmButton } from '@personal-os/ui/button';
import {
  DccmEmptyState,
  DccmPageHeader,
  DccmState,
  stateOf,
} from '@personal-os/ui/dccm';
import {
  categorieDe,
  type CategorieDEvenement,
} from './categories-d-evenement';
import { decaler, formaterJour, heureDe, jourDe } from './dates';
import { libelleDuRappel } from './formulaire-d-evenement';
import { BUREAU, Largeur, TABLETTE } from './largeur';
import { MoisDuCalendrier } from './mois-du-calendrier';
import { PARAMETRE_DE_MOIS, PARAMETRE_D_OCCURRENCE } from './modules-d-origine';

/** Une occurrence telle que la grille et la liste du jour la montrent. */
interface VueDOccurrence {
  cle: string;
  titre: string;
  heure: string;
  /** « 11:30 – 12:30 », ou la seule heure de début. */
  horaire: string;
  categorie: CategorieDEvenement;
  echeance: boolean;
  espace: string;
  rappel: string | null;
  lien: { chemin: string; parametres: Record<string, string> };
}

interface Cellule {
  jour: string;
  numero: string;
  libelle: string;
  dansLeMois: boolean;
  estAujourdhui: boolean;
  occurrences: VueDOccurrence[];
}

/**
 * Le Calendrier : les Événements du mois affiché, en grille à partir de
 * 768 px, en bandeau de la semaine et liste du jour en dessous.
 *
 * Il n'écrit rien lui-même. Créer et modifier passent par le formulaire de
 * leur route (`/calendrier/evenements/nouveau`, `/calendrier/evenements/:id`),
 * ouvert dans son `router-outlet` : en panneau à côté de la grille à partir de
 * 1280 px, en feuille en dessous.
 */
@Component({
  selector: 'pos-calendrier',
  templateUrl: './calendrier.html',
  imports: [
    RouterLink,
    RouterOutlet,
    NgIcon,
    HlmBadge,
    HlmButton,
    DccmEmptyState,
    DccmPageHeader,
    DccmState,
  ],
  providers: [MoisDuCalendrier],
})
export class Calendrier {
  protected readonly calendrier = inject(MoisDuCalendrier);
  private readonly largeur = inject(Largeur);

  protected readonly large = this.largeur.auMoins(TABLETTE);
  protected readonly bureau = this.largeur.auMoins(BUREAU);

  private readonly aujourdhui = aujourdhui();

  protected readonly mois = this.calendrier.mois;

  /** Un mois se lit toujours en grille : vide, il reste un mois. */
  protected readonly etat = computed(() =>
    stateOf(this.calendrier.lecture, () => false),
  );

  protected readonly titre = computed(() =>
    formaterJour(`${this.mois()}-01`, { month: 'long', year: 'numeric' }),
  );

  /** Le formulaire est ouvert dans l'`router-outlet`. */
  protected readonly formulaireOuvert = signal(false);

  /**
   * Le panneau ouvert à côté de la grille la resserre : les pastilles n'y
   * gardent que leur icône et leur titre, l'heure restant dans leur infobulle.
   */
  protected readonly resserree = computed(
    () => this.bureau() && this.formulaireOuvert(),
  );

  private readonly parJour = computed(() => {
    const parJour = new Map<string, VueDOccurrence[]>();
    for (const occurrence of this.calendrier.occurrences()) {
      const jour = jourDe(occurrence.startsAt);
      parJour.set(jour, [...(parJour.get(jour) ?? []), this.vueDe(occurrence)]);
    }
    return parJour;
  });

  /** Les semaines de la grille, du lundi qui précède le 1er au dimanche qui suit le dernier jour. */
  protected readonly semaines = computed((): Cellule[][] => {
    const mois = this.mois();
    const premier = `${mois}-01`;
    const dernier = decaler(`${moisSuivant(mois)}-01`, -1);
    const semaines: Cellule[][] = [];

    for (
      let lundi = lundiDe(premier);
      lundi <= dernier;
      lundi = decaler(lundi, 7)
    ) {
      semaines.push(
        Array.from({ length: 7 }, (_, indice) =>
          this.celluleDe(decaler(lundi, indice)),
        ),
      );
    }
    return semaines;
  });

  /** L'en-tête de la grille : lun., mar., … */
  protected readonly joursDeLaSemaine = Array.from({ length: 7 }, (_, indice) =>
    formaterJour(decaler(lundiDe(this.aujourdhui), indice), {
      weekday: 'short',
    }),
  );

  /**
   * Le jour de la liste, sous 768 px : aujourd'hui dans le mois en cours, le
   * 1er ailleurs, ou le jour choisi tant qu'il reste dans le mois affiché.
   */
  protected readonly jourChoisi = linkedSignal<string, string>({
    source: this.mois,
    computation: (mois, precedent) =>
      precedent?.value.startsWith(mois)
        ? precedent.value
        : this.aujourdhui.startsWith(mois)
          ? this.aujourdhui
          : `${mois}-01`,
  });

  protected readonly bandeau = computed(() => {
    const lundi = lundiDe(this.jourChoisi());
    return Array.from({ length: 7 }, (_, indice) => {
      const cellule = this.celluleDe(decaler(lundi, indice));
      return {
        ...cellule,
        initiale: formaterJour(cellule.jour, { weekday: 'narrow' }),
        choisi: cellule.jour === this.jourChoisi(),
        points: cellule.occurrences.slice(0, 3),
      };
    });
  });

  protected readonly numeroDeSemaine = computed(() =>
    semaineIso(this.jourChoisi()),
  );

  protected readonly duJour = computed(() => this.celluleDe(this.jourChoisi()));

  protected readonly icones = {
    precedent: matChevronLeftOutline,
    suivant: matChevronRightOutline,
    ajouter: matAddOutline,
    rappel: matNotificationsOutline,
    vide: matEventAvailableOutline,
  };

  protected readonly parametresDeCreation = computed(() => ({
    [PARAMETRE_DE_MOIS]: this.mois(),
  }));

  protected changerDeMois(sens: -1 | 1): void {
    void this.calendrier.afficher(
      sens === 1 ? moisSuivant(this.mois()) : moisPrecedent(this.mois()),
    );
  }

  protected revenirAujourdhui(): void {
    this.jourChoisi.set(this.aujourdhui);
    void this.calendrier.afficher(this.aujourdhui.slice(0, 7));
  }

  /** Un jour du bandeau : hors du mois affiché, il fait changer de mois. */
  protected choisirLeJour(jour: string): void {
    this.jourChoisi.set(jour);
    if (!jour.startsWith(this.mois())) {
      void this.calendrier.afficher(jour.slice(0, 7));
    }
  }

  protected changerDeSemaine(sens: -1 | 1): void {
    this.choisirLeJour(decaler(this.jourChoisi(), 7 * sens));
  }

  protected nombreDEvenements(n: number): string {
    return `${n} ${n > 1 ? 'événements' : 'événement'}`;
  }

  protected fermer(): void {
    void this.calendrier.fermer();
  }

  private celluleDe(jour: string): Cellule {
    return {
      jour,
      numero: String(Number(jour.slice(8))),
      libelle: formaterJour(jour, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      dansLeMois: jour.startsWith(this.mois()),
      estAujourdhui: jour === this.aujourdhui,
      occurrences: this.parJour().get(jour) ?? [],
    };
  }

  private vueDe(occurrence: EventOccurrence): VueDOccurrence {
    const heure = heureDe(occurrence.startsAt);
    const finLeMemeJour =
      occurrence.endsAt &&
      jourDe(occurrence.endsAt) === jourDe(occurrence.startsAt);

    return {
      cle: `${occurrence.eventId}:${occurrence.originalStart}`,
      titre: occurrence.title,
      heure,
      horaire: finLeMemeJour
        ? `${heure} – ${heureDe(occurrence.endsAt as string)}`
        : heure,
      categorie: categorieDe(occurrence.category),
      echeance: estEcheance(occurrence),
      espace: this.calendrier.nomDeLEspace(occurrence.scopeId),
      rappel:
        occurrence.reminderLeadMinutes === null
          ? null
          : `Rappel ${libelleDuRappel(occurrence.reminderLeadMinutes)} avant`,
      lien: {
        chemin: `/calendrier/evenements/${occurrence.eventId}`,
        parametres: {
          [PARAMETRE_DE_MOIS]: this.mois(),
          [PARAMETRE_D_OCCURRENCE]: occurrence.startsAt,
        },
      },
    };
  }
}

function moisSuivant(mois: string): string {
  return decaler(`${mois}-28`, 7).slice(0, 7);
}

function moisPrecedent(mois: string): string {
  return decaler(`${mois}-01`, -1).slice(0, 7);
}

/** Le numéro de la semaine ISO 8601 d'un jour (celle qui porte son jeudi). */
function semaineIso(jour: string): number {
  const jeudi = decaler(lundiDe(jour), 3);
  const premierJanvier = Date.UTC(Number(jeudi.slice(0, 4)), 0, 1);
  const jours =
    (Date.parse(`${jeudi}T00:00:00Z`) - premierJanvier) / 86_400_000;
  return Math.floor(jours / 7) + 1;
}
