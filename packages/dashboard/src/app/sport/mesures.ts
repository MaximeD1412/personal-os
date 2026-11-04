import type { TrainingSport } from '@personal-os/contracts';

/*
 * Les mesures d'une Séance : le contrat les porte en mètres et en secondes
 * entières, l'écran les lit en kilomètres et en heures, et l'allure se calcule
 * ici, à l'affichage, sans jamais être stockée.
 */

const MOINS = '−';

const kilometres = new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 2,
});
const vitesse = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

/** « 11,2 km », ou « 800 m » sous le kilomètre. */
export function formaterDistance(metres: number): string {
  return metres < 1000
    ? `${metres} m`
    : `${kilometres.format(metres / 1000)} km`;
}

/** « 1 h 04 » à partir d'une heure, sinon « 45 min » ou « 58 min 12 s ». */
export function formaterDuree(secondes: number): string {
  const heures = Math.floor(secondes / 3600);
  const minutes = Math.floor((secondes % 3600) / 60);
  const reste = secondes % 60;

  if (heures > 0) {
    return `${heures} h ${deuxChiffres(minutes)}`;
  }
  if (minutes === 0) {
    return `${reste} s`;
  }
  return reste === 0 ? `${minutes} min` : `${minutes} min ${reste} s`;
}

/**
 * L'allure, selon ce que le sport compte : minutes au kilomètre pour la course
 * (et un sport « autre »), minutes aux 100 m pour la natation, kilomètres par
 * heure pour le vélo. Le renforcement n'en a pas.
 */
export function allure(
  sport: TrainingSport,
  distanceM: number | null,
  dureeS: number | null,
): string | null {
  const secondes = secondesParUnite(sport, distanceM, dureeS);
  if (secondes === null || !distanceM || !dureeS) {
    return null;
  }
  if (sport === 'BIKE') {
    return `${vitesse.format(distanceM / 1000 / (dureeS / 3600))} km/h`;
  }
  const minutes = Math.floor(secondes / 60);
  const unite = sport === 'SWIM' ? '/100 m' : '/km';
  return `${minutes}:${deuxChiffres(secondes % 60)} ${unite}`;
}

export function ecartDeDistance(
  prevu: number | null,
  realise: number | null,
): string | null {
  return ecart(prevu, realise, formaterDistance);
}

export function ecartDeDuree(
  prevu: number | null,
  realise: number | null,
): string | null {
  return ecart(prevu, realise, formaterDuree);
}

export interface Mesure {
  distanceM: number | null;
  dureeS: number | null;
}

/**
 * L'écart d'allure, en secondes par unité (« −17 s » : plus rapide que prévu).
 * Le vélo se compare en vitesse, que l'écart de distance et de durée dit déjà :
 * il n'en a pas.
 */
export function ecartDAllure(
  sport: TrainingSport,
  prevu: Mesure,
  realise: Mesure,
): string | null {
  if (sport === 'BIKE') {
    return null;
  }
  return ecart(
    secondesParUnite(sport, prevu.distanceM, prevu.dureeS),
    secondesParUnite(sport, realise.distanceM, realise.dureeS),
    (secondes) => formaterDuree(secondes),
  );
}

/** Des kilomètres saisis (« 10,5 »), en mètres ; `null` s'ils ne se lisent pas. */
export function lireDistance(texte: string): number | null {
  const propre = texte.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(propre)) {
    return null;
  }
  const metres = Math.round(Number(propre) * 1000);
  return metres > 0 ? metres : null;
}

/**
 * Une durée saisie, en secondes : « 45 » (minutes), « 45:30 » (minutes et
 * secondes) ou « 1:04:30 » (heures, minutes, secondes).
 */
export function lireDuree(texte: string): number | null {
  const parties = texte.trim().split(':');
  if (parties.some((partie) => !/^\d+$/.test(partie)) || parties.length > 3) {
    return null;
  }
  const nombres = parties.map(Number);
  if (nombres.slice(1).some((nombre) => nombre > 59)) {
    return null;
  }

  const [a, b = 0, c = 0] = nombres;
  const secondes = nombres.length === 3 ? a * 3600 + b * 60 + c : a * 60 + b;
  return secondes > 0 ? secondes : null;
}

/** Les mètres du contrat, dans le champ qui saisit des kilomètres. */
export function saisieDeDistance(metres: number): string {
  return String(metres / 1000).replace('.', ',');
}

/** Les secondes du contrat, dans le champ qui saisit une durée. */
export function saisieDeDuree(secondes: number): string {
  const heures = Math.floor(secondes / 3600);
  const minutes = Math.floor((secondes % 3600) / 60);
  const reste = secondes % 60;

  if (heures > 0) {
    return `${heures}:${deuxChiffres(minutes)}:${deuxChiffres(reste)}`;
  }
  return reste === 0 ? `${minutes}` : `${minutes}:${deuxChiffres(reste)}`;
}

function secondesParUnite(
  sport: TrainingSport,
  distanceM: number | null,
  dureeS: number | null,
): number | null {
  if (sport === 'STRENGTH' || !distanceM || !dureeS) {
    return null;
  }
  const unite = sport === 'SWIM' ? 100 : 1000;
  return Math.round(dureeS / (distanceM / unite));
}

function ecart(
  prevu: number | null,
  realise: number | null,
  formater: (valeur: number) => string,
): string | null {
  if (prevu === null || realise === null) {
    return null;
  }
  const difference = realise - prevu;
  if (difference === 0) {
    return '=';
  }
  return `${difference > 0 ? '+' : MOINS}${formater(Math.abs(difference))}`;
}

function deuxChiffres(valeur: number): string {
  return valeur.toString().padStart(2, '0');
}
