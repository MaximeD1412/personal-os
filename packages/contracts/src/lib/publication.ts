import * as z from 'zod';

/**
 * Ce qui part vers le portfolio : une langue, et un État de publication. Les
 * Présentations publiques (PORTFOLIO-2) et les Pages de contenu (PORTFOLIO-3)
 * partagent l'une et l'autre.
 */

/** Le portfolio existe en français et en anglais, sans repli de l'un sur l'autre (ADR 0019). */
export const LANGUES = ['FR', 'EN'] as const;

export const zLang = /* @__PURE__ */ z.enum(LANGUES);

export type Lang = z.infer<typeof zLang>;

export const LIBELLES_DES_LANGUES: Readonly<Record<Lang, string>> = {
  FR: 'Français',
  EN: 'Anglais',
};

/**
 * L'État de publication : non publié, prêt à publier, publié. Il dit si un
 * contenu est sorti sur Internet, jamais qui le voit dans l'application :
 * c'est le rôle de l'Espace.
 */
export const ETATS_DE_PUBLICATION = [
  'UNPUBLISHED',
  'READY',
  'PUBLISHED',
] as const;

export const zPublicationState = /* @__PURE__ */ z.enum(ETATS_DE_PUBLICATION);

export type PublicationState = z.infer<typeof zPublicationState>;

export const LIBELLES_DES_ETATS_DE_PUBLICATION: Readonly<
  Record<PublicationState, string>
> = {
  UNPUBLISHED: 'Non publié',
  READY: 'Prêt à publier',
  PUBLISHED: 'Publié',
};

/** Les transitions, nommées comme leurs routes (`POST …/ready`, `/publish`, `/unpublish`). */
export type PublicationTransition = 'ready' | 'publish' | 'unpublish';

/** Le code du refus d'une transition qui ne part pas d'un de ses états. */
export type RefusDePublication =
  | 'portfolio.not_unpublished'
  | 'portfolio.not_ready'
  | 'portfolio.already_unpublished';

const TRANSITIONS: Readonly<
  Record<
    PublicationTransition,
    {
      depuis: readonly PublicationState[];
      vers: PublicationState;
      refus: RefusDePublication;
    }
  >
> = {
  ready: {
    depuis: ['UNPUBLISHED'],
    vers: 'READY',
    refus: 'portfolio.not_unpublished',
  },
  publish: {
    depuis: ['READY'],
    vers: 'PUBLISHED',
    refus: 'portfolio.not_ready',
  },
  // Dépublier retire aussi de la file une présentation prête : rien ne
  // l'oblige à passer en ligne pour revenir à « non publié ».
  unpublish: {
    depuis: ['READY', 'PUBLISHED'],
    vers: 'UNPUBLISHED',
    refus: 'portfolio.already_unpublished',
  },
};

/**
 * L'état où mène une transition, ou le code de son refus. Rien ne se publie
 * sans être passé par « prêt à publier ».
 */
export function apresTransition(
  etat: PublicationState,
  transition: PublicationTransition,
): { etat: PublicationState } | { refus: RefusDePublication } {
  const { depuis, vers, refus } = TRANSITIONS[transition];

  return depuis.includes(etat) ? { etat: vers } : { refus };
}

/** Les transitions qu'un état accepte, pour n'offrir que celles-là. */
export function transitionsPossibles(
  etat: PublicationState,
): PublicationTransition[] {
  return (Object.keys(TRANSITIONS) as PublicationTransition[]).filter(
    (transition) => TRANSITIONS[transition].depuis.includes(etat),
  );
}

/**
 * Modifier un texte publié le retire du portfolio : il repasse en « prêt à
 * publier », et rien ne repart en ligne sans un nouveau geste « Publier ».
 */
export function apresModification(etat: PublicationState): PublicationState {
  return etat === 'PUBLISHED' ? 'READY' : etat;
}
