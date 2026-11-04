import { debutDuRepas } from './meal-plan-entry-agenda.contributor';

describe('debutDuRepas', () => {
  it('place le déjeuner à midi et le dîner à 19 h 30, heure de Paris', () => {
    expect(debutDuRepas('2028-03-15', 'LUNCH')).toBe(
      '2028-03-15T11:00:00.000Z',
    );
    expect(debutDuRepas('2028-03-15', 'DINNER')).toBe(
      '2028-03-15T18:30:00.000Z',
    );
  });

  it("suit l'heure d'été", () => {
    expect(debutDuRepas('2028-07-14', 'DINNER')).toBe(
      '2028-07-14T17:30:00.000Z',
    );
  });
});
