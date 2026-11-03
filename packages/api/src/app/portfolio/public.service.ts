import { Injectable } from '@nestjs/common';
import type {
  Lang,
  PageSlug,
  PublicPage,
  PublicProject,
  PublicProjectSummary,
} from '@personal-os/contracts';
import { Introuvable } from '../erreurs/erreur-metier';
import {
  PublicRepository,
  type PublicPresentationRecord,
} from './public.repository';

/**
 * Le portfolio public : le publié, dans la langue demandée, et rien d'autre.
 * Une langue absente est absente : il n'y a jamais de repli sur l'autre
 * (ADR 0019).
 */
@Injectable()
export class PublicService {
  constructor(private readonly repository: PublicRepository) {}

  async projets(lang: Lang): Promise<PublicProjectSummary[]> {
    return (await this.repository.presentations(lang)).map(enResume);
  }

  async projet(projectId: string, lang: Lang): Promise<PublicProject> {
    const presentation = await this.repository.presentation(projectId, lang);
    if (!presentation) {
      throw new Introuvable(
        'portfolio.public_project_not_found',
        'Aucun projet publié de cet identifiant dans cette langue.',
      );
    }
    return { ...enResume(presentation), body: presentation.body };
  }

  async page(slug: PageSlug, lang: Lang): Promise<PublicPage> {
    const page = await this.repository.page(slug, lang);
    if (!page) {
      throw new Introuvable(
        'portfolio.public_page_not_found',
        'Cette page n’est pas publiée dans cette langue.',
      );
    }
    return page;
  }
}

function enResume(
  presentation: PublicPresentationRecord,
): PublicProjectSummary {
  if (!presentation.publishedAt) {
    // La base refuse une présentation publiée sans instant de mise en ligne.
    throw new Error(
      `la présentation publiée ${presentation.projectId}/${presentation.lang} n'a pas d'instant de publication`,
    );
  }
  return {
    id: presentation.projectId,
    lang: presentation.lang,
    title: presentation.title,
    summary: presentation.summary,
    publishedAt: presentation.publishedAt.toISOString(),
  };
}
