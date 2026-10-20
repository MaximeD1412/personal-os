import { Injectable } from '@nestjs/common';
import { LANGUES, type Cv, type Lang } from '@personal-os/contracts';
import { ErreurMetier, Introuvable } from '../erreurs/erreur-metier';
import { StockageObjet, type ObjetStocke } from '../storage/stockage-objet';
import { CV_INVALIDE } from './cv.televersement';

/** Tout PDF commence par cette signature, quel que soit le nom qu'on lui donne. */
const SIGNATURE_PDF = Buffer.from('%PDF-');

/**
 * Le CV du portfolio, un PDF par langue. Il vit dans le stockage objet, sous
 * `cv/<LANG>.pdf`, et n'a pas de ligne en base : sa taille et son instant de
 * dépôt sont ceux de l'objet. Il n'appartient à aucun Espace.
 */
@Injectable()
export class CvService {
  constructor(private readonly stockage: StockageObjet) {}

  /** Les CV déjà téléversés, dans l'ordre des langues. */
  async lister(): Promise<Cv[]> {
    const cvs = await Promise.all(
      LANGUES.map(async (lang) => {
        const description = await this.stockage.decrire(cleDuCv(lang));
        return description ? enCv(lang, description) : null;
      }),
    );
    return cvs.filter((cv) => cv !== null);
  }

  /**
   * Remplace le CV de la langue. Le type annoncé par le navigateur ne prouve
   * rien : seul compte le contenu, qui doit commencer par la signature PDF.
   */
  async televerser(lang: Lang, contenu: Buffer): Promise<Cv> {
    if (!contenu.subarray(0, SIGNATURE_PDF.length).equals(SIGNATURE_PDF)) {
      throw new ErreurMetier(CV_INVALIDE, 'Le CV doit être un fichier PDF.');
    }

    await this.stockage.deposer(cleDuCv(lang), contenu, 'application/pdf');
    const description = await this.stockage.decrire(cleDuCv(lang));
    if (!description) {
      throw new Error(`le CV ${lang} déposé est introuvable`);
    }
    return enCv(lang, description);
  }

  async lire(lang: Lang): Promise<ObjetStocke> {
    const objet = await this.stockage.lire(cleDuCv(lang));
    if (!objet) {
      throw new Introuvable(
        'portfolio.cv_not_found',
        "Aucun CV n'a été téléversé pour cette langue.",
      );
    }
    return objet;
  }
}

function cleDuCv(lang: Lang): string {
  return `cv/${lang}.pdf`;
}

function enCv(
  lang: Lang,
  { taille, deposeLe }: { taille: number; deposeLe: Date },
): Cv {
  return { lang, size: taille, uploadedAt: deposeLe.toISOString() };
}
