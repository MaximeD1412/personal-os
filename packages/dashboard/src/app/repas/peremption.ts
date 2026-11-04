import { joursAvantPeremption, perimeBientot } from '@personal-os/contracts';

/**
 * Ce que l'écran du stock dit d'une péremption proche, ou passée : « Périmé »,
 * « Périme aujourd'hui », « Périme demain », « Périme dans 3 jours ». Rien
 * au-delà des trois jours, ni sans péremption connue.
 */
export function alerteDePeremption(
  expiresOn: string | null,
  jour: string,
): string | null {
  if (expiresOn === null || !perimeBientot(expiresOn, jour)) return null;

  const jours = joursAvantPeremption(expiresOn, jour);
  if (jours < 0) return 'Périmé';
  if (jours === 0) return "Périme aujourd'hui";
  if (jours === 1) return 'Périme demain';
  return `Périme dans ${jours}\u00a0jours`;
}
