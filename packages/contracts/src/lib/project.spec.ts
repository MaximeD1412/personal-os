import {
  MONTANT_MAX_D_UNE_DEPENSE,
  totalDesDepenses,
  zProjectExpenseInput,
  zProjectInput,
  zProjectUpdate,
} from './project';

/** Les chemins des champs qu'un schéma refuse, comme `fields` les rendra. */
function cheminsRefuses(resultat: {
  success: boolean;
  error?: { issues: { path: PropertyKey[] }[] };
}): string[] {
  return (resultat.error?.issues ?? []).map(({ path }) => path.join('.'));
}

describe('totalDesDepenses', () => {
  it('additionne les centimes sans arrondi', () => {
    const centimes = [10, 20, 1999, 1];

    expect(
      totalDesDepenses(centimes.map((cents) => ({ cents, currency: 'EUR' }))),
    ).toEqual({ cents: 2030, currency: 'EUR' });
  });

  it('reste exact là où des euros en virgule flottante dériveraient', () => {
    // 0,10 € dix mille fois : en euros flottants, la somme ne tombe pas juste.
    const depenses = Array.from({ length: 10_000 }, () => ({
      cents: 10,
      currency: 'EUR' as const,
    }));

    expect(totalDesDepenses(depenses).cents).toBe(100_000);
  });

  it('vaut zéro euro pour un Projet sans dépense', () => {
    expect(totalDesDepenses([])).toEqual({ cents: 0, currency: 'EUR' });
  });
});

describe('zProjectInput', () => {
  it('ne demande que le titre, sans notes ni liens par défaut', () => {
    expect(zProjectInput.parse({ title: '  Personal OS ' })).toEqual({
      title: 'Personal OS',
      notes: '',
      links: [],
    });
  });

  it('refuse un titre vide', () => {
    expect(cheminsRefuses(zProjectInput.safeParse({ title: '  ' }))).toEqual([
      'title',
    ]);
  });

  it("refuse un lien qui n'est pas une adresse web", () => {
    const resultat = zProjectInput.safeParse({
      title: 'Personal OS',
      links: [
        { label: 'Dépôt', url: 'https://github.com/exemple/personal-os' },
        { label: 'Script', url: 'javascript:alert(1)' },
      ],
    });

    expect(cheminsRefuses(resultat)).toEqual(['links.1.url']);
  });
});

describe('zProjectUpdate', () => {
  it('ne porte que ce que la modification change', () => {
    expect(zProjectUpdate.parse({ notes: '# Feuille de route' })).toEqual({
      notes: '# Feuille de route',
    });
  });
});

describe('zProjectExpenseInput', () => {
  it('prend un montant en centimes, en euros par défaut, et un jour civil', () => {
    expect(
      zProjectExpenseInput.parse({
        label: 'Nom de domaine',
        amount: { cents: 1299 },
        spentOn: '2026-10-12',
      }),
    ).toEqual({
      label: 'Nom de domaine',
      amount: { cents: 1299, currency: 'EUR' },
      spentOn: '2026-10-12',
    });
  });

  it.each([
    [{ cents: 12.5 }, 'amount.cents'],
    [{ cents: -1 }, 'amount.cents'],
    [{ cents: MONTANT_MAX_D_UNE_DEPENSE + 1 }, 'amount.cents'],
    [{ cents: 100, currency: 'USD' }, 'amount.currency'],
  ])('refuse le montant %j', (amount, chemin) => {
    const resultat = zProjectExpenseInput.safeParse({
      label: 'Serveur',
      amount,
      spentOn: '2026-10-12',
    });

    expect(cheminsRefuses(resultat)).toEqual([chemin]);
  });

  it("refuse un jour qui n'est pas un jour civil", () => {
    const resultat = zProjectExpenseInput.safeParse({
      label: 'Serveur',
      amount: { cents: 100 },
      spentOn: '2026-10-12T10:00:00Z',
    });

    expect(cheminsRefuses(resultat)).toEqual(['spentOn']);
  });
});
