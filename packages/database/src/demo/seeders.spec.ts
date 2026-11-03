import { Prisma } from '../generated/prisma/client';
import { MODELES_HORS_ESPACE } from '../lib/espace/modeles';
import { PrismaService } from '../lib/prisma.service';
import { SEMEURS } from './seeders';

/**
 * Le staging est réinitialisé à partir du jeu de démo. Une donnée cloisonnée
 * qu'aucun semeur ne possède ne serait ni vidée ni semée : un module livré
 * sans semeur fait donc échouer la campagne, plutôt que de laisser le staging
 * dériver en silence.
 */
describe('Les semeurs du jeu de démo', () => {
  const possedes = SEMEURS.flatMap(({ modeles }) => modeles);

  it('possèdent chaque modèle cloisonné du schéma', () => {
    // Un modèle que `PrismaService` n'expose plus (la Trace, retirée en
    // attendant la suppression de sa table, ADR 0024) ne s'écrit plus : il ne
    // peut pas faire dériver le staging.
    const cloisonnes = Object.values(Prisma.ModelName).filter(
      (modele) => !(modele in MODELES_HORS_ESPACE) && expose(modele),
    );

    expect([...possedes].sort()).toEqual(expect.arrayContaining(cloisonnes));
  });

  it("ne possèdent que des modèles que l'accès aux données expose", () => {
    expect(possedes.filter((modele) => !expose(modele))).toEqual([]);
  });

  it('ne se disputent aucun modèle', () => {
    expect(new Set(possedes).size).toBe(possedes.length);
  });

  it('portent chacun un module distinct', () => {
    const modules = SEMEURS.map(({ module }) => module);
    expect(new Set(modules).size).toBe(modules.length);
  });
});

/** `Event` → le délégué `event`, un accesseur de `PrismaService`. */
function expose(modele: string): boolean {
  const nom = modele.charAt(0).toLowerCase() + modele.slice(1);
  return (
    Object.getOwnPropertyDescriptor(PrismaService.prototype, nom) !== undefined
  );
}
