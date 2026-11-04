import { verifierLEnvironnement } from './environnement';

/**
 * `node verifier-environnement.js`, dans l'image : les garde-fous du démarrage
 * de l'API, seuls. deploy-staging.sh le lance avant la migration et le semis,
 * qui passent par `docker compose run` sans démarrer l'API, et donc sans ses
 * garde-fous : le semis vide les données métier de la base qu'on lui donne
 * (ADR 0031).
 */
try {
  verifierLEnvironnement(process.env);
  console.log(`Environnement ${process.env['APP_ENV']} vérifié.`);
} catch (erreur) {
  console.error(erreur instanceof Error ? erreur.message : erreur);
  process.exitCode = 1;
}
