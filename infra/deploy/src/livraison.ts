import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

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
    // Le nettoyage est best-effort : l'élément peut déjà être absent.
  }
}

export function attendreInitPostgres(conteneur: string): void {
  for (let essai = 0; essai < 60; essai += 1) {
    if (sh('docker', ['logs', conteneur]).includes('PostgreSQL init process complete')) {
      return;
    }
    sh('sleep', ['1']);
  }
  throw new Error(`${conteneur} n'a pas fini son initialisation`);
}

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
      'FROM postgres:18-alpine',
      'ENTRYPOINT []',
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

export function promouvoir(registre: Registre, revision: string, canal = 'main'): void {
  sh('docker', [
    'buildx', 'imagetools', 'create',
    '--tag', `${registre.prefixe}/api:${canal}`,
    `${registre.prefixe}/api:${revision}`,
  ]);
}

export interface Depot {
  origine: string;
  travail: string;
  clone: string;
}

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
