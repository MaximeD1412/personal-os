import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  StockageObjet,
  verifierLaCle,
  type DescriptionDObjet,
  type ObjetStocke,
} from './stockage-objet';

/**
 * Le stockage objet sur un dossier du disque, pour le poste local et les
 * tests : rien ne sort sur le réseau. La clé devient un chemin sous la racine.
 */
export class StockageDisque extends StockageObjet {
  constructor(private readonly racine: string) {
    super();
  }

  async deposer(cle: string, contenu: Buffer): Promise<void> {
    const chemin = this.chemin(cle);
    await mkdir(dirname(chemin), { recursive: true });

    // Écrit à côté puis renomme : une lecture concurrente voit l'ancien objet
    // ou le nouveau, jamais un fichier à moitié écrit.
    const transit = `${chemin}.${randomUUID()}.transit`;
    try {
      await writeFile(transit, contenu);
      await rename(transit, chemin);
    } finally {
      await rm(transit, { force: true });
    }
  }

  async lire(cle: string): Promise<ObjetStocke | null> {
    const chemin = this.chemin(cle);
    const description = await this.decrire(cle);
    if (!description) {
      return null;
    }
    const contenu = await siPresent(readFile(chemin));
    return contenu ? { ...description, taille: contenu.length, contenu } : null;
  }

  async decrire(cle: string): Promise<DescriptionDObjet | null> {
    const fiche = await siPresent(stat(this.chemin(cle)));
    return fiche
      ? { taille: fiche.size, deposeLe: new Date(fiche.mtimeMs) }
      : null;
  }

  async supprimer(cle: string): Promise<void> {
    await rm(this.chemin(cle), { force: true });
  }

  private chemin(cle: string): string {
    return join(this.racine, verifierLaCle(cle));
  }
}

/** Le résultat, ou `null` quand le fichier n'existe pas. */
async function siPresent<T>(lecture: Promise<T>): Promise<T | null> {
  try {
    return await lecture;
  } catch (erreur) {
    if ((erreur as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw erreur;
  }
}
