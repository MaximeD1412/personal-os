import { Injectable } from '@nestjs/common';
import type { Lang, PageSlug } from '@personal-os/contracts';
import { PrismaService } from '@personal-os/database';

export interface PublicPresentationRecord {
  projectId: string;
  lang: Lang;
  title: string;
  summary: string;
  body: string;
  publishedAt: Date | null;
}

export interface PublicPageRecord {
  slug: PageSlug;
  lang: Lang;
  title: string;
  body: string;
}

/** Les seuls champs lus d'une Présentation publique : rien du Projet. */
const CHAMPS_DE_PRESENTATION = {
  projectId: true,
  lang: true,
  title: true,
  summary: true,
  body: true,
  publishedAt: true,
} as const;

/**
 * Les lectures du portfolio public, sous la portée de lecture publique : la
 * garde n'y laisse passer que des lectures de contenus publiés, et ajoute
 * elle-même le filtre « publié » (`lecture-publique.ts`). Le dépôt ne dit
 * que la langue, et ne choisit que des champs de contenu.
 */
@Injectable()
export class PublicRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Les présentations publiées dans cette langue, la plus récente d'abord. */
  async presentations(lang: Lang): Promise<PublicPresentationRecord[]> {
    return this.prisma.publicPresentation.findMany({
      where: { lang },
      orderBy: [{ publishedAt: 'desc' }, { projectId: 'asc' }],
      select: CHAMPS_DE_PRESENTATION,
    });
  }

  async presentation(
    projectId: string,
    lang: Lang,
  ): Promise<PublicPresentationRecord | null> {
    return this.prisma.publicPresentation.findUnique({
      where: { projectId_lang: { projectId, lang } },
      select: CHAMPS_DE_PRESENTATION,
    });
  }

  async page(slug: PageSlug, lang: Lang): Promise<PublicPageRecord | null> {
    return this.prisma.pageContent.findUnique({
      where: { slug_lang: { slug, lang } },
      select: { slug: true, lang: true, title: true, body: true },
    });
  }
}
