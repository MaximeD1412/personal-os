import { recaler, type LigneRecalee } from './recaler';

/** Une ligne en clair : sa quantité en texte, une égalité de décimaux sans flottant. */
function enClair(ligne: LigneRecalee) {
  return { quantite: ligne.quantite.toString(), expireLe: ligne.expireLe };
}

describe('recaler', () => {
  describe('un achat', () => {
    it('ajoute la quantité achetée et garde la péremption la plus proche des deux', () => {
      const { ligne, manque } = recaler(
        { quantite: 500, expireLe: '2026-10-25' },
        { type: 'ACHAT', quantite: 250, expireLe: '2026-10-22' },
      );

      expect(enClair(ligne)).toEqual({
        quantite: '750',
        expireLe: '2026-10-22',
      });
      expect(manque).toBeUndefined();
    });

    it('garde la péremption en place quand le rachat périme plus tard', () => {
      const { ligne } = recaler(
        { quantite: 2, expireLe: '2026-10-22' },
        { type: 'ACHAT', quantite: 6, expireLe: '2026-11-03' },
      );

      expect(enClair(ligne)).toEqual({ quantite: '8', expireLe: '2026-10-22' });
    });

    it('prend la seule péremption connue des deux', () => {
      expect(
        recaler(
          { quantite: 1, expireLe: null },
          { type: 'ACHAT', quantite: 1, expireLe: '2026-10-30' },
        ).ligne.expireLe,
      ).toBe('2026-10-30');
      expect(
        recaler(
          { quantite: 1, expireLe: '2026-10-30' },
          { type: 'ACHAT', quantite: 1 },
        ).ligne.expireLe,
      ).toBe('2026-10-30');
    });

    it("crée la ligne d'un Ingrédient qui n'était pas en stock", () => {
      const { ligne } = recaler(null, {
        type: 'ACHAT',
        quantite: 1000,
        expireLe: '2026-10-27',
      });

      expect(enClair(ligne)).toEqual({
        quantite: '1000',
        expireLe: '2026-10-27',
      });
    });

    it('additionne en décimal exact', () => {
      const { ligne } = recaler(
        { quantite: '0.1', expireLe: null },
        { type: 'ACHAT', quantite: '0.2' },
      );

      expect(ligne.quantite.toString()).toBe('0.3');
    });
  });

  describe('une consommation', () => {
    it('retire la quantité consommée, sans manque quand le stock la couvre', () => {
      const { ligne, manque } = recaler(
        { quantite: 500, expireLe: '2026-10-25' },
        { type: 'CONSOMMATION', quantite: 200 },
      );

      expect(enClair(ligne)).toEqual({
        quantite: '300',
        expireLe: '2026-10-25',
      });
      expect(manque).toBeUndefined();
    });

    it('ramène la ligne à zéro et rend le manque, sans quantité négative', () => {
      const { ligne, manque } = recaler(
        { quantite: 150, expireLe: '2026-10-25' },
        { type: 'CONSOMMATION', quantite: 400 },
      );

      expect(enClair(ligne)).toEqual({ quantite: '0', expireLe: null });
      expect(manque?.toString()).toBe('250');
    });

    it("rend tout en manque quand l'Ingrédient n'était pas en stock", () => {
      const { ligne, manque } = recaler(null, {
        type: 'CONSOMMATION',
        quantite: 3,
      });

      expect(enClair(ligne)).toEqual({ quantite: '0', expireLe: null });
      expect(manque?.toString()).toBe('3');
    });

    it('vide la ligne sans manque quand elle consomme tout juste le stock', () => {
      const { ligne, manque } = recaler(
        { quantite: 6, expireLe: '2026-10-21' },
        { type: 'CONSOMMATION', quantite: 6 },
      );

      expect(enClair(ligne)).toEqual({ quantite: '0', expireLe: null });
      expect(manque).toBeUndefined();
    });
  });

  describe('une correction', () => {
    it('remplace la quantité et la péremption', () => {
      const { ligne, manque } = recaler(
        { quantite: 500, expireLe: '2026-10-22' },
        { type: 'CORRECTION', quantite: 120, expireLe: '2026-11-02' },
      );

      expect(enClair(ligne)).toEqual({
        quantite: '120',
        expireLe: '2026-11-02',
      });
      expect(manque).toBeUndefined();
    });

    it("efface la péremption qu'elle ne donne pas", () => {
      const { ligne } = recaler(
        { quantite: 500, expireLe: '2026-10-22' },
        { type: 'CORRECTION', quantite: 500 },
      );

      expect(ligne.expireLe).toBeNull();
    });

    it('à zéro, ne garde pas de péremption', () => {
      const { ligne } = recaler(null, {
        type: 'CORRECTION',
        quantite: 0,
        expireLe: '2026-10-22',
      });

      expect(enClair(ligne)).toEqual({ quantite: '0', expireLe: null });
    });
  });

  it('refuse une quantité négative : un mouvement dit son sens par son type', () => {
    expect(() => recaler(null, { type: 'CONSOMMATION', quantite: -1 })).toThrow(
      RangeError,
    );
  });
});
