import { porteeCourante } from '@personal-os/database';

/**
 * L'Espace personnel du Compte qui présente la requête. Un module qui
 * n'accepte que lui le pose lui-même à l'écriture, comme un module à Espace
 * unique (ADR 0030) : la portée de la requête n'en atteint qu'un, celui de son
 * auteur. Ce n'est pas une déduction tirée du contexte : c'est la déclaration
 * du module (`@Espaces('PERSONAL')`) qui le fixe, et la garde vérifie
 * l'écriture comme toujours.
 */
export function espacePersonnel(): string {
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
