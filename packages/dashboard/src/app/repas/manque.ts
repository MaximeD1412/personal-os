import type { CookedMealShortfall } from '@personal-os/contracts';
import { quantiteCanonique } from './quantite';

/** Les initiales devant lesquelles « de » s'élide. */
const ELISION = /^[aeiouyhàâäéèêëîïôöùûüœæ]/i;

/**
 * Ce que le stock n'avait pas, dit après la déclaration d'un Repas cuisiné :
 * « Le stock n'avait que 200 g de farine. », ou « Le stock n'avait pas de
 * sucre. » quand il n'en avait pas du tout. Le nom de l'Ingrédient perd sa
 * majuscule initiale, au milieu de la phrase.
 */
export function messageDeManque({
  ingredient,
  available,
}: CookedMealShortfall): string {
  const nom =
    ingredient.displayName.charAt(0).toLowerCase() +
    ingredient.displayName.slice(1);
  const complement = ELISION.test(nom) ? `d'${nom}` : `de ${nom}`;
  return available > 0
    ? `Le stock n'avait que ${quantiteCanonique(available, ingredient.canonicalUnit)} ${complement}.`
    : `Le stock n'avait pas ${complement}.`;
}
