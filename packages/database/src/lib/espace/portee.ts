import { AsyncLocalStorage } from 'node:async_hooks';

/** Le type d'un Espace, tel que le schéma le nomme. */
export type TypeEspace = 'PERSONAL' | 'HOUSEHOLD';

/** Un Espace atteignable par la requête courante. */
export interface EspaceAtteignable {
  id: string;
  kind: TypeEspace;
}

/**
 * Ce que la requête courante a le droit de voir et d'écrire : les Espaces du
 * compte connecté, et les types d'Espace que le module traversé accepte.
 */
export interface PorteeEspace {
  espaces: readonly EspaceAtteignable[];
  typesAcceptes: readonly TypeEspace[];
}

/**
 * La portée voyage avec la requête, pas dans les signatures : c'est ce qui
 * permet aux modules de rester plats (ADR 0016) sans qu'aucun service n'ait à
 * faire circuler l'Espace de main en main.
 *
 * Le porte-portée est ouvert **vide** au tout début de la requête, avant même
 * qu'on sache qui la présente. La garde y pose la portée une fois la session
 * lue et le module identifié. Sans ce temps d'avance, la portée posée par la
 * garde ne serait plus visible du contrôleur.
 */
const stockage = new AsyncLocalStorage<{ portee: PorteeEspace | null }>();

/** Ouvre un porte-portée vide pour la durée d'une requête. */
export function ouvrirPorteeVide<T>(suite: () => T): T {
  return stockage.run({ portee: null }, suite);
}

/** Pose la portée de la requête courante. */
export function poserPortee(portee: PorteeEspace): void {
  const porteur = stockage.getStore();
  if (!porteur) {
    throw new Error(
      "Aucune requête ouverte : la portée d'Espace n'a nulle part où se poser.",
    );
  }
  porteur.portee = portee;
}

/** Exécute sous une portée connue d'avance — hors HTTP, et dans les tests. */
export function sousPortee<T>(portee: PorteeEspace, suite: () => T): T {
  return stockage.run({ portee }, suite);
}

/** La portée de la requête courante, ou `null` s'il n'y en a aucune. */
export function porteeCourante(): PorteeEspace | null {
  return stockage.getStore()?.portee ?? null;
}
