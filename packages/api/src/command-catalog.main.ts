import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { genererCatalogue } from './app/command-bar/catalogue/generer';

/**
 * Écrit le catalogue de la barre de commande à partir de l'OpenAPI déjà
 * généré : c'est la cible `nx run api:command-catalog`, qui passe avant le
 * build de l'API et du tableau de bord. Une annotation incohérente l'arrête,
 * et le build avec elle.
 */
function ecrireLeCatalogue(openapi: string, cible: string): void {
  const catalogue = genererCatalogue(JSON.parse(readFileSync(openapi, 'utf8')));

  mkdirSync(dirname(cible), { recursive: true });
  writeFileSync(cible, `${JSON.stringify(catalogue, null, 2)}\n`);
}

try {
  ecrireLeCatalogue(
    resolve(process.argv[2] ?? 'openapi.json'),
    resolve(
      process.argv[3] ?? '../contracts/src/generated/command-catalog.json',
    ),
  );
} catch (erreur) {
  console.error((erreur as Error).message);
  process.exitCode = 1;
}
