import type { Recurrence, Weekday } from '@personal-os/contracts';
import {
  JOUR,
  enHeureMurale,
  jourDe,
  jourDeLaSemaine,
  depuisHeureMurale,
  type JourCivil,
} from './heure-de-paris';

/** Ce que le moteur lit d'un Événement : ses bornes, son titre, sa règle. */
export interface EvenementRecurrent {
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  recurrence: Recurrence | null;
}

/**
 * Une exception vise une occurrence par l'instant où la règle la place
 * (`originalStart`), et la supprime ou la modifie. Un champ vide d'une
 * modification garde la valeur de la série.
 */
export interface ExceptionDOccurrence {
  originalStart: Date;
  kind: 'CANCELLED' | 'MODIFIED';
  startsAt: Date | null;
  endsAt: Date | null;
  title: string | null;
}

/** Une période, bornes incluses. */
export interface Periode {
  debut: Date;
  fin: Date;
}

/**
 * Une occurrence calculée. `originalStart` est son identité : il ne bouge pas
 * quand une exception la déplace.
 */
export interface Occurrence {
  originalStart: Date;
  startsAt: Date;
  endsAt: Date | null;
  title: string;
}

/**
 * Les occurrences d'un Événement qui rencontrent la période, exceptions
 * appliquées, rangées par début.
 *
 * Rien n'est stocké : la règle se déroule depuis le début de l'Événement, à
 * chaque lecture, si bien qu'une règle changée se reflète aussitôt. Une
 * exception dont la règle ne produit plus l'occurrence est ignorée.
 *
 * Le calcul se fait en heure de Paris : une réunion à 9 h reste à 9 h après le
 * changement d'heure. Une heure qui n'existe pas (le saut de mars) se lit avec
 * le décalage d'avant le saut, une heure qui existe deux fois (le retour
 * d'octobre) se lit à la première, comme en iCalendar.
 *
 * Un Événement sans règle est une série d'une seule occurrence : les
 * exceptions s'y appliquent de la même façon.
 */
export function occurrences(
  evenement: EvenementRecurrent,
  exceptions: readonly ExceptionDOccurrence[],
  periode: Periode,
): Occurrence[] {
  const parOrigine = new Map(
    exceptions.map((exception) => [
      exception.originalStart.getTime(),
      exception,
    ]),
  );

  return originesDansLaFenetre(evenement, parOrigine, periode)
    .map((origine) =>
      appliquer(origine, parOrigine.get(origine.startsAt.getTime())),
    )
    .filter((occurrence): occurrence is Occurrence => occurrence !== null)
    .filter((occurrence) => rencontre(occurrence, periode))
    .sort(
      (gauche, droite) =>
        gauche.startsAt.getTime() - droite.startsAt.getTime() ||
        gauche.originalStart.getTime() - droite.originalStart.getTime(),
    );
}

/**
 * Les occurrences telles que la règle les place, sans exception, réduites à
 * celles qui peuvent rencontrer la période : celles qui en sont assez proches,
 * et celles qu'une exception pourrait y avoir déplacées.
 *
 * La règle se déroule toujours depuis le début de la série, parce que `count`
 * compte depuis lui ; seules les occurrences retenues sont converties en
 * instants, le reste n'est qu'un calcul de jours.
 */
function originesDansLaFenetre(
  evenement: EvenementRecurrent,
  parOrigine: ReadonlyMap<number, ExceptionDOccurrence>,
  periode: Periode,
): Occurrence[] {
  const premiere: Occurrence = {
    originalStart: evenement.startsAt,
    startsAt: evenement.startsAt,
    endsAt: evenement.endsAt,
    title: evenement.title,
  };
  const regle = evenement.recurrence;
  if (!regle) {
    return [premiere];
  }

  const debut = enHeureMurale(evenement.startsAt);
  const fin = evenement.endsAt ? enHeureMurale(evenement.endsAt) : null;
  const dureeEnJours = fin ? fin.jour - debut.jour : 0;

  // Une occurrence qui commence avant la période peut encore la rencontrer
  // par sa durée ; un jour de marge couvre les décalages horaires.
  const premierJourUtile = jourDe(periode.debut) - dureeEnJours - 1;
  const horizon = Math.max(periode.fin.getTime(), ...[...parOrigine.keys()]);
  const dernierJourUtile = jourDe(new Date(horizon)) + 1;
  const joursVises = new Set(
    [...parOrigine.keys()].map((cle) => jourDe(new Date(cle))),
  );
  const dernierJourDeLaRegle =
    regle.until !== undefined ? jourCivilDe(regle.until) : Infinity;

  const retenues: Occurrence[] = [premiere];
  let comptees = 1;

  const dernierJour = Math.min(dernierJourUtile, dernierJourDeLaRegle);

  for (const jour of joursDeLaRegle(debut.jour, regle, dernierJour)) {
    if (regle.count !== undefined && comptees >= regle.count) {
      break;
    }
    comptees += 1;

    if (jour < premierJourUtile && !joursVises.has(jour)) {
      continue;
    }

    const startsAt = depuisHeureMurale(jour, debut.heure);
    const endsAt = fin
      ? new Date(
          Math.max(
            startsAt.getTime(),
            depuisHeureMurale(jour + dureeEnJours, fin.heure).getTime(),
          ),
        )
      : null;
    retenues.push({
      originalStart: startsAt,
      startsAt,
      endsAt,
      title: evenement.title,
    });
  }

  return retenues;
}

