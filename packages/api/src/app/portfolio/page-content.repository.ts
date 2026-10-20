import { Injectable } from '@nestjs/common';
import type { Lang, PageSlug, PublicationState } from '@personal-os/contracts';
import { PrismaService } from '@personal-os/database';
import { codePrisma } from './presentation.repository';

export interface PageContentRecord {
  id: string;
  slug: PageSlug;
  lang: Lang;
  title: string;
  body: string;
  publicationState: PublicationState;
  updatedAt: Date;
}

export interface PageContentText {
  title: string;
  body: string;
}

/**
 * `PageContent` est hors Espace (`MODELES_HORS_ESPACE`) : la garde le laisse
 * passer, et les deux Comptes lisent et écrivent les mêmes pages.
 */
@Injectable()
export class PageContentRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Six textes au plus : trois pages, deux langues, dans l'ordre du portfolio. */
  async lister(): Promise<PageContentRecord[]> {
    return this.prisma.pageContent.findMany({
      orderBy: [{ slug: 'asc' }, { lang: 'asc' }],
    });
  }

  async lire(slug: PageSlug, lang: Lang): Promise<PageContentRecord | null> {
    return this.prisma.pageContent.findUnique({
      where: { slug_lang: { slug, lang } },
    });
  }

  /**
   * Une page nouvelle part de « non publié ». Si une rédaction concurrente l'a
   * créée entre-temps, rien ne s'écrit et rien ne se rend : le texte passe
   * alors par `modifier`, qui tient compte de son état.
   */
  async creer(
    slug: PageSlug,
    lang: Lang,
    texte: PageContentText,
  ): Promise<PageContentRecord | null> {
    try {
      return await this.prisma.pageContent.create({
        data: { slug, lang, ...texte },
      });
    } catch (erreur) {
      if (codePrisma(erreur) === 'P2002') return null;
      throw erreur;
    }
  }

  /**
   * Écrit le texte et l'état, si la page est toujours dans l'état lu : une
   * transition concurrente l'emporte, et rien ne s'écrit sur un état qui n'est
   * plus le bon. Rend la page écrite, ou rien.
   */
  async modifier(
    id: string,
    depuis: PublicationState,
    changements: Partial<PageContentText> & {
      publicationState: PublicationState;
    },
  ): Promise<PageContentRecord | null> {
    const { count } = await this.prisma.pageContent.updateMany({
      where: { id, publicationState: depuis },
      data: changements,
    });

    return count > 0
      ? this.prisma.pageContent.findUnique({ where: { id } })
      : null;
  }
}
