type Environnement = Readonly<Record<string, string | undefined>>;

/**
 * Les installations connues. Toute autre valeur est une faute de frappe, et
 * une faute de frappe sur `production` ferait tourner la prod avec les replis
 * du poste local (le double de l'IA, le stockage sur disque, l'OpenAPI servi).
 */
const ENVIRONNEMENTS = ['development', 'staging', 'production'] as const;

const PORT_POSTGRES = '5432';

/**
 * Les garde-fous du démarrage, avant que Nest n'ouvre quoi que ce soit
 * (ADR 0031).
 *
 * - `APP_ENV` est exigé, et doit être une installation connue.
 * - Le staging refuse une `DATABASE_URL` qui désigne la base de production :
 *   son jeu de démo vide les données métier à chaque déploiement. Les hôtes de
 *   la prod sont donnés par `PROD_DATABASE_HOST` (liste séparée par des
 *   virgules, `hôte` ou `hôte:port`), posé dans l'environnement du staging ;
 *   sans lui, rien ne dirait où est la prod, et le staging ne démarre pas.
 */
export function verifierLEnvironnement(env: Environnement): void {
  const appEnv = env['APP_ENV'];
  if (appEnv === undefined) {
    throw new Error(
      `APP_ENV est absent : il doit valoir ${ENVIRONNEMENTS.join(', ')}.`,
    );
  }
  if (!(ENVIRONNEMENTS as readonly string[]).includes(appEnv)) {
    throw new Error(
      `APP_ENV vaut « ${appEnv} », une valeur inconnue : il doit valoir ${ENVIRONNEMENTS.join(', ')}.`,
    );
  }

  if (appEnv === 'staging') {
    refuserLaBaseDeProduction(env);
  }
}

function refuserLaBaseDeProduction(env: Environnement): void {
  const hotesDeProduction = (env['PROD_DATABASE_HOST'] ?? '')
    .split(',')
    .map((hote) => hote.trim().toLowerCase())
    .filter(Boolean);
  if (hotesDeProduction.length === 0) {
    throw new Error(
      'PROD_DATABASE_HOST est vide : le staging doit savoir où est la base de production pour refuser de s’y connecter.',
    );
  }

  const { hote, port } = adresseDeLaBase(env['DATABASE_URL']);
  const designeLaProduction = hotesDeProduction.some(
    (entree) => entree === hote || entree === `${hote}:${port}`,
  );
  if (designeLaProduction) {
    throw new Error(
      `DATABASE_URL désigne la base de production (${hote}:${port}, dans PROD_DATABASE_HOST) : le staging ne démarre que sur sa propre base.`,
    );
  }
}

/** L'hôte et le port seulement : le reste de l'URL porte le mot de passe. */
function adresseDeLaBase(url: string | undefined): {
  hote: string;
  port: string;
} {
  let lue: URL;
  try {
    lue = new URL(url ?? '');
  } catch {
    throw new Error(
      'DATABASE_URL est absente ou illisible : le staging ne peut pas vérifier qu’elle ne désigne pas la production.',
    );
  }
  return {
    hote: lue.hostname.toLowerCase(),
    port: lue.port || PORT_POSTGRES,
  };
}
