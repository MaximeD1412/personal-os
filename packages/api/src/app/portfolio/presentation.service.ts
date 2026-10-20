import { Injectable } from '@nestjs/common';
import {
  apresModification,
  apresTransition,
  type Lang,
  type PublicationTransition,
  type PublicPresentation,
  type PublicPresentationInput,
  type RefusDePublication,
} from '@personal-os/contracts';
import { ErreurMetier, Introuvable } from '../erreurs/erreur-metier';
import {
  PresentationRepository,
  type PresentationRecord,
  type PresentationText,
} from './presentation.repository';

const MESSAGES_DE_REFUS: Readonly<Record<RefusDePublication, string>> = {
  'portfolio.not_unpublished':
    'Seule une présentation non publiée se marque prête à publier.',
  'portfolio.not_ready':
    'Seule une présentation prête à publier peut être publiée.',
  'portfolio.already_unpublished': 'La présentation n’est pas publiée.',
};

/**
 * La Présentation publique d'un Projet, par langue. Sa rédaction ne touche
 * jamais à l'État de publication, sauf pour retirer du portfolio un texte
 * publié qu'on modifie ; l'état ne change que par ses transitions, dont la
 * règle est dans `contracts` (`apresTransition`).
 */
@Injectable()
export class PresentationService {
  constructor(private readonly repository: PresentationRepository) {}

  async lister(projectId: string): Promise<PublicPresentation[]> {
    await this.projet(projectId);

    return (await this.repository.lister(projectId)).map(exposer);
  }

  /**
   * Crée la présentation, ou en remplace le texte. Un texte publié qui change
   * repasse en « prêt à publier » : il quitte le portfolio jusqu'à sa
   * republication. Un texte renvoyé à l'identique ne change rien.
   */
  async rediger(
    projectId: string,
    lang: Lang,
    saisie: PublicPresentationInput,
  ): Promise<PublicPresentation> {
    const projet = await this.projet(projectId);
    const texte: PresentationText = {
      title: saisie.title,
      summary: saisie.summary,
      body: saisie.body ?? '',
    };

    const actuelle = await this.repository.lire(projectId, lang);
    if (!actuelle) {
      return exposer(
        await projetIntrouvableSinon(
          this.repository.creer(projet, lang, texte),
        ),
      );
    }
    if (memeTexte(actuelle, texte)) {
      return exposer(actuelle);
    }

    const etat = apresModification(actuelle.publicationState);
    const ecrite = await this.repository.modifier(
      actuelle.id,
      actuelle.publicationState,
      {
        ...texte,
        publicationState: etat,
        publishedAt: etat === 'PUBLISHED' ? actuelle.publishedAt : null,
      },
    );

    // L'état a changé entre la lecture et l'écriture : on reprend sur le neuf.
    return ecrite ? exposer(ecrite) : this.rediger(projectId, lang, saisie);
  }

  async transition(
    projectId: string,
    lang: Lang,
    transition: PublicationTransition,
  ): Promise<PublicPresentation> {
    await this.projet(projectId);

    const actuelle = await this.repository.lire(projectId, lang);
    if (!actuelle) {
      throw new Introuvable(
        'portfolio.presentation_not_found',
        'Ce projet n’a pas de présentation publique dans cette langue.',
      );
    }

    const issue = apresTransition(actuelle.publicationState, transition);
    if ('refus' in issue) {
      throw new ErreurMetier(issue.refus, MESSAGES_DE_REFUS[issue.refus]);
    }

    const ecrite = await this.repository.modifier(
      actuelle.id,
      actuelle.publicationState,
      {
        publicationState: issue.etat,
        publishedAt: issue.etat === 'PUBLISHED' ? new Date() : null,
      },
    );

    return ecrite
      ? exposer(ecrite)
      : this.transition(projectId, lang, transition);
  }

  /** Le Projet, absent ou de l'autre Compte : la garde ne le laisse pas voir. */
  private async projet(id: string): Promise<{ id: string; scopeId: string }> {
    const projet = await this.repository.projet(id);
    if (!projet) {
      throw projetIntrouvable();
    }
    return projet;
  }
}

function projetIntrouvable(): Introuvable {
  return new Introuvable(
    'project.not_found',
    'Aucun Projet de cet identifiant.',
  );
}

/**
 * Entre la lecture et l'écriture, le Projet peut avoir été supprimé : la clé
 * étrangère ne mène plus nulle part (P2003), et c'est le même 404.
 */
async function projetIntrouvableSinon<T>(operation: Promise<T>): Promise<T> {
  try {
    return await operation;
  } catch (erreur) {
    if (
      typeof erreur === 'object' &&
      erreur !== null &&
      'code' in erreur &&
      erreur.code === 'P2003'
    ) {
      throw projetIntrouvable();
    }
    throw erreur;
  }
}

function memeTexte(
  presentation: PresentationRecord,
  texte: PresentationText,
): boolean {
  return (
    presentation.title === texte.title &&
    presentation.summary === texte.summary &&
    presentation.body === texte.body
  );
}

function exposer(presentation: PresentationRecord): PublicPresentation {
  return {
    id: presentation.id,
    projectId: presentation.projectId,
    lang: presentation.lang,
    title: presentation.title,
    summary: presentation.summary,
    body: presentation.body,
    publicationState: presentation.publicationState,
    publishedAt: presentation.publishedAt?.toISOString() ?? null,
    updatedAt: presentation.updatedAt.toISOString(),
  };
}
