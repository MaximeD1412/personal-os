import { Component, computed, inject, signal } from '@angular/core';
import {
  estEcheance,
  type Event,
  type EventCategory,
  type EventInput,
  type EventUpdate,
  type Scope,
} from '@personal-os/contracts';
import { EspaceService } from './espace.service';
import { EventService } from './event.service';

/** Les catégories, dans l'ordre où l'écran les propose. */
const CATEGORIES: readonly { valeur: EventCategory; libelle: string }[] = [
  { valeur: 'APPOINTMENT', libelle: 'Rendez-vous' },
  { valeur: 'BIRTHDAY', libelle: 'Anniversaire' },
  { valeur: 'DEADLINE', libelle: 'Échéance' },
  { valeur: 'OTHER', libelle: 'Autre' },
];

/**
 * Les paliers de rappel offerts par l'écran. Un rappel est un délai avant le
 * début, pas un objet : ce que l'on choisit ici est un nombre de minutes, et
 * rien d'autre n'est créé (ADR 0017).
 */
const PALIERS_DE_RAPPEL: readonly { minutes: number; libelle: string }[] = [
  { minutes: 30, libelle: '30 minutes' },
  { minutes: 60, libelle: '1 heure' },
  { minutes: 1_440, libelle: '1 jour' },
  { minutes: 10_080, libelle: '1 semaine' },
];

interface Saisie {
  titre: string;
  debut: string;
  fin: string;
  categorie: EventCategory;
  espaceId: string;
  rappel: string;
}

const SAISIE_VIERGE: Saisie = {
  titre: '',
  debut: '',
  fin: '',
  categorie: 'APPOINTMENT',
  espaceId: '',
  rappel: '',
};

/**
 * Le Calendrier vu de l'interface : la liste des Événements, et le formulaire
 * qui sert aussi bien à en créer un qu'à en modifier un.
 *
 * L'Espace est toujours explicite — le Calendrier acceptant les deux, rien ne
 * permettrait de le deviner, et le champ démarre donc vide (ADR 0014).
 */
@Component({
  selector: 'pos-calendrier',
  templateUrl: './calendrier.html',
  styleUrl: './calendrier.css',
})
export class Calendrier {
  private readonly espacesApi = inject(EspaceService);
  private readonly evenementsApi = inject(EventService);

  protected readonly categories = CATEGORIES;
  protected readonly paliers = PALIERS_DE_RAPPEL;

  protected readonly espaces = signal<Scope[]>([]);
  protected readonly evenements = signal<Event[]>([]);
  protected readonly erreur = signal<string | null>(null);

  /** L'Événement repris dans le formulaire, ou `null` quand on en crée un. */
  protected readonly enEdition = signal<Event | null>(null);
  protected readonly saisie = signal<Saisie>({ ...SAISIE_VIERGE });

  protected readonly pretAEnregistrer = computed(() => {
    const { titre, debut, espaceId } = this.saisie();
    return (
      titre.trim().length > 0 && debut.length > 0 && espaceId.length > 0
    );
  });

  constructor() {
    this.espacesApi.mesEspaces().subscribe({
      next: (espaces) => this.espaces.set(espaces),
      error: () => this.erreur.set("Les Espaces n'ont pas pu être lus."),
    });

    this.evenementsApi.lister().subscribe({
      next: (evenements) => this.evenements.set(parDate(evenements)),
      error: () => this.erreur.set("Les Événements n'ont pas pu être lus."),
    });
  }

  protected nomDeLEspace(id: string): string {
    return this.espaces().find((espace) => espace.id === id)?.label ?? id;
  }

  protected nomDeLaCategorie(categorie: EventCategory): string {
    return (
      CATEGORIES.find(({ valeur }) => valeur === categorie)?.libelle ??
      categorie
    );
  }

  /** Une Échéance est un Événement portant la catégorie dédiée, rien de plus. */
  protected estUneEcheance(evenement: Event): boolean {
    return estEcheance(evenement);
  }

  protected libelleDuRappel(minutes: number): string {
    return (
      PALIERS_DE_RAPPEL.find((palier) => palier.minutes === minutes)?.libelle ??
      `${minutes} minutes`
    );
  }

  /**
   * Les paliers offerts, plus celui que porte l'Événement repris s'il n'en est
   * pas un : sans cela, l'ouvrir puis l'enregistrer effacerait son rappel.
   */
  protected readonly paliersOfferts = computed(() => {
    const pose = this.enEdition()?.reminderLeadMinutes;
    if (pose === null || pose === undefined) {
      return PALIERS_DE_RAPPEL;
    }
    if (PALIERS_DE_RAPPEL.some(({ minutes }) => minutes === pose)) {
      return PALIERS_DE_RAPPEL;
    }
    return [
      ...PALIERS_DE_RAPPEL,
      { minutes: pose, libelle: `${pose} minutes` },
    ];
  });

