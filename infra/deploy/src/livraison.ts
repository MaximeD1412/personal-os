import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Banc de livraison : un vrai registre, de vraies images, un vrai dépôt Git.
 *
 * Le test d'intégration du déploiement rejoue la chaîne complète de l'ADR 0023
 * — construire, pousser, promouvoir un canal, détecter, appliquer. La simuler
 * reviendrait à tester la simulation, alors que c'est précisément l'articulation
 * entre le registre et la machine qu'on ne peut pas croire sur parole.
 */

export const SOURCE_ROOT = resolve(__dirname, '..');

export function sh(
  command: string,
  args: string[],
  options: { input?: string; cwd?: string; env?: NodeJS.ProcessEnv } = {}
): string {
  return execFileSync(command, args, {
    encoding: 'utf8',
    input: options.input,
    cwd: options.cwd,
    env: options.env ? { ...process.env, ...options.env } : process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

export function requireTool(tool: string): void {
  try {
    // `which` plutôt que `command -v` : ce dernier est une primitive du shell,
    // et execFileSync n'en démarre pas.
    sh('which', [tool]);
  } catch {
    throw new Error(
      `${tool} est absent. La campagne d'intégration du déploiement exige docker, restic et git.`
    );
  }
}

export function silence(action: () => void): void {
  try {
    action();
  } catch {
    // Nettoyage : l'absence de la chose à nettoyer est le résultat voulu.
  }
}

/**
 * Attend que l'image PostgreSQL ait fini son initialisation.
 *
 * Ni `pg_isready` ni le healthcheck de Compose ne suffisent : l'initialisation
 * crée la base sur un serveur **temporaire**, qu'elle éteint ensuite pour
 * lancer le vrai. Une sonde peut donc passer au vert juste avant l'extinction,
 * et la commande suivante tombe sur « the database system is shutting down ».
 *
 *     LOG:  database system is ready to accept connections   <- temporaire
 *     LOG:  shutting down
 *     PostgreSQL init process complete; ready for start up.
 *     LOG:  database system is ready to accept connections   <- le vrai
 *
 * La marque de fin d'initialisation est le seul point de bascule fiable. Elle
 * part sur la sortie standard, contrairement aux journaux du serveur.
 */
export function attendreInitPostgres(conteneur: string): void {
  for (let essai = 0; essai < 60; essai += 1) {
    if (sh('docker', ['logs', conteneur]).includes('PostgreSQL init process complete')) {
      return;
    }
    sh('sleep', ['1']);
  }
  throw new Error(`${conteneur} n'a pas fini son initialisation`);
}

// --------------------------------------------------------------------------
// Registre local
// --------------------------------------------------------------------------

export interface Registre {
  conteneur: string;
  prefixe: string;
}

export function demarrerRegistre(conteneur: string, port: number): Registre {
  silence(() => sh('docker', ['rm', '--force', conteneur]));
  sh('docker', [
    'run', '--detach', '--name', conteneur,
    '--publish', `127.0.0.1:${port}:5000`,
    'registry:2',
  ]);
  return { conteneur, prefixe: `127.0.0.1:${port}/personal-os` };
}

/**
 * Construit une image applicative jetable et la pousse sous sa révision.
 *
 * L'image sert deux rôles, comme la vraie : elle applique la migration quand on
 * l'invoque avec une commande, et elle répond à la sonde de santé quand on la
 * laisse démarrer.
 */
export function publierImage(
  registre: Registre,
  revision: string,
  options: { migration: string; sante: boolean },
  dir: string
): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'migrate.sh'), `#!/bin/sh\nset -e\n${options.migration}\n`);

  const sante = options.sante
    ? 'RUN mkdir -p /www/api && echo ok > /www/api/health'
    : 'RUN mkdir -p /www';

  writeFileSync(
    join(dir, 'Dockerfile'),
    [
      // postgres:18-alpine porte psql pour la migration. ENTRYPOINT est remis à
      // zéro : celui de l'image PostgreSQL s'interposerait entre compose et la
      // commande de migration.
      'FROM postgres:18-alpine',
      'ENTRYPOINT []',
      // `httpd` n'est pas compilé dans le busybox d'Alpine : il vit dans
      // busybox-extras. Sans ce paquet, le conteneur sort en 127 et la sonde
      // échoue pour une raison qui n'a rien à voir avec ce qu'on teste.
      'RUN apk add --no-cache busybox-extras',
      sante,
      'COPY migrate.sh /migrate.sh',
      'RUN chmod +x /migrate.sh',
      'CMD ["httpd", "-f", "-p", "80", "-h", "/www"]',
      '',
    ].join('\n')
  );

  const reference = `${registre.prefixe}/api:${revision}`;
  sh('docker', [
    'build', '--quiet',
    '--label', `org.opencontainers.image.revision=${revision}`,
    '--tag', reference,
    dir,
  ]);
  sh('docker', ['push', '--quiet', reference]);
}

