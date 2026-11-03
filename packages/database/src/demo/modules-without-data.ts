import type { Semeur } from './seeder';

/**
 * Les modules dont le jeu de démo ne sème rien, mais dont il vide les
 * données : une Trace IA, une Commande non comprise, une Présentation
 * publique ou une Page de contenu saisie sur le staging ne survit pas au déploiement suivant. Le jour
 * où l'un d'eux a quelque chose à montrer, il prend son propre fichier.
 */
const sansDonnees = (
  module: string,
  modeles: Semeur['modeles'],
  espaces: Semeur['espaces'],
): Semeur => ({ module, modeles, espaces, semer: async () => 0 });

export const ai = sansDonnees('ai', ['AiTrace'], ['PERSONAL', 'HOUSEHOLD']);

export const commandBar = sansDonnees(
  'command-bar',
  ['UnresolvedCommand'],
  ['PERSONAL', 'HOUSEHOLD'],
);

// Les Pages de contenu sont globales, hors Espace : vidées comme le reste.
export const portfolio = sansDonnees(
  'portfolio',
  ['PublicPresentation', 'PageContent'],
  ['PERSONAL'],
);
