import { Injectable } from '@nestjs/common';
import {
  apresModification,
  apresTransition,
  type Lang,
  type PageContent,
  type PageContentInput,
  type PageSlug,
  type PublicationTransition,
  type RefusDePublication,
} from '@personal-os/contracts';
import { ErreurMetier, Introuvable } from '../erreurs/erreur-metier';
import {
  PageContentRepository,
  type PageContentRecord,
  type PageContentText,
} from './page-content.repository';

const MESSAGES_DE_REFUS: Readonly<Record<RefusDePublication, string>> = {
  'portfolio.not_unpublished':
    'Seule une page non publiée se marque prête à publier.',
  'portfolio.not_ready': 'Seule une page prête à publier peut être publiée.',
  'portfolio.already_unpublished': 'La page n’est pas publiée.',
};

/**
 * Les Pages de contenu du portfolio, par page et par langue. Leur État de
 * publication suit la même règle que les Présentations publiques
 * (`apresTransition`, `apresModification` de `contracts`) : la rédaction ne
 * publie jamais, et un texte publié qu'on modifie quitte le portfolio.
 */
@Injectable()
export class PageContentService {
  constructor(private readonly repository: PageContentRepository) {}

  async lister(): Promise<PageContent[]> {
    return (await this.repository.lister()).map(exposer);
  }

  /**
   * Crée la page dans cette langue, ou en remplace le texte. Un texte publié
   * qui change repasse en « prêt à publier ». Un texte renvoyé à l'identique
   * ne change rien.
   */
  async rediger(
    slug: PageSlug,
    lang: Lang,
    saisie: PageContentInput,
  ): Promise<PageContent> {
    const texte: PageContentText = {
      title: saisie.title,
      body: saisie.body ?? '',
    };

    const actuelle = await this.repository.lire(slug, lang);
    if (!actuelle) {
      const creee = await this.repository.creer(slug, lang, texte);
      // Créée entre-temps par une autre rédaction : on reprend sur son état.
      return creee ? exposer(creee) : this.rediger(slug, lang, saisie);
    }
    if (actuelle.title === texte.title && actuelle.body === texte.body) {
      return exposer(actuelle);
    }

    const ecrite = await this.repository.modifier(
      actuelle.id,
      actuelle.publicationState,
      {
        ...texte,
        publicationState: apresModification(actuelle.publicationState),
      },
    );

    // L'état a changé entre la lecture et l'écriture : on reprend sur le neuf.
    return ecrite ? exposer(ecrite) : this.rediger(slug, lang, saisie);
  }

  async transition(
    slug: PageSlug,
    lang: Lang,
    transition: PublicationTransition,
  ): Promise<PageContent> {
    const actuelle = await this.repository.lire(slug, lang);
    if (!actuelle) {
      throw new Introuvable(
        'portfolio.page_content_not_found',
        'Cette page n’est pas encore rédigée dans cette langue.',
      );
    }

    const issue = apresTransition(actuelle.publicationState, transition);
    if ('refus' in issue) {
      throw new ErreurMetier(issue.refus, MESSAGES_DE_REFUS[issue.refus]);
    }

    const ecrite = await this.repository.modifier(
      actuelle.id,
      actuelle.publicationState,
      { publicationState: issue.etat },
    );

    return ecrite ? exposer(ecrite) : this.transition(slug, lang, transition);
  }
}

function exposer(page: PageContentRecord): PageContent {
  return {
    id: page.id,
    slug: page.slug,
    lang: page.lang,
    title: page.title,
    body: page.body,
    publicationState: page.publicationState,
    updatedAt: page.updatedAt.toISOString(),
  };
}