/** Déplace le canal, exactement comme le fait le travail « promouvoir ». */
export function promouvoir(registre: Registre, revision: string, canal = 'main'): void {
  sh('docker', [
    'buildx', 'imagetools', 'create',
    '--tag', `${registre.prefixe}/api:${canal}`,
    `${registre.prefixe}/api:${revision}`,
  ]);
}

// --------------------------------------------------------------------------
// Dépôt d'où l'agent reprend la pile
// --------------------------------------------------------------------------

export interface Depot {
  origine: string;
  travail: string;
  clone: string;
}

/**
 * Crée une origine nue, un dépôt de travail et le clone que l'agent consulte.
 *
 * Les révisions du test sont de **vrais commits** : c'est ce qui permet à
 * `sync_stack` de faire son travail réel — récupérer la pile de la révision
 * déployée — au lieu d'être court-circuité.
 */
export function creerDepot(racine: string): Depot {
  const origine = join(racine, 'origine.git');
  const travail = join(racine, 'travail');
  const clone = join(racine, 'clone');

  sh('git', ['init', '--quiet', '--bare', '--initial-branch=main', origine]);
  sh('git', ['init', '--quiet', '--initial-branch=main', travail]);
  sh('git', ['config', 'user.email', 'banc@exemple.test'], { cwd: travail });
  sh('git', ['config', 'user.name', 'Banc de livraison'], { cwd: travail });
  sh('git', ['remote', 'add', 'origin', origine], { cwd: travail });

  return { origine, travail, clone };
}

/**
 * Ajoute un commit portant la pile de production, et rend son SHA.
 *
 * L'agent installé est recopié tel quel dans chaque commit : la dérive qu'il
 * signale doit rester silencieuse tant qu'elle n'existe pas.
 */
export function commettreStack(depot: Depot, compose: string, message: string): string {
  const cible = join(depot.travail, 'infra', 'deploy');
  mkdirSync(join(cible, 'caddy'), { recursive: true });
  writeFileSync(join(cible, 'docker-compose.prod.yml'), compose);
  writeFileSync(join(cible, 'caddy', 'Caddyfile'), '# banc de livraison\n');
  cpSync(join(SOURCE_ROOT, 'bin'), join(cible, 'bin'), { recursive: true });
  cpSync(join(SOURCE_ROOT, 'lib'), join(cible, 'lib'), { recursive: true });

  sh('git', ['add', '--all'], { cwd: depot.travail });
  sh('git', ['commit', '--quiet', '--message', message], { cwd: depot.travail });
  sh('git', ['push', '--quiet', '--force', 'origin', 'main'], { cwd: depot.travail });

  return sh('git', ['rev-parse', 'HEAD'], { cwd: depot.travail }).trim();
}

export function clonerDepot(depot: Depot): void {
  sh('git', ['clone', '--quiet', depot.origine, depot.clone]);
}
