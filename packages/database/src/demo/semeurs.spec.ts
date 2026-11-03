import { Prisma } from '../generated/prisma/client';
import { MODELES_HORS_ESPACE } from '../lib/espace/modeles';
import { SEMEURS } from './semeurs';

/**
 * Le staging est réinitialisé à partir du jeu de démo. Une donnée cloisonnée
 * qu'aucun semeur ne possède ne serait ni vidée ni semée : un module livré
 * sans semeur fait donc échouer la campagne, plutôt que de laisser le staging
 * dériver en silence.
 */
describe('Les semeurs du jeu de démo', () => {
  const possedes = SEMEURS.flatMap(({ modeles }) => modeles);

  it('possèdent chaque modèle cloisonné du schéma', () => {
    const cloisonnes = Object.values(Prisma.ModelName).filter(
      (modele) => !(modele in MODELES_HORS_ESPACE),
    );

    expect([...possedes].sort()).toEqual(expect.arrayContaining(cloisonnes));
  });

  it('ne se disputent aucun modèle', () => {
    expect(new Set(possedes).size).toBe(possedes.length);
  });

  it('portent chacun un module distinct', () => {
    const modules = SEMEURS.map(({ module }) => module);
    expect(new Set(modules).size).toBe(modules.length);
  });
});
