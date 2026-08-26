import type { Request } from 'express';

/** Cookie de session applicative. */
export const SESSION_COOKIE = 'pos_session';

/** Cookie qui rattache un aller-retour OIDC au navigateur qui l'a commencé. */
export const LOGIN_COOKIE = 'pos_login';

/**
 * Lit un cookie de la requête.
 *
 * Le découpage se fait ici plutôt que par un middleware global : la pile est
 * alors assemblée exactement de la même façon dans les tests et en production.
 * Un middleware posé dans `main.ts` seulement serait absent des tests, et
 * l'authentification s'y comporterait autrement qu'en vrai.
 */
export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.cookie;
  if (!header) {
    return null;
  }

  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=');
    if (separator === -1) {
      continue;
    }
    if (pair.slice(0, separator).trim() !== name) {
      continue;
    }

    // Une valeur non décodable vient d'un cookie qu'on n'a pas écrit : la
    // laisser passer telle quelle reviendrait à comparer autre chose que ce
    // que le navigateur a réellement reçu.
    try {
      return decodeURIComponent(pair.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }

  return null;
}
