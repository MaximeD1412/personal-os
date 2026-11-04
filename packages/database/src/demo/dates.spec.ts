import { aParis, decalerLeJour, jourAParis } from './dates';

describe("Les dates du jeu de démo, à l'heure de Paris", () => {
  it("lit le jour qu'il est à Paris, pas celui de l'UTC", () => {
    expect(jourAParis(new Date('2026-11-03T22:30:00.000Z'))).toBe('2026-11-03');
    expect(jourAParis(new Date('2026-11-03T23:30:00.000Z'))).toBe('2026-11-04');
  });

  it('pose une heure de Paris en hiver comme en été', () => {
    expect(aParis('2026-12-15', '09:30').toISOString()).toBe(
      '2026-12-15T08:30:00.000Z',
    );
    expect(aParis('2026-07-15', '09:30').toISOString()).toBe(
      '2026-07-15T07:30:00.000Z',
    );
  });

  it("garde l'heure le lendemain d'un changement d'heure", () => {
    expect(aParis('2026-10-25', '09:30').toISOString()).toBe(
      '2026-10-25T08:30:00.000Z',
    );
    expect(aParis('2026-03-29', '09:30').toISOString()).toBe(
      '2026-03-29T07:30:00.000Z',
    );
  });

  it('décale un jour par-delà les fins de mois', () => {
    expect(decalerLeJour('2026-11-03', -10)).toBe('2026-10-24');
    expect(decalerLeJour('2026-12-28', 5)).toBe('2027-01-02');
  });
});
