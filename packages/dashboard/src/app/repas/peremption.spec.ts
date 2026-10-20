import { alerteDePeremption } from './peremption';

describe('alerteDePeremption', () => {
  const JOUR = '2026-10-20';

  it.each([
    ['2026-10-18', 'Périmé'],
    ['2026-10-20', "Périme aujourd'hui"],
    ['2026-10-21', 'Périme demain'],
    ['2026-10-23', 'Périme dans 3\u00a0jours'],
  ])('dit %s : « %s »', (expiresOn, alerte) => {
    expect(alerteDePeremption(expiresOn, JOUR)).toBe(alerte);
  });

  it('ne dit rien au-delà des trois jours, ni sans péremption', () => {
    expect(alerteDePeremption('2026-10-24', JOUR)).toBeNull();
    expect(alerteDePeremption(null, JOUR)).toBeNull();
  });
});
