/**
 * Configuration de l'authentification, lue une fois au démarrage.
 *
 * Elle est validée à la construction, et non au premier appel : une variable
 * manquante doit empêcher l'API de démarrer, pas attendre qu'un utilisateur
 * clique sur « se connecter » pour se révéler. L'agent de déploiement
 * s'appuie là-dessus — une pile qui démarre mais ne sait pas authentifier
 * passerait sa vérification de santé.
 */
export interface AuthConfig {
  /** Émetteur OIDC. La découverte se fait sous `.well-known` de cette URL. */
  issuer: string;
  clientId: string;
  clientSecret: string;
  /** Doit correspondre au mot pour mot à ce qui est déclaré dans Authentik. */
  redirectUri: string;
  /** Où renvoyer le navigateur une fois la session émise. */
  dashboardUrl: string;
  /**
   * Les adresses admises. C'est **toute** la politique d'admission : une
   * identité qui n'y figure pas se voit refuser, et aucune rangée `User`
   * n'est créée. Il n'existe pas d'autre chemin vers un compte.
   */
  allowedEmails: readonly string[];
  /** `Secure` sur les cookies. Ne se désarme qu'en développement. */
  cookieSecure: boolean;
  sessionTtlSeconds: number;
  loginTtlSeconds: number;
}

export const AUTH_CONFIG = 'personal-os:auth-config';

const HEURE = 3600;
const MINUTE = 60;

function requis(nom: string): string {
  const valeur = process.env[nom];
  if (!valeur) {
    throw new Error(`${nom} est requis pour authentifier.`);
  }
  return valeur;
}

function entier(nom: string, defaut: number): number {
  const brut = process.env[nom];
  if (!brut) {
    return defaut;
  }

  const valeur = Number(brut);
  if (!Number.isFinite(valeur) || valeur <= 0) {
    throw new Error(`${nom} doit être un nombre de secondes positif.`);
  }
  return valeur;
}

export function lireAuthConfig(): AuthConfig {
  const allowedEmails = (process.env['AUTH_ALLOWED_EMAILS'] ?? '')
    .split(',')
    .map((adresse) => adresse.trim().toLowerCase())
    .filter(Boolean);

  if (allowedEmails.length === 0) {
    // Une liste vide n'admet personne. Démarrer quand même donnerait une
    // application dont plus aucun compte n'ouvre — panne d'autant plus longue
    // à comprendre qu'elle ressemble à un problème d'Authentik.
    throw new Error(
      'AUTH_ALLOWED_EMAILS est vide : aucun compte ne pourrait ouvrir de session.',
    );
  }

  return {
    // Recopié tel quel, barre finale comprise : l'émetteur est aussi la valeur
    // que porte le `iss` des jetons, et la comparaison y est littérale.
    // Authentik la publie avec une barre finale.
    issuer: requis('OIDC_ISSUER').trim(),
    clientId: requis('OIDC_CLIENT_ID'),
    clientSecret: requis('OIDC_CLIENT_SECRET'),
    redirectUri: requis('OIDC_REDIRECT_URI'),
    dashboardUrl: requis('DASHBOARD_URL'),
    allowedEmails,
    cookieSecure: process.env['SESSION_COOKIE_SECURE'] !== 'false',
    sessionTtlSeconds: entier('SESSION_TTL_SECONDS', 12 * HEURE),
    loginTtlSeconds: entier('LOGIN_TTL_SECONDS', 10 * MINUTE),
  };
}
