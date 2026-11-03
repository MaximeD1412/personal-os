import { coutEnCentimes, debutDuMoisCivil } from './plafond';

describe('Le plafond de coût IA', () => {
  describe('coutEnCentimes', () => {
    const tarif = {
      prixEntreeParMillionCentimes: 200,
      prixSortieParMillionCentimes: 1000,
    };

    it('ne coûte rien sans jetons', () => {
      expect(coutEnCentimes({ jetonsEntree: 0, jetonsSortie: 0 }, tarif)).toBe(
        0,
      );
    });

    it("arrondit au centime supérieur : une fraction de centime n'est pas gratuite", () => {
      expect(coutEnCentimes({ jetonsEntree: 1, jetonsSortie: 0 }, tarif)).toBe(
        1,
      );
    });
  });

  describe('debutDuMoisCivil', () => {
    it('commence le mois à minuit, heure de Paris', () => {
      expect(debutDuMoisCivil(new Date('2026-10-19T10:00:00Z'))).toEqual(
        new Date('2026-09-30T22:00:00Z'),
      );
    });

    it('bascule au mois suivant dès minuit à Paris, avant minuit UTC', () => {
      expect(debutDuMoisCivil(new Date('2026-10-31T23:30:00Z'))).toEqual(
        new Date('2026-10-31T23:00:00Z'),
      );
    });
  });
});
