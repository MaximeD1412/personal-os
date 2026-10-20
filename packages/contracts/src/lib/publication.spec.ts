import {
  apresModification,
  apresTransition,
  ETATS_DE_PUBLICATION,
  transitionsPossibles,
} from './publication';

describe('apresTransition', () => {
  it('mène de « non publié » à « publié » en passant par « prêt à publier »', () => {
    const prete = apresTransition('UNPUBLISHED', 'ready');
    expect(prete).toEqual({ etat: 'READY' });

    expect(apresTransition('READY', 'publish')).toEqual({ etat: 'PUBLISHED' });
  });

  it('ne publie que depuis « prêt à publier »', () => {
    for (const etat of ['UNPUBLISHED', 'PUBLISHED'] as const) {
      expect(apresTransition(etat, 'publish')).toEqual({
        refus: 'portfolio.not_ready',
      });
    }
  });

  it('ne marque prête qu’une présentation non publiée', () => {
    for (const etat of ['READY', 'PUBLISHED'] as const) {
      expect(apresTransition(etat, 'ready')).toEqual({
        refus: 'portfolio.not_unpublished',
      });
    }
  });

  it('dépublie une présentation publiée ou prête, jamais une non publiée', () => {
    for (const etat of ['READY', 'PUBLISHED'] as const) {
      expect(apresTransition(etat, 'unpublish')).toEqual({
        etat: 'UNPUBLISHED',
      });
    }
    expect(apresTransition('UNPUBLISHED', 'unpublish')).toEqual({
      refus: 'portfolio.already_unpublished',
    });
  });
});

describe('transitionsPossibles', () => {
  it('dit, pour chaque état, les transitions que la règle accepte', () => {
    for (const etat of ETATS_DE_PUBLICATION) {
      for (const transition of ['ready', 'publish', 'unpublish'] as const) {
        expect(transitionsPossibles(etat).includes(transition)).toBe(
          'etat' in apresTransition(etat, transition),
        );
      }
    }
  });
});

describe('apresModification', () => {
  it('repasse une présentation publiée en « prêt à publier »', () => {
    expect(apresModification('PUBLISHED')).toBe('READY');
  });

  it('laisse les autres états où ils sont', () => {
    expect(apresModification('UNPUBLISHED')).toBe('UNPUBLISHED');
    expect(apresModification('READY')).toBe('READY');
  });
});
