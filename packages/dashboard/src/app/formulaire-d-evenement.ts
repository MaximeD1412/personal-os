import {
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { matDeleteOutline } from '@ng-icons/material-symbols/outline';
import {
  zEventInput,
  type ApiError,
  type Event,
  type EventCategory,
  type EventInput,
  type EventOccurrence,
  type EventUpdate,
} from '@personal-os/contracts';
import { HlmButton } from '@personal-os/ui/button';
import {
  DccmConfirm,
  DccmFormPage,
  DccmState,
  type DccmStateStatus,
} from '@personal-os/ui/dccm';
import { HlmFieldImports } from '@personal-os/ui/field';
import { HlmInput } from '@personal-os/ui/input';
import { HlmSelectImports } from '@personal-os/ui/select';
import { showToast } from '@personal-os/ui/sonner';
import { HlmSwitch } from '@personal-os/ui/switch';
import { HlmToggleGroupImports } from '@personal-os/ui/toggle-group';
import { combineLatest, map } from 'rxjs';
import { CATEGORIES } from './categories-d-evenement';
import { formaterInstant } from './dates';
import { ErreurApi } from './erreur-api.interceptor';
import { EspaceCourant } from './espace-courant';
import { EventService } from './event.service';
import { erreursDeChamp, prefillDepuisRequete } from './formulaire';
import { BUREAU, Largeur } from './largeur';
import { MoisDuCalendrier } from './mois-du-calendrier';
import {
  PARAMETRE_DE_DEBUT,
  PARAMETRE_DE_MOIS,
  PARAMETRE_D_OCCURRENCE,
} from './modules-d-origine';
import {
  choisitSesJours,
  FINS_OFFERTES,
  FREQUENCES_OFFERTES,
  JOURS_OFFERTS,
  memeRegle,
  SANS_REPETITION,
  uniteDe,
  versRegle,
  versSaisie,
  type SaisieDeRecurrence,
} from './saisie-de-recurrence';

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

export function libelleDuRappel(minutes: number): string {
  return (
    PALIERS_DE_RAPPEL.find((palier) => palier.minutes === minutes)?.libelle ??
    `${minutes} minutes`
  );
}

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
 * L'Événement visé par l'URL : son identifiant, et l'occurrence ouverte —
 * par son identité (`originalStart`, depuis le Calendrier) ou, faute de
 * mieux, par son début (depuis l'Agenda).
 */
interface Cible {
  id: string | null;
  occurrence: string | null;
  debut: string | null;
}

function designeUneOccurrence(cible: Cible): boolean {
  return cible.occurrence !== null || cible.debut !== null;
}

function memeCible(gauche: Cible | null, droite: Cible): boolean {
  return (
    gauche?.id === droite.id &&
    gauche.occurrence === droite.occurrence &&
    gauche.debut === droite.debut
  );
}

/**
 * Le formulaire d'un Événement, à sa route : `/calendrier/evenements/nouveau`
 * pour en créer un, `/calendrier/evenements/:id` pour le modifier — une série
 * entière, quand l'Événement en est une. Il s'ouvre dans le Calendrier, en
 * panneau à partir de 1280 px et en feuille en dessous.
 *
 * Ouvert sur l'occurrence d'une série (`?occurrence=`, le lien d'une
 * pastille, ou `?debut=`, celui de l'Agenda), il demande d'abord ce que la
 * modification touche, sans choix par défaut : cette occurrence, que modifie
 * son propre formulaire (`FormulaireDOccurrence`), ou toute la série
 * (AGENDA-2). Le préremplissage suit le choix, d'un formulaire à l'autre.
 *
 * Il se préremplit depuis la requête (ADR 0030) : `title`, `startsAt`,
 * `endsAt`, `category`, `reminderLeadMinutes`, `scopeId`, validés par le
 * contrat de l'entrée. Ce qui n'a pas pu être repris est signalé, et rien
 * n'est enregistré sans clic.
 *
 * L'Espace est toujours explicite — le Calendrier acceptant les deux, rien ne
 * permettrait de le deviner (ADR 0014). Une nouvelle saisie reprend l'Espace
 * pré-choisi dans la TopBar (`EspaceCourant`), visible et modifiable dans le
 * champ ; sans pré-choix, le champ démarre vide.
 */
@Component({
  selector: 'pos-formulaire-d-evenement',
  templateUrl: './formulaire-d-evenement.html',
  imports: [
    NgIcon,
    HlmButton,
    HlmInput,
    HlmFieldImports,
    HlmSelectImports,
    HlmToggleGroupImports,
    HlmSwitch,
    DccmFormPage,
    DccmState,
  ],
})
export class FormulaireDEvenement {
  private readonly calendrier = inject(MoisDuCalendrier);
  private readonly api = inject(EventService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirmation = inject(DccmConfirm);
  private readonly espaceCourant = inject(EspaceCourant);

  protected readonly presentation = computed(() =>
    this.bureau() ? 'panel' : 'sheet',
  );
  private readonly bureau = inject(Largeur).auMoins(BUREAU);

  protected readonly categories = CATEGORIES;
  protected readonly frequences = FREQUENCES_OFFERTES;
  protected readonly jours = JOURS_OFFERTS;
  protected readonly fins = FINS_OFFERTES;
  protected readonly creation = !!this.route.snapshot.data['creation'];

  protected readonly espaces = computed(() =>
    this.calendrier.espaces.hasValue() ? this.calendrier.espaces.value() : [],
  );
  protected readonly erreurDesEspaces = computed(
    () => this.calendrier.espaces.error()?.message ?? null,
  );

  /**
   * L'Événement que l'URL désigne. Le changer (une autre pastille, une autre
   * occurrence) reprend le formulaire ; changer de mois à côté, non.
   */
  private readonly cible = toSignal(
    combineLatest([this.route.paramMap, this.route.queryParamMap]).pipe(
      map(
        ([parametres, requete]): Cible => ({
          id: parametres.get('id'),
          occurrence: requete.get(PARAMETRE_D_OCCURRENCE),
          debut: requete.get(PARAMETRE_DE_DEBUT),
        }),
      ),
    ),
    { requireSync: true },
  );
  private repriseDe: Cible | null = null;

  /**
   * L'Événement lui-même, et non l'une de ses occurrences : une occurrence
   * peut porter le titre ou les horaires d'une exception, que la série n'a
   * pas.
   */
  private readonly lu = this.api.evenement(() =>
    this.creation ? null : this.cible().id,
  );

  /** Le dernier refus d'une écriture, tel que l'API l'a formulé. */
  protected readonly refus = signal<ApiError | null>(null);
  /** Les messages de l'API, rangés sous le champ qu'ils visent. */
  protected readonly erreurs = computed(() => erreursDeChamp(this.refus()));
  /** Un refus de la règle vise l'un de ses champs (`recurrence.count`). */
  protected readonly erreurDeRecurrence = computed(
    () =>
      Object.entries(this.erreurs()).find(
        ([chemin]) =>
          chemin === 'recurrence' || chemin.startsWith('recurrence.'),
      )?.[1] ?? null,
  );
  protected readonly envoi = signal(false);

  /** Les paramètres de la requête que le formulaire n'a pas pu reprendre. */
  protected readonly ignores = signal<string[]>([]);
  /** Ce que la requête a prérempli. */
  private readonly prerempli = signal<Partial<EventInput>>({});

  /** L'Événement repris dans le formulaire, ou `null` quand on en crée un. */
  private readonly enEdition = signal<Event | null>(null);
  /**
   * L'Événement repris, tant qu'il est celui que l'URL désigne. Le composant
   * sert d'une pastille à l'autre : jusqu'à la lecture du suivant, le
   * précédent ne se montre plus et ne reçoit aucune écriture.
   */
  protected readonly repris = computed(() => {
    const evenement = this.enEdition();
    return evenement && evenement.id === this.cible().id ? evenement : null;
  });
  protected readonly saisie = signal<Saisie>({ ...SAISIE_VIERGE });
  protected readonly repetition = signal<SaisieDeRecurrence>(SANS_REPETITION);

  /** L'Espace a été choisi dans le champ : le sélecteur ne le change plus. */
  private readonly espaceChoisiALaMain = signal(false);

  /**
   * Le lien désigne l'occurrence d'une série : rien ne s'affiche tant que
   * l'on n'a pas choisi entre elle et toute la série. Un Événement qui n'a
   * lieu qu'une fois s'ouvre directement.
   */
  protected readonly choixAttendu = computed(() => {
    if (
      this.creation ||
      !designeUneOccurrence(this.cible()) ||
      this.erreurDeLecture()
    ) {
      return false;
    }
    return !this.lu.hasValue() || this.lu.value()?.recurrence !== null;
  });

  /**
   * Une modification attend son Événement : tant qu'il n'est pas lu, ou s'il
   * n'a pas pu l'être, rien ne se saisit ni ne s'enregistre.
   */
  protected readonly etatDeLaCible = computed((): DccmStateStatus => {
    if (this.creation || this.repris()) {
      return 'ready';
    }
    return this.erreurDeLecture() ? 'error' : 'loading';
  });
  /**
   * Un Événement introuvable n'est pas une erreur à montrer : le formulaire se
   * referme (voir `constructor`). Le mois n'est attendu que pour retrouver
   * l'occurrence que le lien désigne.
   */
  protected readonly erreurDeLecture = computed(() => {
    const erreur = this.lu.error();
    if (erreur && !estIntrouvable(erreur)) {
      return erreur;
    }
    return designeUneOccurrence(this.cible())
      ? (this.calendrier.lecture.error() ?? null)
      : null;
  });

  protected readonly titre = computed(() => {
    if (this.creation) {
      return 'Nouvel événement';
    }
    return this.repris()?.recurrence
      ? 'Modifier la série'
      : "Modifier l'événement";
  });

  protected readonly repete = computed(() => this.repetition().active);
  protected readonly choisitSesJours = computed(() =>
    choisitSesJours(this.repetition().frequence),
  );
  protected readonly unite = computed(() =>
    uniteDe(this.repetition().frequence),
  );

  protected readonly pretAEnregistrer = computed(() => {
    if (this.etatDeLaCible() !== 'ready') {
      return false;
    }
    const { titre, debut, espaceId } = this.saisie();
    return (
      titre.trim().length > 0 &&
      debut.length > 0 &&
      espaceId.length > 0 &&
      versRegle(this.repetition()) !== undefined
    );
  });

  protected readonly iconeSupprimer = matDeleteOutline;

  constructor() {
    // Une nouvelle saisie suit l'Espace pré-choisi tant qu'on n'en a pas
    // choisi un dans le champ ; un Événement repris garde le sien.
    effect(() => {
      const preChoisi = this.espaceCourant.espace();
      if (!preChoisi || !this.creation || this.espaceChoisiALaMain()) {
        return;
      }
      untracked(() =>
        this.saisie.update((saisie) => ({ ...saisie, espaceId: preChoisi.id })),
      );
    });

    if (this.creation) {
      this.preremplir(SAISIE_VIERGE);
      return;
    }

    // Un identifiant qui ne désigne rien de visible ramène au mois, sans un
    // mot : c'est le même silence que partout ailleurs, et il ne confirme pas
    // l'existence d'un Événement hors de portée (ADR 0028).
    effect(() => {
      const erreur = this.lu.error();
      if (erreur && estIntrouvable(erreur)) {
        untracked(() => this.fermer());
      }
    });

    effect(() => {
      const cible = this.cible();
      if (memeCible(this.repriseDe, cible)) {
        return;
      }
      // Une autre cible : ce qui était repris ne vaut plus pour elle, même
      // quand c'est le même Événement, ouvert cette fois sur une occurrence.
      untracked(() => this.enEdition.set(null));

      const evenement =
        this.lu.status() === 'resolved' ? this.lu.value() : undefined;
      if (!evenement || evenement.id !== cible.id) {
        return;
      }

      const portee =
        evenement.recurrence !== null && designeUneOccurrence(cible);
      // L'occurrence se retrouve dans le mois lu, que le lien désigne.
      if (portee && this.calendrier.lecture.status() !== 'resolved') {
        return;
      }

      this.repriseDe = cible;
      untracked(() =>
        portee
          ? void this.demanderLaPortee(evenement, cible)
          : this.reprendre(evenement),
      );
    });
  }

  /*
   * Les deux suivantes sont des propriétés-flèches et non des méthodes :
   * `hlm-select` les reçoit comme `itemToString` et les appelle détachées de
   * l'instance, pour afficher dans le déclencheur ce qui a été choisi.
   */

  protected readonly nomDuRappel = (
    rappel: string | null | undefined,
  ): string =>
    rappel ? `${libelleDuRappel(Number(rappel))} avant` : 'Sans rappel';

  /**
   * Les paliers offerts, plus celui que porte l'Événement repris (ou la
   * requête) s'il n'en est pas un : sans cela, l'ouvrir puis l'enregistrer
   * effacerait son rappel.
   */
  protected readonly paliersOfferts = computed(() => {
    const pose = this.saisieInitiale().reminderLeadMinutes;
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

  private readonly saisieInitiale = computed(
    (): Partial<EventInput> => ({
      ...(this.repris() ?? {}),
      ...this.prerempli(),
    }),
  );

  /** Les champs de saisie libre, qui portent leur valeur dans l'événement. */
  protected saisir(champ: keyof Saisie, evenement: globalThis.Event): void {
    const valeur = (evenement.target as HTMLInputElement).value;

    this.saisie.update((saisie) => ({ ...saisie, [champ]: valeur }));
  }

  /** Les champs à choix, qui émettent directement la valeur choisie. */
  protected choisir(champ: keyof Saisie, valeur: unknown): void {
    const choisie = typeof valeur === 'string' ? valeur : '';
    if (champ === 'espaceId' && choisie !== this.saisie().espaceId) {
      this.espaceChoisiALaMain.set(true);
    }
    this.saisie.update((saisie) => ({ ...saisie, [champ]: choisie }));
  }

  protected fermer(): void {
    void this.calendrier.fermer();
  }

  protected relire(): void {
    if (this.lu.error()) {
      this.lu.reload();
    }
    if (this.calendrier.lecture.error()) {
      this.calendrier.lecture.reload();
    }
  }

  protected repeter(active: boolean): void {
    this.repetition.update((saisie) => ({ ...saisie, active }));
  }

  protected choisirLaRepetition<C extends keyof SaisieDeRecurrence>(
    champ: C,
    valeur: SaisieDeRecurrence[C] | null | undefined,
  ): void {
    if (valeur === null || valeur === undefined) {
      return;
    }
    this.repetition.update((saisie) => ({ ...saisie, [champ]: valeur }));
  }

  protected basculerLeJour(jour: SaisieDeRecurrence['jours'][number]): void {
    this.repetition.update((saisie) => ({
      ...saisie,
      jours: saisie.jours.includes(jour)
        ? saisie.jours.filter((choisi) => choisi !== jour)
        : [...saisie.jours, jour],
    }));
  }

  /** Les champs libres de la répétition : un jour, ou un nombre entier. */
  protected saisirLaRepetition(
    champ: 'jusquAu' | 'intervalle' | 'nombre',
    evenement: globalThis.Event,
  ): void {
    const valeur = (evenement.target as HTMLInputElement).value;
    this.repetition.update((saisie) => ({
      ...saisie,
      [champ]: champ === 'jusquAu' ? valeur : valeur ? Number(valeur) : NaN,
    }));
  }

  protected enregistrer(): void {
    if (!this.pretAEnregistrer() || this.envoi()) {
      return;
    }

    // Seule la route de création crée : une modification sans Événement repris
    // n'envoie rien.
    if (!this.creation) {
      const repris = this.repris();
      if (repris) {
        this.appliquer(repris);
      }
      return;
    }

    this.envoyer(this.api.creer(this.saisieCreee()), 'Événement créé.');
  }

  protected async supprimer(): Promise<void> {
    const repris = this.repris();
    if (!repris || this.envoi()) {
      return;
    }

    const confirme = await this.confirmation.confirm({
      title: "Supprimer l'événement ?",
      description: repris.recurrence
        ? `« ${repris.title} » est une série : toutes ses occurrences seront supprimées.`
        : `« ${repris.title} » sera supprimé du Calendrier.`,
      confirmLabel: "Supprimer l'événement",
      destructive: true,
    });
    if (!confirme) {
      return;
    }

    this.envoyer(this.api.supprimer(repris.id), 'Événement supprimé.');
  }

  /**
   * Une écriture a abouti : le mois est relu, la réussite confirmée par un
   * toast, et le formulaire se ferme. Un refus reste dans le formulaire, sous
   * le champ qu'il vise ou en bandeau.
   */
  private envoyer(
    ecriture: { subscribe: (observateur: object) => unknown },
    confirmation: string,
  ): void {
    this.refus.set(null);
    this.envoi.set(true);
    ecriture.subscribe({
      next: () => {
        showToast({ tone: 'success', message: confirmation });
        this.calendrier.relire();
        this.fermer();
      },
      error: (refus: ApiError) => {
        this.envoi.set(false);
        this.refus.set(refus);
      },
    });
  }

  /**
   * La requête, lue par le contrat de l'entrée, posée sur la saisie de
   * départ. Un Espace qu'elle nomme est un choix : le sélecteur de la TopBar
   * ne le remplace pas.
   */
  private preremplir(depart: Saisie): void {
    const { valeurs, ignores } = prefillDepuisRequete(
      zEventInput,
      this.route.snapshot.queryParamMap,
    );

    this.prerempli.set(valeurs);
    this.ignores.set(ignores);
    this.espaceChoisiALaMain.set(valeurs.scopeId !== undefined);
    this.saisie.set({
      titre: valeurs.title ?? depart.titre,
      debut: valeurs.startsAt ? versChampLocal(valeurs.startsAt) : depart.debut,
      fin:
        valeurs.endsAt === undefined
          ? depart.fin
          : valeurs.endsAt
            ? versChampLocal(valeurs.endsAt)
            : '',
      categorie: valeurs.category ?? depart.categorie,
      espaceId: valeurs.scopeId ?? depart.espaceId,
      rappel:
        valeurs.reminderLeadMinutes === undefined
          ? depart.rappel
          : (valeurs.reminderLeadMinutes?.toString() ?? ''),
    });
  }

  /**
   * Le lien désigne une occurrence de la série : on demande ce que la
   * modification touche, à chaque fois. Une occurrence que le mois ne montre
   * pas (déjà supprimée, ou d'un autre mois) ramène au mois, sans un mot.
   *
   * Elle se retrouve par son identité quand le lien la porte : une exception
   * peut en avoir déplacé une autre au même instant.
   */
  private async demanderLaPortee(serie: Event, cible: Cible): Promise<void> {
    const occurrence = this.calendrier
      .occurrences()
      .find(
        ({ eventId, originalStart, startsAt }) =>
          eventId === serie.id &&
          (cible.occurrence !== null
            ? memeInstant(originalStart, cible.occurrence)
            : memeInstant(startsAt, cible.debut)),
      );
    if (!occurrence) {
      await this.fermer();
      return;
    }

    const portee = await this.confirmation.chooseScope({
      title: `Modifier « ${occurrence.title} » ?`,
      description: `« ${serie.title} » est une série : choisissez ce que la modification touche.`,
      confirmLabel: 'Modifier',
      occurrenceDescription: `Seule l'occurrence du ${dateDe(occurrence)} change ; les autres restent intactes.`,
    });

    // Le formulaire choisi reprend le préremplissage du lien ; seule la
    // désignation de l'occurrence s'arrête ici.
    const requete = {
      ...this.route.snapshot.queryParams,
      [PARAMETRE_DE_MOIS]: this.calendrier.mois(),
      [PARAMETRE_D_OCCURRENCE]: null,
      [PARAMETRE_DE_DEBUT]: null,
    };
    if (portee === 'occurrence') {
      await this.router.navigate(
        [
          '/calendrier/evenements',
          serie.id,
          'occurrences',
          occurrence.originalStart,
        ],
        { queryParams: requete, replaceUrl: true },
      );
    } else if (portee === 'series') {
      await this.router.navigate(['/calendrier/evenements', serie.id], {
        queryParams: requete,
        replaceUrl: true,
      });
    } else {
      await this.fermer();
    }
  }

  private reprendre(evenement: Event): void {
    this.refus.set(null);
    this.enEdition.set(evenement);
    this.repetition.set(versSaisie(evenement.recurrence));
    this.preremplir({
      titre: evenement.title,
      debut: versChampLocal(evenement.startsAt),
      fin: evenement.endsAt ? versChampLocal(evenement.endsAt) : '',
      categorie: evenement.category,
      espaceId: evenement.scopeId,
      rappel: evenement.reminderLeadMinutes?.toString() ?? '',
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
      this.fermer();
      return;
    }

    this.envoyer(
      this.api.modifier(repris.id, changements),
      repris.recurrence ? 'Série modifiée.' : 'Événement modifié.',
    );
  }

  /**
   * Sur une série, les horaires sont ceux de sa première occurrence : les
   * changer déplace toutes les autres, sauf celles qu'une exception a déjà
   * déplacées.
   */
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
    if (!memeRegle(voulu.recurrence ?? null, repris.recurrence)) {
      changements.recurrence = voulu.recurrence ?? null;
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
      recurrence: versRegle(this.repetition()) ?? null,
      scopeId: espaceId,
    };
  }
}

function estIntrouvable(erreur: Error): boolean {
  return erreur instanceof ErreurApi && erreur.status === 404;
}

/** La date d'une occurrence, telle qu'un choix de portée la nomme. */
export function dateDe(occurrence: EventOccurrence): string {
  return formaterInstant(occurrence.startsAt, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** Deux instants, comparés comme des instants et non comme des chaînes. */
export function memeInstant(gauche: string | null, droite: string | null): boolean {
  if (gauche === null || droite === null) {
    return gauche === droite;
  }
  return new Date(gauche).getTime() === new Date(droite).getTime();
}

/** L'ISO-8601 du contrat, rendu au champ qui saisit en heure locale. */
export function versChampLocal(iso: string): string {
  const instant = new Date(iso);
  const deuxChiffres = (valeur: number) => valeur.toString().padStart(2, '0');

  return (
    `${instant.getFullYear()}-${deuxChiffres(instant.getMonth() + 1)}` +
    `-${deuxChiffres(instant.getDate())}` +
    `T${deuxChiffres(instant.getHours())}:${deuxChiffres(instant.getMinutes())}`
  );
}

/** L'heure locale du champ, rendue au contrat en ISO-8601. */
export function versIso(local: string): string {
  return new Date(local).toISOString();
}
