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
  zEventOccurrenceUpdate,
  type ApiError,
  type EventOccurrence,
  type EventOccurrenceRef,
  type EventOccurrenceUpdate,
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
import { showToast } from '@personal-os/ui/sonner';
import { map, type Observable } from 'rxjs';
import { EventService } from './event.service';
import { erreursDeChamp, prefillDepuisRequete } from './formulaire';
import {
  dateDe,
  memeInstant,
  versChampLocal,
  versIso,
} from './formulaire-d-evenement';
import { BUREAU, Largeur } from './largeur';
import { MoisDuCalendrier } from './mois-du-calendrier';

interface Saisie {
  titre: string;
  debut: string;
  fin: string;
}

/**
 * Le formulaire d'une seule occurrence d'une série, à sa route :
 * `/calendrier/evenements/:id/occurrences/:originalStart`. On y arrive après
 * avoir choisi « Cette occurrence uniquement » (AGENDA-2).
 *
 * Il ne porte que ce qu'une exception change : le titre et les horaires. Le
 * reste (catégorie, Espace, rappel, règle) appartient à la série, et se
 * modifie avec elle. L'enregistrer pose une exception ; la règle ne change
 * pas.
 *
 * Il se préremplit depuis la requête (ADR 0030) : `title`, `startsAt`,
 * `endsAt`, validés par le contrat de l'occurrence. Un champ de l'Événement
 * qu'une occurrence ne porte pas (`category`, `scopeId`…) est signalé comme
 * non repris, et non oublié en silence.
 */
@Component({
  selector: 'pos-formulaire-d-occurrence',
  templateUrl: './formulaire-d-occurrence.html',
  imports: [
    NgIcon,
    HlmButton,
    HlmInput,
    HlmFieldImports,
    DccmFormPage,
    DccmState,
  ],
})
export class FormulaireDOccurrence {
  private readonly calendrier = inject(MoisDuCalendrier);
  private readonly api = inject(EventService);
  private readonly route = inject(ActivatedRoute);
  private readonly confirmation = inject(DccmConfirm);

  protected readonly presentation = computed(() =>
    this.bureau() ? 'panel' : 'sheet',
  );
  private readonly bureau = inject(Largeur).auMoins(BUREAU);

  /** L'occurrence que l'URL désigne : sa série, et l'instant où la règle la place. */
  private readonly cible = toSignal(
    this.route.paramMap.pipe(
      map(
        (parametres): EventOccurrenceRef => ({
          id: parametres.get('id') ?? '',
          originalStart: parametres.get('originalStart') ?? '',
        }),
      ),
    ),
    { requireSync: true },
  );
  private repriseDe: EventOccurrenceRef | null = null;

  private readonly enEdition = signal<EventOccurrence | null>(null);
  /**
   * L'occurrence reprise, tant qu'elle est celle que l'URL désigne : d'une
   * occurrence à l'autre, la précédente ne reçoit plus aucune écriture.
   */
  protected readonly repris = computed(() => {
    const occurrence = this.enEdition();
    const { id, originalStart } = this.cible();
    return occurrence &&
      occurrence.eventId === id &&
      memeInstant(occurrence.originalStart, originalStart)
      ? occurrence
      : null;
  });
  protected readonly saisie = signal<Saisie>({ titre: '', debut: '', fin: '' });

  protected readonly refus = signal<ApiError | null>(null);
  protected readonly erreurs = computed(() => erreursDeChamp(this.refus()));
  protected readonly envoi = signal(false);
  /** Les paramètres de la requête que le formulaire n'a pas pu reprendre. */
  protected readonly ignores = signal<string[]>([]);

  protected readonly etatDeLaCible = computed((): DccmStateStatus => {
    if (this.repris()) {
      return 'ready';
    }
    return this.calendrier.lecture.status() === 'error' ? 'error' : 'loading';
  });
  protected readonly erreurDeLecture = computed(() =>
    this.calendrier.lecture.error(),
  );

  protected readonly sousTitre = computed(() => {
    const occurrence = this.repris();
    return occurrence
      ? `Occurrence du ${dateDe(occurrence)}`
      : 'Calendrier';
  });

  protected readonly pretAEnregistrer = computed(() => {
    const { titre, debut } = this.saisie();
    return (
      this.etatDeLaCible() === 'ready' &&
      titre.trim().length > 0 &&
      debut.length > 0
    );
  });

  protected readonly iconeSupprimer = matDeleteOutline;

