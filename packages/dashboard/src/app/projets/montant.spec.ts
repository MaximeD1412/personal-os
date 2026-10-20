import { centimesDepuisSaisie, formaterMontant } from './montant';

describe('formaterMontant', () => {
  it('écrit des centimes en euros, à la française', () => {
    expect(formaterMontant({ cents: 124000, currency: 'EUR' })).toBe(
      '1\u202f240,00\u00a0€',
    );
    expect(formaterMontant({ cents: 5, currency: 'EUR' })).toBe('0,05\u00a0€');
  });
});

describe('centimesDepuisSaisie', () => {
  it.each([
    ['12', 1200],
    ['12,5', 1250],
    ['12,50', 1250],
    ['12.99', 1299],
    [' 1 240,00 ', 124000],
    ['1\u202f240,00', 124000],
    ['0,1', 10],
    ['0,07', 7],
    ['12 €', 1200],
  ])('lit « %s » comme %i centimes', (saisie, centimes) => {
    expect(centimesDepuisSaisie(saisie)).toBe(centimes);
  });

  it('ne passe jamais par des euros en virgule flottante', () => {
    // 0,1 + 0,2 en flottants vaut 0,30000000000000004 ; 1,005 × 100 vaut 100,49999…
    expect(centimesDepuisSaisie('1,005')).toBeNull();
    expect(centimesDepuisSaisie('4,35')).toBe(435);
    expect(centimesDepuisSaisie('1,15')).toBe(115);
  });

  it.each(['', 'douze', '12,345', '-3', '12,', ',5', '1,2,3'])(
    'refuse « %s »',
    (saisie) => {
      expect(centimesDepuisSaisie(saisie)).toBeNull();
    },
  );
});
