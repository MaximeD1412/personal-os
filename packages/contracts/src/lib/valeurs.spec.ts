import {
  aujourdhui,
  FUSEAU,
  lundiDe,
  periodeDeLaSemaine,
  periodeDuMois,
  zCents,
  zDay,
  zInstant,
  zMoney,
  zPeriod,
  zWeek,
} from './valeurs';

describe('zInstant', () => {
  it('accepte un instant ISO-8601 en UTC et le rend tel quel, en chaîne', () => {
    expect(zInstant.parse('2026-10-25T01:30:00.000Z')).toBe(
      '2026-10-25T01:30:00.000Z',
    );
    expect(zInstant.parse('2026-10-25T01:30:00Z')).toBe('2026-10-25T01:30:00Z');
  });

  it.each([
    ['un décalage horaire', '2026-10-25T03:30:00+02:00'],
    ['une heure locale sans fuseau', '2026-10-25T03:30:00'],
    ['un jour seul', '2026-10-25'],
    ['une date impossible', '2026-02-30T10:00:00Z'],
  ])('refuse %s', (_cas, valeur) => {
    expect(zInstant.safeParse(valeur).success).toBe(false);
  });

  it('refuse un objet Date : un contrat ne transporte que des chaînes', () => {
    expect(zInstant.safeParse(new Date()).success).toBe(false);
  });
});

describe('zDay', () => {
  it('accepte un jour civil YYYY-MM-DD', () => {
    expect(zDay.parse('2028-02-29')).toBe('2028-02-29');
  });

  it.each([
    ['un jour qui n’existe pas', '2026-02-29'],
    ['un format sans zéros', '2026-2-3'],
    ['un instant', '2026-10-25T00:00:00Z'],
    ['un format français', '25/10/2026'],
  ])('refuse %s', (_cas, valeur) => {
    expect(zDay.safeParse(valeur).success).toBe(false);
  });
});

describe('zWeek', () => {
  it('accepte un lundi', () => {
    expect(zWeek.parse('2026-10-19')).toBe('2026-10-19');
  });

  it('refuse un mardi, en disant qu’une semaine se désigne par son lundi', () => {
    const resultat = zWeek.safeParse('2026-10-20');

    expect(resultat.success).toBe(false);
    expect(resultat.error?.issues.map(({ message }) => message)).toEqual([
      'Une semaine se désigne par son lundi.',
    ]);
  });

  it('refuse un dimanche', () => {
    expect(zWeek.safeParse('2026-10-25').success).toBe(false);
  });

  it('refuse ce qui n’est pas un jour', () => {
    expect(zWeek.safeParse('2026-W43').success).toBe(false);
  });
});

describe('zCents', () => {
  it.each([0, 1, 125_000])('accepte %i centimes', (valeur) => {
    expect(zCents.parse(valeur)).toBe(valeur);
  });

  it.each([
    ['un montant négatif', -1],
    ['une fraction de centime', 12.5],
    ['un montant en chaîne', '1250'],
  ])('refuse %s', (_cas, valeur) => {
    expect(zCents.safeParse(valeur).success).toBe(false);
  });
});

describe('zMoney', () => {
  it('pose l’euro par défaut', () => {
    expect(zMoney.parse({ cents: 1250 })).toEqual({
      cents: 1250,
      currency: 'EUR',
    });
  });

  it('refuse une autre devise que l’euro', () => {
    expect(zMoney.safeParse({ cents: 1250, currency: 'USD' }).success).toBe(
      false,
    );
  });

  it('refuse un montant négatif', () => {
    expect(zMoney.safeParse({ cents: -1 }).success).toBe(false);
  });
});

describe('aujourdhui', () => {
  it('calcule par défaut dans le fuseau de référence, Europe/Paris', () => {
    expect(FUSEAU).toBe('Europe/Paris');
    expect(aujourdhui(undefined, new Date('2026-01-15T23:30:00Z'))).toBe(
      '2026-01-16',
    );
  });

  it.each([
    // Heure d'hiver (UTC+1).
    ['2026-01-15T22:30:00Z', '2026-01-15'],
    ['2026-01-15T23:30:00Z', '2026-01-16'],
    ['2026-01-16T00:30:00Z', '2026-01-16'],
    // Heure d'été (UTC+2).
    ['2026-07-14T21:30:00Z', '2026-07-14'],
    ['2026-07-14T23:30:00Z', '2026-07-15'],
    ['2026-07-15T00:30:00Z', '2026-07-15'],
    // Passage à l'heure d'été, dernier dimanche de mars : 2 h devient 3 h.
    ['2026-03-28T23:30:00Z', '2026-03-29'],
    ['2026-03-29T00:30:00Z', '2026-03-29'],
    ['2026-03-29T23:30:00Z', '2026-03-30'],
    ['2026-03-30T00:30:00Z', '2026-03-30'],
    // Passage à l'heure d'hiver, dernier dimanche d'octobre : 3 h devient 2 h.
    ['2026-10-24T23:30:00Z', '2026-10-25'],
    ['2026-10-25T00:30:00Z', '2026-10-25'],
    ['2026-10-25T23:30:00Z', '2026-10-26'],
    ['2026-10-26T00:30:00Z', '2026-10-26'],
  ])('à %s, rend le %s à Paris', (instant, jour) => {
    expect(aujourdhui(FUSEAU, new Date(instant))).toBe(jour);
  });

  it('change de jour au réveillon, d’une année sur l’autre', () => {
    expect(aujourdhui(FUSEAU, new Date('2026-12-31T23:30:00Z'))).toBe(
      '2027-01-01',
    );
  });

  it('suit le fuseau demandé', () => {
    expect(
      aujourdhui('America/New_York', new Date('2026-01-16T00:30:00Z')),
    ).toBe('2026-01-15');
  });

  it('rend un zDay', () => {
    expect(zDay.safeParse(aujourdhui()).success).toBe(true);
  });
});