  constructor() {
    // L'occurrence se retrouve dans le mois lu : le lien porte le mois où elle
    // tombe. Une occurrence que le mois ne montre pas (supprimée entre-temps,
    // ou hors de portée) ramène au mois, sans un mot (ADR 0028).
    effect(() => {
      const cible = this.cible();
      if (
        this.repriseDe?.id === cible.id &&
        this.repriseDe.originalStart === cible.originalStart
      ) {
        return;
      }
      untracked(() => this.enEdition.set(null));
      if (this.calendrier.lecture.status() !== 'resolved') {
        return;
      }
      this.repriseDe = cible;
      untracked(() => this.reprendre(cible));
    });
  }

  protected saisir(champ: keyof Saisie, evenement: globalThis.Event): void {
    const valeur = (evenement.target as HTMLInputElement).value;

    this.saisie.update((saisie) => ({ ...saisie, [champ]: valeur }));
  }

  protected fermer(): void {
    void this.calendrier.fermer();
  }

  protected relireLeMois(): void {
    this.calendrier.lecture.reload();
  }

  /**
   * Seul ce qui change part. Une fin effacée part à `null` : l'occurrence
   * perd sa fin propre et reprend la durée des autres.
   */
  protected enregistrer(): void {
    const occurrence = this.repris();
    if (!occurrence || !this.pretAEnregistrer() || this.envoi()) {
      return;
    }

    const { titre, debut, fin } = this.saisie();
    const changements: EventOccurrenceUpdate = {};
    if (titre.trim() !== occurrence.title) {
      changements.title = titre.trim();
    }
    if (!memeInstant(versIso(debut), occurrence.startsAt)) {
      changements.startsAt = versIso(debut);
    }
    const finVoulue = fin ? versIso(fin) : null;
    if (!memeInstant(finVoulue, occurrence.endsAt)) {
      changements.endsAt = finVoulue;
    }

    if (Object.keys(changements).length === 0) {
      this.fermer();
      return;
    }

    this.envoyer(
      this.api.modifierLOccurrence(this.reference(occurrence), changements),
      'Occurrence modifiée.',
    );
  }

  /** Supprimer demande, lui aussi, ce qu'il touche : rien n'est choisi d'avance. */
  protected async supprimer(): Promise<void> {
    const occurrence = this.repris();
    if (!occurrence || this.envoi()) {
      return;
    }

    const portee = await this.confirmation.chooseScope({
      title: `Supprimer « ${occurrence.title} » ?`,
      description: "Cette occurrence fait partie d'une série.",
      confirmLabel: 'Supprimer',
      destructive: true,
      occurrenceDescription: `Seule l'occurrence du ${dateDe(occurrence)} est supprimée ; les autres restent.`,
      seriesDescription: 'Toutes les occurrences de la série sont supprimées.',
    });

    if (portee === 'occurrence') {
      this.envoyer(
        this.api.supprimerLOccurrence(this.reference(occurrence)),
        'Occurrence supprimée.',
      );
    } else if (portee === 'series') {
      this.envoyer(this.api.supprimer(occurrence.eventId), 'Série supprimée.');
    }
  }

  private reprendre({ id, originalStart }: EventOccurrenceRef): void {
    const occurrence = this.calendrier
      .occurrences()
      .find(
        (candidate) =>
          candidate.eventId === id &&
          memeInstant(candidate.originalStart, originalStart),
      );

    if (!occurrence?.isRecurring) {
      this.fermer();
      return;
    }

    const requete = this.route.snapshot.queryParamMap;
    const { valeurs, ignores } = prefillDepuisRequete(
      zEventOccurrenceUpdate,
      requete,
    );
    const horsDeLOccurrence = Object.keys(zEventInput.shape)
      .filter((nom) => !(nom in zEventOccurrenceUpdate.shape))
      .flatMap((nom) => requete.getAll(nom).map((brut) => `${nom}=${brut}`));

    this.refus.set(null);
    this.ignores.set([...ignores, ...horsDeLOccurrence]);
    this.enEdition.set(occurrence);
    const fin = valeurs.endsAt ?? occurrence.endsAt;
    this.saisie.set({
      titre: valeurs.title ?? occurrence.title,
      debut: versChampLocal(valeurs.startsAt ?? occurrence.startsAt),
      fin: fin ? versChampLocal(fin) : '',
    });
  }

  private reference(occurrence: EventOccurrence): EventOccurrenceRef {
    return { id: occurrence.eventId, originalStart: occurrence.originalStart };
  }

  /** Comme le formulaire d'un Événement : le mois relu, un toast, la fermeture. */
  private envoyer(ecriture: Observable<unknown>, confirmation: string): void {
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
}
