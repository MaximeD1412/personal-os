import { DatePipe } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import type { HttpResourceRef } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import {
  estEcheance,
  periodeDuMois,
  zEventInput,
  type ApiError,
  type Event,
  type EventCategory,
  type EventInput,
  type EventUpdate,
} from '@personal-os/contracts';
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
import { EspaceCourant } from './espace-courant';
import { EspaceService } from './espace.service';
import { EventService } from './event.service';
import { erreursDeChamp, prefillDepuisRequete } from './formulaire';
import { estUnMois, moisCourant } from './mois';
import { PARAMETRE_DE_MOIS, PARAMETRE_D_EVENEMENT } from './modules-d-origine';

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
 * Le Calendrier vu de l'interface : les Événements du mois affiché, et le
 * formulaire qui sert aussi bien à en créer un qu'à en modifier un.
 *
 * Le mois va du premier au dernier jour, à Paris. C'est le mois en cours, ou
 * celui que le lien désigne (`?mois=YYYY-MM`).
 *
 * À `/calendrier/evenements/nouveau`, le formulaire se préremplit depuis la
 * requête (ADR 0030) : `title`, `startsAt`, `endsAt`, `category`,
 * `reminderLeadMinutes`, `scopeId`, validés par le contrat de l'entrée. Ce
 * qui n'a pas pu être repris est signalé dans un bandeau, et rien n'est
 * enregistré sans clic.
 *
 * L'Espace est toujours explicite — le Calendrier acceptant les deux, rien ne
 * permettrait de le deviner (ADR 0014). Une nouvelle saisie reprend l'Espace
 * pré-choisi dans la TopBar (`EspaceCourant`), visible et modifiable dans le
 * champ ; sans pré-choix, le champ démarre vide.
 */
