import { porteeCourante } from '@personal-os/database';

/**
 * L'Espace personnel du Compte connecté. Un module qui ne vit que là (les
 * Projets, le journal de la barre de commande) le pose lui-même à la création,
 * plutôt que de le demander (ADR 0030) : il n'y en a qu'un.
 *
 * La portée doit avoir été posée par une route `@Espaces('PERSONAL', …)` ;
 * sans elle, c'est une faute de câblage, pas une saisie à refuser.
 */
export function espacePersonnelCourant(): string {
  const espace = porteeCourante()?.espaces.find(
    ({ kind }) => kind === 'PERSONAL',
  );
  if (!espace) {
    throw new Error(
      "La requête n'a pas d'auteur : aucun Espace personnel dans la portée.",
    );
  }
  return espace.id;
}
