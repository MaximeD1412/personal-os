import type { ModuleSummary, Signal, Todo } from '@personal-os/contracts';

/**
 * Le Calculateur d'À faire : ce que le tableau de bord présente comme
 * requérant l'attention, tiré des Résumés de module à l'instant de la lecture.
 *
 * Il est pur, et c'est ce qui garantit ADR 0017 : rien n'est stocké, rien ne
 * se coche. Un À faire disparaît parce que le module a cessé de le signaler.
 *
 * Il ne connaît aucun module : il ne lit que des signaux, chacun avec le lien
 * vers l'écran qui le résout, que seul son module sait donner (ADR 0011).
 *
 * L'échéance la plus proche passe d'abord, tous modules confondus ; ce qui
 * n'en a pas vient ensuite. À égalité, l'ordre des modules puis celui de
 * leurs signaux est gardé : le tri est stable.
 */
export function aFaire(resumes: readonly ModuleSummary[]): Todo[] {
  return resumes
    .flatMap(({ module, signals }) =>
      signals.map((signal): Todo => ({ module, ...signal })),
    )
    .sort(parEcheance);
}

function parEcheance(gauche: Signal, droite: Signal): number {
  if (gauche.dueOn === droite.dueOn) {
    return 0;
  }
  if (gauche.dueOn === undefined) {
    return 1;
  }
  if (droite.dueOn === undefined) {
    return -1;
  }
  // Deux `zDay` se comparent comme des chaînes : `YYYY-MM-DD` est dans l'ordre.
  return gauche.dueOn.localeCompare(droite.dueOn);
}