@Component({
  selector: 'pos-calendrier',
  templateUrl: './calendrier.html',
  imports: [
    DatePipe,
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
export class Calendrier {
  private readonly espacesApi = inject(EspaceService);
  private readonly evenementsApi = inject(EventService);
  private readonly route = inject(ActivatedRoute);

  protected readonly categories = CATEGORIES;
  protected readonly paliers = PALIERS_DE_RAPPEL;

  protected readonly mois = signal(this.moisDuLien() ?? moisCourant());

  private readonly lectureDesEspaces = this.espacesApi.lecture();
  private readonly lectureDuMois = this.evenementsApi.lecture(() =>
    periodeDuMois(this.mois()),
  );

  protected readonly espaces = computed(() => valeurDe(this.lectureDesEspaces));
  protected readonly evenements = computed(() =>
    parDate(valeurDe(this.lectureDuMois)),
  );

  /** Le dernier refus d'une écriture, tel que l'API l'a formulé. */
  private readonly refus = signal<ApiError | null>(null);
  /** Ce que l'écran affiche d'une erreur : toujours le `message` de l'API. */
  protected readonly erreur = computed(
    () =>
      this.refus()?.message ??
      this.lectureDuMois.error()?.message ??
      this.lectureDesEspaces.error()?.message ??
      null,
  );
  /** Les messages de l'API, rangés sous le champ qu'ils visent. */
  protected readonly erreursDeChamp = computed(() =>
    erreursDeChamp(this.refus()),
  );

  /** Les paramètres de la requête que le formulaire n'a pas pu reprendre. */
  protected readonly ignores = signal<string[]>([]);
  /** Ce que la requête a prérempli. */
  private readonly prerempli = signal<Partial<EventInput>>({});

  /** L'Événement repris dans le formulaire, ou `null` quand on en crée un. */
  protected readonly enEdition = signal<Event | null>(null);
  protected readonly saisie = signal<Saisie>({ ...SAISIE_VIERGE });

  private readonly espaceCourant = inject(EspaceCourant);
  /** L'Espace a été choisi dans le champ : le sélecteur ne le change plus. */
  private readonly espaceChoisiALaMain = signal(false);
  /** Le lien de l'Agenda ne vise un Événement qu'à l'arrivée sur l'écran. */
  private lienRepris = false;

  protected readonly pretAEnregistrer = computed(() => {
    const { titre, debut, espaceId } = this.saisie();
    return titre.trim().length > 0 && debut.length > 0 && espaceId.length > 0;
  });

  constructor() {
    // Une nouvelle saisie suit l'Espace pré-choisi tant qu'on n'en a pas
    // choisi un dans le champ ; un Événement repris garde le sien.
    effect(() => {
      const preChoisi = this.espaceCourant.espace();
      if (!preChoisi || this.enEdition() || this.espaceChoisiALaMain()) {
        return;
      }
      untracked(() =>
        this.saisie.update((saisie) => ({ ...saisie, espaceId: preChoisi.id })),
      );
    });

    if (this.route.snapshot.data['creation']) {
      this.preremplir();
      this.lienRepris = true;
    }

    // Le lien de l'Agenda vise un Événement du mois qu'il ouvre : on le
    // cherche dans la première lecture qui aboutit.
    effect(() => {
      if (this.lectureDuMois.status() !== 'resolved' || this.lienRepris) {
        return;
      }
      this.lienRepris = true;
      untracked(() => this.reprendreCeluiDuLien());
    });
  }

  protected afficherLeMois(evenement: globalThis.Event): void {
    const valeur = (evenement.target as HTMLInputElement).value;
    if (estUnMois(valeur)) {
      this.mois.set(valeur);
    }
  }

  /**
   * La requête, lue par le contrat de l'entrée. Un Espace qu'elle nomme est un
   * choix : le sélecteur de la TopBar ne le remplace pas.
   */
  private preremplir(): void {
    const { valeurs, ignores } = prefillDepuisRequete(
      zEventInput,
      this.route.snapshot.queryParamMap,
    );

    this.prerempli.set(valeurs);
    this.ignores.set(ignores);
    this.espaceChoisiALaMain.set(valeurs.scopeId !== undefined);
    this.saisie.set({
      titre: valeurs.title ?? SAISIE_VIERGE.titre,
      debut: valeurs.startsAt ? versChampLocal(valeurs.startsAt) : '',
      fin: valeurs.endsAt ? versChampLocal(valeurs.endsAt) : '',
      categorie: valeurs.category ?? SAISIE_VIERGE.categorie,
      espaceId: valeurs.scopeId ?? SAISIE_VIERGE.espaceId,
      rappel: valeurs.reminderLeadMinutes?.toString() ?? '',
    });
  }

  /** Un mois mal formé dans le lien est ignoré : on ouvre le mois en cours. */
  private moisDuLien(): string | null {
    const demande = this.route.snapshot.queryParamMap.get(PARAMETRE_DE_MOIS);
    return estUnMois(demande) ? demande : null;
  }

  /**
   * L'Agenda est en lecture seule et renvoie ici pour modifier (ADR 0011).
   * Le lien porte l'identité de l'Événement : on atterrit sur l'objet, pas
   * seulement sur l'écran.
   *
   * Un identifiant qui ne désigne rien de visible laisse le formulaire
   * vierge — c'est le même silence que partout ailleurs, et il ne confirme
   * pas l'existence d'un Événement hors de portée (ADR 0028).
   */
  private reprendreCeluiDuLien(): void {
    const vise = this.route.snapshot.queryParamMap.get(PARAMETRE_D_EVENEMENT);
    if (!vise) {
      return;
    }

    const evenement = this.evenements().find(({ id }) => id === vise);
    if (evenement) {
      this.reprendre(evenement);
    }
  }

  /*
   * Les trois suivantes sont des propriétés-flèches et non des méthodes :
   * `hlm-select` les reçoit comme `itemToString` et les appelle détachées de
   * l'instance, pour afficher dans le déclencheur ce qui a été choisi.
   */

  protected readonly nomDeLEspace = (id: string | null | undefined): string =>
    this.espaces().find((espace) => espace.id === id)?.label ?? id ?? '';

  protected readonly nomDeLaCategorie = (
    categorie: EventCategory | null | undefined,
  ): string =>
    CATEGORIES.find(({ valeur }) => valeur === categorie)?.libelle ??
    categorie ??
    '';

  protected readonly nomDuRappel = (
    rappel: string | null | undefined,
  ): string =>
    rappel ? `${this.libelleDuRappel(Number(rappel))} avant` : 'Sans rappel';

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
   * Les paliers offerts, plus celui que porte l'Événement repris (ou la
   * requête) s'il n'en est pas un : sans cela, l'ouvrir puis l'enregistrer
   * effacerait son rappel.
   */
  protected readonly paliersOfferts = computed(() => {
    const repris = this.enEdition();
    const pose = repris
      ? repris.reminderLeadMinutes
      : this.prerempli().reminderLeadMinutes;
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

  /** Les champs de saisie libre, qui portent leur valeur dans l'événement. */
  protected saisir(champ: keyof Saisie, evenement: globalThis.Event): void {
    const valeur = (evenement.target as HTMLInputElement).value;

    this.saisie.update((saisie) => ({ ...saisie, [champ]: valeur }));
  }

  /**
   * Les `hlm-select`, qui émettent directement la valeur choisie — et `null`
   * quand ils ne portent plus de choix.
   */
  protected choisir(
    champ: keyof Saisie,
    valeur: string | null | undefined,
  ): void {
    if (champ === 'espaceId' && (valeur ?? '') !== this.saisie().espaceId) {
      this.espaceChoisiALaMain.set(true);
    }
    this.saisie.update((saisie) => ({ ...saisie, [champ]: valeur ?? '' }));
  }

  protected reprendre(evenement: Event): void {
    this.refus.set(null);
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
    this.refus.set(null);
    this.ignores.set([]);
    this.prerempli.set({});
    this.enEdition.set(null);
    this.espaceChoisiALaMain.set(false);
    this.saisie.set({
      ...SAISIE_VIERGE,
      espaceId: this.espaceCourant.espace()?.id ?? '',
    });
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
        this.lectureDuMois.set([...this.evenements(), cree]);
        this.annuler();
      },
      error: (refus: ApiError) => this.refus.set(refus),
    });
  }

  protected supprimer(id: string): void {
    this.evenementsApi.supprimer(id).subscribe({
      next: () => {
        this.refus.set(null);
        this.lectureDuMois.set(
          this.evenements().filter((evenement) => evenement.id !== id),
        );
        if (this.enEdition()?.id === id) {
          this.annuler();
        }
      },
      error: (refus: ApiError) => this.refus.set(refus),
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
        this.lectureDuMois.set(
          this.evenements().map((evenement) =>
            evenement.id === modifie.id ? modifie : evenement,
          ),
        );
        this.annuler();
      },
      error: (refus: ApiError) => this.refus.set(refus),
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

/**
 * Ce qu'une lecture a rendu, ou rien : une lecture en échec n'a pas de valeur
 * à lire, et son erreur s'affiche à part.
 */
function valeurDe<T>(lecture: HttpResourceRef<T[]>): T[] {
  return lecture.hasValue() ? lecture.value() : [];
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
