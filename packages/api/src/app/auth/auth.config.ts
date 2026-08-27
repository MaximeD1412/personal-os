export interface AuthConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  dashboardUrl: string;
  allowedEmails: readonly string[];
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
    throw new Error(
      'AUTH_ALLOWED_EMAILS est vide : aucun compte ne pourrait ouvrir de session.',
    );
  }

  return {
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
