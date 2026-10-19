import {
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { matDeleteOutline } from '@ng-icons/material-symbols/outline';
import {
  zEventInput,
  type ApiError,
  type EventCategory,
  type EventInput,
  type EventOccurrence,
  type EventUpdate,
} from '@personal-os/contracts';
import { HlmButton } from '@personal-os/ui/button';
import { DccmConfirm, DccmFormPage } from '@personal-os/ui/dccm';
import { HlmFieldImports } from '@personal-os/ui/field';
import { HlmInput } from '@personal-os/ui/input';
import { HlmSelectImports } from '@personal-os/ui/select';
import { showToast } from '@personal-os/ui/sonner';
import { HlmToggleGroupImports } from '@personal-os/ui/toggle-group';
import { combineLatest, map } from 'rxjs';
import { CATEGORIES } from './categories-d-evenement';
import { EspaceCourant } from './espace-courant';
import { EventService } from './event.service';
import { erreursDeChamp, prefillDepuisRequete } from './formulaire';
import { BUREAU, Largeur } from './largeur';
import { MoisDuCalendrier } from './mois-du-calendrier';
import { PARAMETRE_D_OCCURRENCE } from './modules-d-origine';

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

/** L'Événement visé par l'URL : son identifiant, et l'occurrence ouverte. */
interface Cible {
  id: string | null;
  occurrence: string | null;
}

/**
 * Le formulaire d'un Événement, à sa route : `/calendrier/evenements/nouveau`
 * pour en créer un, `/calendrier/evenements/:id` pour le modifier. Il s'ouvre
 * dans le Calendrier, en panneau à partir de 1280 px et en feuille en
 * dessous.
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
    DccmFormPage,
  ],
})
export class FormulaireDEvenement {
  private readonly calendrier = inject(MoisDuCalendrier);
  private readonly api = inject(EventService);
  private readonly route = inject(ActivatedRoute);
  private readonly confirmation = inject(DccmConfirm);
  private readonly espaceCourant = inject(EspaceCourant);

  protected readonly presentation = computed(() =>
    this.bureau() ? 'panel' : 'sheet',
  );
  private readonly bureau = inject(Largeur).auMoins(BUREAU);

  protected readonly categories = CATEGORIES;
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
        }),
      ),
    ),
    { requireSync: true },
  );
  private repriseDe: Cible | null = null;

  /** Le dernier refus d'une écriture, tel que l'API l'a formulé. */
  protected readonly refus = signal<ApiError | null>(null);
  /** Les messages de l'API, rangés sous le champ qu'ils visent. */
  protected readonly erreurs = computed(() => erreursDeChamp(this.refus()));
  protected readonly envoi = signal(false);

  /** Les paramètres de la requête que le formulaire n'a pas pu reprendre. */
  protected readonly ignores = signal<string[]>([]);
  /** Ce que la requête a prérempli. */
  private readonly prerempli = signal<Partial<EventInput>>({});

  /**
   * L'occurrence reprise dans le formulaire, ou `null` quand on en crée un.
   * La modifier modifie son Événement, donc toute la série : choisir entre
   * l'occurrence et la série relève d'AGENDA-2.
   */
  protected readonly enEdition = signal<EventOccurrence | null>(null);
  protected readonly saisie = signal<Saisie>({ ...SAISIE_VIERGE });

  /** L'Espace a été choisi dans le champ : le sélecteur ne le change plus. */
  private readonly espaceChoisiALaMain = signal(false);

  /**
   * Les bornes d'une occurrence ne sont pas celles de sa série : les envoyer
   * déplacerait le début de toute la série, ou en changerait la durée de
   * chaque occurrence. Tant que l'écran ne sait pas modifier une occurrence
   * seule (AGENDA-2), ses horaires restent hors de la modification.
   */
  protected readonly horairesVerrouilles = computed(
    () => this.enEdition()?.isRecurring ?? false,
  );

  protected readonly pretAEnregistrer = computed(() => {
    const { titre, debut, espaceId } = this.saisie();
    return titre.trim().length > 0 && debut.length > 0 && espaceId.length > 0;
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

    // L'Événement visé est cherché dans le mois lu : il n'existe pas de
    // lecture d'un Événement seul, et le lien porte le mois qui le contient.
    effect(() => {
      const cible = this.cible();
      if (
        this.calendrier.lecture.status() !== 'resolved' ||
        (this.repriseDe?.id === cible.id &&
          this.repriseDe.occurrence === cible.occurrence)
      ) {
        return;
      }
      this.repriseDe = cible;
      untracked(() => this.reprendre(cible));
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
      ...(this.enEdition() ?? {}),
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

  protected enregistrer(): void {
    if (!this.pretAEnregistrer() || this.envoi()) {
      return;
    }

    const repris = this.enEdition();
    if (repris) {
      this.appliquer(repris);
      return;
    }

    this.envoyer(this.api.creer(this.saisieCreee()), 'Événement créé.');
  }

  protected async supprimer(): Promise<void> {
    const repris = this.enEdition();
    if (!repris || this.envoi()) {
      return;
    }

    const confirme = await this.confirmation.confirm({
      title: "Supprimer l'événement ?",
      description: repris.isRecurring
        ? `« ${repris.title} » est une série : toutes ses occurrences seront supprimées.`
        : `« ${repris.title} » sera supprimé du Calendrier.`,
      confirmLabel: "Supprimer l'événement",
      destructive: true,
    });
    if (!confirme) {
      return;
    }

    this.envoyer(this.api.supprimer(repris.eventId), 'Événement supprimé.');
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
   * L'occurrence que le lien désigne, ou la première de l'Événement dans le
   * mois. Un identifiant qui ne désigne rien de visible ramène au mois, sans
   * un mot : c'est le même silence que partout ailleurs, et il ne confirme
   * pas l'existence d'un Événement hors de portée (ADR 0028).
   */
  private reprendre({ id, occurrence }: Cible): void {
    const siennes = this.calendrier
      .occurrences()
      .filter(({ eventId }) => eventId === id);
    const reprise =
      siennes.find(({ startsAt }) => memeInstant(startsAt, occurrence)) ??
      siennes[0];

    if (!reprise) {
      this.fermer();
      return;
    }

    this.refus.set(null);
    this.enEdition.set(reprise);
    this.preremplir({
      titre: reprise.title,
      debut: versChampLocal(reprise.startsAt),
      fin: reprise.endsAt ? versChampLocal(reprise.endsAt) : '',
      categorie: reprise.category,
      espaceId: reprise.scopeId,
      rappel: reprise.reminderLeadMinutes?.toString() ?? '',
    });
  }

  /**
   * Une modification ne porte que ce qui change. L'Espace n'y figure que
   * lorsqu'on déplace vraiment l'Événement — le répéter sans raison ferait
   * vérifier à la garde un déplacement qui n'a pas lieu (ADR 0028).
   */
  private appliquer(repris: EventOccurrence): void {
    const changements = this.changementsSur(repris);

    if (Object.keys(changements).length === 0) {
      this.fermer();
      return;
    }

    this.envoyer(
      this.api.modifier(repris.eventId, changements),
      'Événement modifié.',
    );
  }

  private changementsSur(repris: EventOccurrence): EventUpdate {
    const voulu = this.saisieCreee();
    const changements: EventUpdate = {};

    if (voulu.title !== repris.title) {
      changements.title = voulu.title;
    }
    if (!repris.isRecurring) {
      if (!memeInstant(voulu.startsAt, repris.startsAt)) {
        changements.startsAt = voulu.startsAt;
      }
      if (!memeInstant(voulu.endsAt ?? null, repris.endsAt)) {
        changements.endsAt = voulu.endsAt ?? null;
      }
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
