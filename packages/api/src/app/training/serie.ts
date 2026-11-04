import {
  instantDans,
  JOURS_DE_LA_SEMAINE,
  SEANCES_PAR_SERIE_AU_PLUS,
  type TrainingSeriesInput,
  type Weekday,
} from '@personal-os/contracts';
import { enHeureMurale } from '../calendar/recurrence/heure-de-paris';
import { ErreurMetier } from '../erreurs/erreur-metier';

/** Ce qui situe les Séances d'une série dans le calendrier. */
export type JoursDeLaSerie = Pick<
  TrainingSeriesInput,
  'weekdays' | 'from' | 'to' | 'time'
>;

const UN_JOUR_MS = 24 * 60 * 60 * 1000;

/**
 * Le début de chaque Séance d'une série vers un Objectif : une par jour de la
 * période (bornes comprises) qui tombe sur un des jours de la semaine choisis
 * (`MO` à `SU`), à l'heure murale de Paris, changement d'heure compris.
 *
 * Il n'existe ni plan ni semaine (ADR 0022) : la série ne laisse que des
 * Séances indépendantes. Elle en donne au moins une, et au plus
 * `SEANCES_PAR_SERIE_AU_PLUS` : au-delà, c'est une erreur de saisie plus
 * qu'une préparation, et rien n'est créé. Une heure que l'horloge de Paris
 * saute un des jours (entre 2 h et 3 h au passage à l'heure d'été) refuse
 * aussi la série, plutôt que de poser la Séance à une autre heure.
 */
export function planifierLaSerie(serie: JoursDeLaSerie): string[] {
  const jours = new Set(serie.weekdays);
  const [heure, minute] = serie.time.split(':').map(Number);
  const fin = Date.parse(`${serie.to}T00:00:00Z`);
  const debuts: string[] = [];

  for (
    let jour = Date.parse(`${serie.from}T00:00:00Z`);
    jour <= fin;
    jour += UN_JOUR_MS
  ) {
    const date = new Date(jour);
    if (!jours.has(jourDe(date))) {
      continue;
    }
    if (debuts.length === SEANCES_PAR_SERIE_AU_PLUS) {
      throw new ErreurMetier(
        'training.series_too_long',
        `Une série crée au plus ${SEANCES_PAR_SERIE_AU_PLUS} Séances : raccourcissez la période ou retirez des jours.`,
      );
    }
    const debut = instantDans(
      date.toISOString().slice(0, 10),
      heure ?? 0,
      minute ?? 0,
    );
    if (
      enHeureMurale(new Date(debut)).heure !==
      ((heure ?? 0) * 60 + (minute ?? 0)) * 60_000
    ) {
      throw new ErreurMetier(
        'training.series_nonexistent_time',
        `${serie.time} n'existe pas à Paris le ${jourEnClair(date)}, jour du passage à l'heure d'été : choisissez une autre heure.`,
      );
    }
    debuts.push(debut);
  }

  if (debuts.length === 0) {
    throw new ErreurMetier(
      'training.series_empty',
      'Aucun des jours choisis ne tombe dans la période : la série ne crée aucune Séance.',
    );
  }

  return debuts;
}

/** Le jour de la semaine d'un jour à minuit UTC, au nom d'iCalendar. */
function jourDe(date: Date): Weekday {
  return JOURS_DE_LA_SEMAINE[(date.getUTCDay() + 6) % 7];
}

/** Un jour à minuit UTC, écrit en français : « dimanche 28 mars 2027 ». */
function jourEnClair(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'UTC',
    dateStyle: 'full',
  }).format(date);
}
