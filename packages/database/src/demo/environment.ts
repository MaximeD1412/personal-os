import type { ComptesDeDemo } from './seed';

type Environnement = Readonly<Record<string, string | undefined>>;

/**
 * Le jeu de démo **vide les données métier** avant de semer. Il ne tourne donc
 * jamais en production : la commande le refuse avant même d'ouvrir la base.
 */
export function refuserLaProduction(env: Environnement): void {
  if (env['APP_ENV']?.trim().toLowerCase() === 'production') {
    throw new Error(
      'APP_ENV vaut « production » : le jeu de démo vide les données métier avant de semer, il ne tourne jamais en production.',
    );
  }
}

/**
 * Les deux Comptes réels du jeu de démo, dans l'ordre de `DEMO_ACCOUNT_EMAILS`.
 * Les adresses sont normalisées comme l'appariement OIDC les écrit (casse et
 * espaces), pour retrouver le Compte qu'une connexion a déjà créé.
 */
export function comptesDeDemo(env: Environnement): ComptesDeDemo {
  const adresses = (env['DEMO_ACCOUNT_EMAILS'] ?? '')
    .split(',')
    .map((adresse) => adresse.trim().toLowerCase());

  const [a, b] = adresses;
  if (adresses.length !== 2 || !a || !b || a === b) {
    throw new Error(
      'DEMO_ACCOUNT_EMAILS doit désigner les deux Comptes de démo : deux adresses distinctes, séparées par une virgule.',
    );
  }
  return [a, b];
}