  protected saisir(champ: keyof Saisie, evenement: globalThis.Event): void {
    const valeur = (
      evenement.target as HTMLInputElement | HTMLSelectElement
    ).value;

    this.saisie.update((saisie) => ({ ...saisie, [champ]: valeur }));
  }

  protected reprendre(evenement: Event): void {
    this.erreur.set(null);
    this.enEdition.set(evenement);
    this.saisie.set({
      titre: evenement.title,
      debut: versChampLocal(evenement.startsAt),
      fin: evenement.endsAt ? versChampLocal(evenement.endsAt) : '',
      categorie: evenement.category,
      espaceId: evenement.scopeId,
      rappel: evenement.reminderLeadMinutes?.toString() ?? '',
    });
  }

  protected annuler(): void {
    this.enEdition.set(null);
    this.saisie.set({ ...SAISIE_VIERGE });
  }

  protected enregistrer(): void {
    if (!this.pretAEnregistrer()) {
      return;
    }

    const repris = this.enEdition();
    if (repris) {
      this.appliquer(repris);
      return;
    }

    this.evenementsApi.creer(this.saisieCreee()).subscribe({
      next: (cree) => {
        this.evenements.update((tous) => parDate([...tous, cree]));
        this.annuler();
      },
      error: () => this.erreur.set("L'Événement n'a pas pu être créé."),
    });
  }

  protected supprimer(id: string): void {
    this.evenementsApi.supprimer(id).subscribe({
      next: () => {
        this.evenements.update((tous) =>
          tous.filter((evenement) => evenement.id !== id),
        );
        if (this.enEdition()?.id === id) {
          this.annuler();
        }
      },
      error: () => this.erreur.set("L'Événement n'a pas pu être supprimé."),
    });
  }

  /**
   * Une modification ne porte que ce qui change. L'Espace n'y figure que
   * lorsqu'on déplace vraiment l'Événement — le répéter sans raison ferait
   * vérifier à la garde un déplacement qui n'a pas lieu (ADR 0028).
   */
  private appliquer(repris: Event): void {
    const changements = this.changementsSur(repris);

    if (Object.keys(changements).length === 0) {
      this.annuler();
      return;
    }

    this.evenementsApi.modifier(repris.id, changements).subscribe({
      next: (modifie) => {
        this.evenements.update((tous) =>
          parDate(
            tous.map((evenement) =>
              evenement.id === modifie.id ? modifie : evenement,
            ),
          ),
        );
        this.annuler();
      },
      error: () => this.erreur.set("L'Événement n'a pas pu être modifié."),
    });
  }

  private changementsSur(repris: Event): EventUpdate {
    const voulu = this.saisieCreee();
    const changements: EventUpdate = {};

    if (voulu.title !== repris.title) {
      changements.title = voulu.title;
    }
    if (!memeInstant(voulu.startsAt, repris.startsAt)) {
      changements.startsAt = voulu.startsAt;
    }
    if (!memeInstant(voulu.endsAt ?? null, repris.endsAt)) {
      changements.endsAt = voulu.endsAt ?? null;
    }
    if (voulu.category !== repris.category) {
      changements.category = voulu.category;
    }
    if (voulu.reminderLeadMinutes !== repris.reminderLeadMinutes) {
      changements.reminderLeadMinutes = voulu.reminderLeadMinutes;
    }
    if (voulu.scopeId !== repris.scopeId) {
      changements.scopeId = voulu.scopeId;
    }

    return changements;
  }

  /** La saisie de l'écran, traduite dans les termes du contrat. */
  private saisieCreee(): EventInput {
    const { titre, debut, fin, categorie, espaceId, rappel } = this.saisie();

    return {
      title: titre.trim(),
      startsAt: versIso(debut),
      endsAt: fin ? versIso(fin) : null,
      category: categorie,
      reminderLeadMinutes: rappel ? Number(rappel) : null,
      scopeId: espaceId,
    };
  }
}

function parDate(evenements: Event[]): Event[] {
  return [...evenements].sort((gauche, droite) =>
    gauche.startsAt.localeCompare(droite.startsAt),
  );
}

/** Deux instants, comparés comme des instants et non comme des chaînes. */
function memeInstant(gauche: string | null, droite: string | null): boolean {
  if (gauche === null || droite === null) {
    return gauche === droite;
  }
  return new Date(gauche).getTime() === new Date(droite).getTime();
}

/** L'ISO-8601 du contrat, rendu au champ qui saisit en heure locale. */
function versChampLocal(iso: string): string {
  const instant = new Date(iso);
  const deuxChiffres = (valeur: number) => valeur.toString().padStart(2, '0');

  return (
    `${instant.getFullYear()}-${deuxChiffres(instant.getMonth() + 1)}` +
    `-${deuxChiffres(instant.getDate())}` +
    `T${deuxChiffres(instant.getHours())}:${deuxChiffres(instant.getMinutes())}`
  );
}

/** L'heure locale du champ, rendue au contrat en ISO-8601. */
function versIso(local: string): string {
  return new Date(local).toISOString();
}
