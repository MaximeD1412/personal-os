import { Injectable } from '@nestjs/common';
import type { Lang, PublicationState } from '@personal-os/contracts';
import { PrismaService } from '@personal-os/database';

export interface PresentationRecord {
  id: string;
  projectId: string;
  lang: Lang;
  title: string;
  summary: string;
  body: string;
  publicationState: PublicationState;
  publishedAt: Date | null;
  updatedAt: Date;
}

export interface PresentationText {
  title: string;
  summary: string;
  body: string;
}

/**
 * `PublicPresentation` porte son Espace, comme son `Project` : la garde borne
 * chaque lecture à la portée de la requête, et refuse une création hors de
 * celle-ci. Le Projet se lit au premier niveau, jamais par un `include`.
 */
@Injectable()
export class PresentationRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Le Projet, s'il est atteignable : son identifiant et son Espace. */
  async projet(id: string): Promise<{ id: string; scopeId: string } | null> {
    return this.prisma.project.findUnique({
      where: { id },
      select: { id: true, scopeId: true },
    });
  }

  /** Les présentations du Projet, le français d'abord. */
  async lister(projectId: string): Promise<PresentationRecord[]> {
    return this.prisma.publicPresentation.findMany({
      where: { projectId },
      orderBy: { lang: 'asc' },
    });
  }

  async lire(
    projectId: string,
    lang: Lang,
  ): Promise<PresentationRecord | null> {
    return this.prisma.publicPresentation.findUnique({
      where: { projectId_lang: { projectId, lang } },
    });
  }

  /**
   * Une présentation nouvelle part de « non publié ». Deux premières
   * rédactions simultanées ne font qu'une présentation : la seconde modifie le
   * texte de la première.
   */
  async creer(
    projet: { id: string; scopeId: string },
    lang: Lang,
    texte: PresentationText,
  ): Promise<PresentationRecord> {
    return this.prisma.publicPresentation.upsert({
      where: { projectId_lang: { projectId: projet.id, lang } },
      create: {
        scopeId: projet.scopeId,
        projectId: projet.id,
        lang,
        ...texte,
      },
      update: texte,
    });
  }

  /**
   * Écrit le texte et l'état, si la présentation est toujours dans l'état
   * lu : une transition concurrente l'emporte, et rien ne s'écrit sur un état
   * qui n'est plus le bon. Rend la présentation écrite, ou rien.
   * `publishedAt` suit l'état ; la base refuse l'un sans l'autre.
   */
  async modifier(
    id: string,
    depuis: PublicationState,
    changements: Partial<PresentationText> & {
      publicationState: PublicationState;
      publishedAt: Date | null;
    },
  ): Promise<PresentationRecord | null> {
    const { count } = await this.prisma.publicPresentation.updateMany({
      where: { id, publicationState: depuis },
      data: changements,
    });

    return count > 0
      ? this.prisma.publicPresentation.findUnique({ where: { id } })
      : null;
  }
}
