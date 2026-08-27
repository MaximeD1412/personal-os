import {
  ouvrirPorteeVide,
  porteeCourante,
  poserPortee,
  sousPortee,
  type PorteeEspace,
} from './portee';

const PORTEE: PorteeEspace = {
  espaces: [{ id: 'espace-foyer', kind: 'HOUSEHOLD' }],
  typesAcceptes: ['HOUSEHOLD'],
};

describe("Portée d'Espace", () => {
  it("n'existe pas hors d'une requête", () => {
    expect(porteeCourante()).toBeNull();
  });

  it('reste vide tant que la garde ne l\'a pas posée', () => {
    ouvrirPorteeVide(() => {
      expect(porteeCourante()).toBeNull();
    });
  });

  it('suit la requête à travers les attentes', async () => {
    await ouvrirPorteeVide(async () => {
      poserPortee(PORTEE);
      await Promise.resolve();
      expect(porteeCourante()).toEqual(PORTEE);
    });
  });

  it('ne survit pas à la requête qui l\'a posée', async () => {
    await ouvrirPorteeVide(async () => poserPortee(PORTEE));

    expect(porteeCourante()).toBeNull();
  });

  it('ne fuit pas entre deux requêtes concurrentes', async () => {
    const autre: PorteeEspace = {
      espaces: [{ id: 'espace-personnel', kind: 'PERSONAL' }],
      typesAcceptes: ['PERSONAL'],
    };
    const vues: (PorteeEspace | null)[] = [];

    await Promise.all([
      ouvrirPorteeVide(async () => {
        poserPortee(PORTEE);
        await new Promise((suite) => setTimeout(suite, 5));
        vues.push(porteeCourante());
      }),
      ouvrirPorteeVide(async () => {
        poserPortee(autre);
        vues.push(porteeCourante());
      }),
    ]);

    expect(vues).toEqual([autre, PORTEE]);
  });

  it("refuse de poser une portée hors d'une requête ouverte", () => {
    expect(() => poserPortee(PORTEE)).toThrow(/requête/);
  });

  it('sert aussi hors HTTP, quand la portée est connue d\'avance', async () => {
    const vue = await sousPortee(PORTEE, async () => porteeCourante());

    expect(vue).toEqual(PORTEE);
  });
});