describe('lundiDe', () => {
  it.each([
    ['un lundi, qui est son propre lundi', '2026-10-19', '2026-10-19'],
    ['un mardi', '2026-10-20', '2026-10-19'],
    ['un dimanche, le dernier jour de la semaine', '2026-10-25', '2026-10-19'],
    ['le lendemain du passage à l’heure d’hiver', '2026-10-26', '2026-10-26'],
    ['le jour du passage à l’heure d’été', '2026-03-29', '2026-03-23'],
    ['un jour en début de mois', '2026-04-02', '2026-03-30'],
    ['un 29 février', '2028-02-29', '2028-02-28'],
    ['un 1er janvier', '2027-01-01', '2026-12-28'],
  ])('rend le lundi de %s', (_cas, jour, lundi) => {
    expect(lundiDe(jour)).toBe(lundi);
  });

  it('rend une zWeek', () => {
    expect(zWeek.safeParse(lundiDe('2026-10-22')).success).toBe(true);
  });

  it('refuse ce qui n’est pas un jour', () => {
    expect(() => lundiDe('2026-02-30')).toThrow();
  });
});

describe('zPeriod', () => {
  const SEPTEMBRE = {
    from: '2026-09-01T00:00:00.000Z',
    to: '2026-09-30T23:59:59.999Z',
  };

  it('accepte deux bornes dans l’ordre', () => {
    expect(zPeriod.parse(SEPTEMBRE)).toEqual(SEPTEMBRE);
  });

  it('accepte une période d’un seul instant', () => {
    expect(
      zPeriod.safeParse({ from: SEPTEMBRE.from, to: SEPTEMBRE.from }).success,
    ).toBe(true);
  });

  it.each([
    ['sans début', { to: SEPTEMBRE.to }, 'from'],
    ['sans fin', { from: SEPTEMBRE.from }, 'to'],
    ['avec une borne qui n’est pas un instant', { ...SEPTEMBRE, from: 'hier' }, 'from'],
    ['qui finit avant de commencer', { from: SEPTEMBRE.to, to: SEPTEMBRE.from }, 'to'],
  ])('refuse une période %s, sur le bon champ', (_cas, periode, champ) => {
    const resultat = zPeriod.safeParse(periode);

    expect(resultat.success).toBe(false);
    expect(resultat.error?.issues.map(({ path }) => path.join('.'))).toEqual([
      champ,
    ]);
  });

  it('compare des instants, pas des chaînes', () => {
    expect(
      zPeriod.safeParse({
        from: '2026-09-01T00:00:00Z',
        to: '2026-09-01T00:00:00.000Z',
      }).success,
    ).toBe(true);
  });
});

describe('periodeDuMois', () => {
  it.each([
    // Octobre : commence à l’heure d’été (UTC+2), finit à l’heure d’hiver.
    ['2026-10', '2026-09-30T22:00:00.000Z', '2026-10-31T22:59:59.999Z'],
    // Janvier, tout entier à l’heure d’hiver, et qui commence l’année.
    ['2026-01', '2025-12-31T23:00:00.000Z', '2026-01-31T22:59:59.999Z'],
    // Mars : passe à l’heure d’été le dernier dimanche.
    ['2026-03', '2026-02-28T23:00:00.000Z', '2026-03-31T21:59:59.999Z'],
    // Décembre, dont la fin est le début de l’année suivante.
    ['2026-12', '2026-11-30T23:00:00.000Z', '2026-12-31T22:59:59.999Z'],
    // Février d’une année bissextile.
    ['2028-02', '2028-01-31T23:00:00.000Z', '2028-02-29T22:59:59.999Z'],
  ])('borne %s du premier au dernier jour, à Paris', (mois, from, to) => {
    expect(periodeDuMois(mois)).toEqual({ from, to });
  });

  it('rend une zPeriod', () => {
    expect(zPeriod.safeParse(periodeDuMois('2026-10')).success).toBe(true);
  });

  it('refuse ce qui n’est pas un mois', () => {
    expect(() => periodeDuMois('2026-13')).toThrow();
    expect(() => periodeDuMois('octobre')).toThrow();
  });
});

describe('periodeDeLaSemaine', () => {
  it.each([
    // Une semaine d’été, du lundi au dimanche.
    ['2026-09-14', '2026-09-13T22:00:00.000Z', '2026-09-20T21:59:59.999Z'],
    // La semaine du passage à l’heure d’hiver (dimanche 25 octobre).
    ['2026-10-19', '2026-10-18T22:00:00.000Z', '2026-10-25T22:59:59.999Z'],
    // Une semaine à cheval sur deux années.
    ['2026-12-28', '2026-12-27T23:00:00.000Z', '2027-01-03T22:59:59.999Z'],
  ])('borne la semaine du %s du lundi au dimanche, à Paris', (lundi, from, to) => {
    expect(periodeDeLaSemaine(lundi)).toEqual({ from, to });
  });

  it('refuse un jour qui n’est pas un lundi', () => {
    expect(() => periodeDeLaSemaine('2026-09-15')).toThrow();
  });
});