/**
 * Les jours civils de la règle qui suivent strictement le premier, dans
 * l'ordre, jusqu'au dernier inclus.
 *
 * La borne se vérifie sur chaque jour **parcouru**, et non sur chaque jour
 * rendu : une règle valide peut ne plus jamais tomber sur un de ses jours
 * (tous les sept jours depuis un lundi, mais le mardi), et un parcours qui
 * attendrait un jour rendu pour s'arrêter ne s'arrêterait pas.
 */
function* joursDeLaRegle(
  premier: JourCivil,
  regle: Recurrence,
  dernier: JourCivil,
): Generator<JourCivil> {
  const pas = regle.interval;

  switch (regle.freq) {
    case 'DAILY': {
      const retenus = decalagesDesJours(regle.byWeekday);
      for (let jour = premier + pas; jour <= dernier; jour += pas) {
        if (!retenus || retenus.has(jourDeLaSemaine(jour))) {
          yield jour;
        }
      }
      return;
    }
    case 'WEEKLY': {
      const decalages = [
        ...(decalagesDesJours(regle.byWeekday) ??
          new Set([jourDeLaSemaine(premier)])),
      ].sort((a, b) => a - b);
      const lundi = premier - jourDeLaSemaine(premier);
      for (let semaine = lundi; semaine <= dernier; semaine += 7 * pas) {
        for (const decalage of decalages) {
          const jour = semaine + decalage;
          if (jour > dernier) {
            return;
          }
          if (jour > premier) {
            yield jour;
          }
        }
      }
      return;
    }
    case 'MONTHLY':
    case 'YEARLY': {
      const date = new Date(premier * JOUR);
      const annee = date.getUTCFullYear();
      const mois = date.getUTCMonth();
      const quantieme = date.getUTCDate();
      const moisParPas = regle.freq === 'MONTHLY' ? pas : 12 * pas;
      for (let rang = 1; ; rang += 1) {
        const candidat = new Date(
          Date.UTC(annee, mois + rang * moisParPas, quantieme),
        );
        const jour = candidat.getTime() / JOUR;
        // Un intervalle démesuré sort des dates représentables : `jour` vaut
        // alors NaN, que ni la borne ni le quantième ne reconnaîtraient. Une
        // date qu'on ne sait pas écrire est au-delà de toute période.
        if (Number.isNaN(jour) || jour > dernier) {
          return;
        }
        // Un 31 dans un mois de 30 jours, un 29 février hors année
        // bissextile : la date « déborde » sur le mois suivant, et ce mois-là
        // n'a pas d'occurrence.
        if (candidat.getUTCDate() === quantieme) {
          yield jour;
        }
      }
    }
  }
}

const DECALAGES: Readonly<Record<Weekday, number>> = {
  MO: 0,
  TU: 1,
  WE: 2,
  TH: 3,
  FR: 4,
  SA: 5,
  SU: 6,
};

/** Les jours de la semaine nommés, en décalage depuis le lundi. */
function decalagesDesJours(
  jours: readonly Weekday[] | undefined,
): Set<number> | null {
  return jours ? new Set(jours.map((jour) => DECALAGES[jour])) : null;
}

function jourCivilDe(jour: string): JourCivil {
  return Date.parse(`${jour}T00:00:00Z`) / JOUR;
}

/**
 * L'occurrence, son exception appliquée. Une modification sans fin propre
 * garde la durée de l'occurrence là où elle la déplace.
 */
function appliquer(
  origine: Occurrence,
  exception: ExceptionDOccurrence | undefined,
): Occurrence | null {
  if (!exception) {
    return origine;
  }
  if (exception.kind === 'CANCELLED') {
    return null;
  }

  const startsAt = exception.startsAt ?? origine.startsAt;
  const duree = origine.endsAt
    ? origine.endsAt.getTime() - origine.startsAt.getTime()
    : null;

  return {
    originalStart: origine.originalStart,
    startsAt,
    endsAt:
      exception.endsAt ??
      (duree === null ? null : new Date(startsAt.getTime() + duree)),
    title: exception.title ?? origine.title,
  };
}

/**
 * Une occurrence rencontre la période si elle commence avant sa fin et finit
 * après son début ; sans fin distincte, elle finit là où elle commence.
 */
function rencontre(occurrence: Occurrence, periode: Periode): boolean {
  const fin = occurrence.endsAt ?? occurrence.startsAt;

  return (
    occurrence.startsAt.getTime() <= periode.fin.getTime() &&
    fin.getTime() >= periode.debut.getTime()
  );
}
