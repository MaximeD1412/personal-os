/** Ce qu'on sait d'un objet déposé, sans en lire le contenu. */
export interface DescriptionDObjet {
  /** En octets. */
  taille: number;
  deposeLe: Date;
}

export interface ObjetStocke extends DescriptionDObjet {
  contenu: Buffer;
}

/**
 * Le port du stockage objet : des fichiers rangés sous une clé (`cv/FR.pdf`),
 * hors de la base. Un module l'injecte sans savoir qui répond : OVH Object
 * Storage en production, un dossier du disque en local et dans les tests
 * (`STORAGE_PROVIDER`).
 *
 * Une clé est un chemin relatif, en segments de lettres, chiffres, `.`, `_` et
 * `-` : elle ne peut pas sortir de sa racine. Déposer sous une clé existante
 * remplace l'objet ; il n'y a pas d'historique des versions.
 */
export abstract class StockageObjet {
  abstract deposer(
    cle: string,
    contenu: Buffer,
    typeDeContenu: string,
  ): Promise<void>;

  /** L'objet, ou `null` s'il n'y en a pas sous cette clé. */
  abstract lire(cle: string): Promise<ObjetStocke | null>;

  /** Sa taille et son instant de dépôt, ou `null` ; le contenu n'est pas lu. */
  abstract decrire(cle: string): Promise<DescriptionDObjet | null>;

  /** Ne dit rien d'un objet déjà absent. */
  abstract supprimer(cle: string): Promise<void>;
}

const SEGMENT = '[A-Za-z0-9][A-Za-z0-9._-]*';
const CLE = new RegExp(`^${SEGMENT}(/${SEGMENT})*$`);

/** Refuse une clé qui sortirait de sa racine (`..`, chemin absolu, segment vide). */
export function verifierLaCle(cle: string): string {
  if (!CLE.test(cle) || cle.split('/').includes('..')) {
    throw new Error(`clé de stockage refusée : « ${cle} »`);
  }
  return cle;
}
