import { join } from 'node:path';

export type StockageConfig =
  | { fournisseur: 'disk'; racine: string }
  | {
      fournisseur: 's3';
      endpoint: string;
      region: string;
      bucket: string;
      cleDAcces: string;
      secret: string;
    };

export const STOCKAGE_CONFIG = 'personal-os:stockage-config';

const FOURNISSEURS = ['disk', 's3'] as const;

type Environnement = Record<string, string | undefined>;

/**
 * La configuration du stockage objet. Hors production, un dossier du disque
 * répond par défaut : un poste local, la CI et le staging n'appellent aucun
 * service. La production, elle, doit nommer `s3` (OVH Object Storage) : un
 * fichier posé sur le disque du conteneur disparaîtrait au déploiement suivant.
 */
export function lireStockageConfig(
  env: Environnement = process.env,
): StockageConfig {
  const production = env['APP_ENV'] === 'production';
  const brut = env['STORAGE_PROVIDER'];

  if (!brut && production) {
    throw new Error(
      'STORAGE_PROVIDER est requis en production, et doit valoir « s3 ».',
    );
  }
  const fournisseur = brut || 'disk';
  if (!FOURNISSEURS.includes(fournisseur as (typeof FOURNISSEURS)[number])) {
    throw new Error(
      `STORAGE_PROVIDER vaut « ${fournisseur} » : seuls ${FOURNISSEURS.join(' et ')} sont connus.`,
    );
  }
  if (fournisseur === 'disk' && production) {
    throw new Error(
      'STORAGE_PROVIDER=disk est refusé en production : le disque du conteneur ne survit pas au déploiement.',
    );
  }

  if (fournisseur === 'disk') {
    return {
      fournisseur,
      racine: env['STORAGE_DISK_DIR'] || join(process.cwd(), 'tmp', 'stockage'),
    };
  }
  return {
    fournisseur: 's3',
    endpoint: requis(env, 'S3_ENDPOINT'),
    region: requis(env, 'S3_REGION'),
    bucket: requis(env, 'S3_BUCKET'),
    cleDAcces: requis(env, 'S3_ACCESS_KEY_ID'),
    secret: requis(env, 'S3_SECRET_ACCESS_KEY'),
  };
}

function requis(env: Environnement, nom: string): string {
  const valeur = env[nom];
  if (!valeur) {
    throw new Error(`${nom} est requis pour le stockage S3.`);
  }
  return valeur;
}
