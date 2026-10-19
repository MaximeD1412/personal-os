import { lireIAConfig } from './ia.config';

describe('lireIAConfig', () => {
  const CLAUDE = {
    AI_PROVIDER: 'claude',
    ANTHROPIC_API_KEY: 'cle-de-test',
    AI_PRICE_INPUT_PER_MTOK_CENTS: '200',
    AI_PRICE_OUTPUT_PER_MTOK_CENTS: '1000',
  };

  it('prend le double de test par défaut hors production', () => {
    expect(lireIAConfig({})).toMatchObject({
      fournisseur: 'factice',
      cleApi: null,
      budgetMensuelCentimes: 500,
    });
  });

  it('refuse de démarrer la production avec le double de test', () => {
    expect(() =>
      lireIAConfig({ APP_ENV: 'production', AI_PROVIDER: 'factice' }),
    ).toThrow('AI_PROVIDER');
  });

  it('refuse de démarrer la production sans fournisseur déclaré', () => {
    expect(() => lireIAConfig({ APP_ENV: 'production' })).toThrow(
      'AI_PROVIDER',
    );
  });

  it('garde le double de test au staging', () => {
    expect(
      lireIAConfig({ APP_ENV: 'staging', AI_PROVIDER: 'factice' }).fournisseur,
    ).toBe('factice');
  });

  it('refuse un fournisseur inconnu', () => {
    expect(() => lireIAConfig({ AI_PROVIDER: 'openai' })).toThrow(
      'AI_PROVIDER',
    );
  });

  it('lit Claude, son modèle par défaut et son tarif', () => {
    expect(lireIAConfig({ ...CLAUDE, APP_ENV: 'production' })).toEqual({
      fournisseur: 'claude',
      modele: 'claude-sonnet-5-5',
      cleApi: 'cle-de-test',
      budgetMensuelCentimes: 500,
      prixEntreeParMillionCentimes: 200,
      prixSortieParMillionCentimes: 1000,
    });
  });

  it.each([
    'ANTHROPIC_API_KEY',
    'AI_PRICE_INPUT_PER_MTOK_CENTS',
    'AI_PRICE_OUTPUT_PER_MTOK_CENTS',
  ])('refuse Claude sans %s : le plafond ne se calculerait pas', (variable) => {
    const env: Record<string, string | undefined> = { ...CLAUDE };
    delete env[variable];

    expect(() => lireIAConfig(env)).toThrow(variable);
  });

  it('lit le modèle et le plafond', () => {
    expect(
      lireIAConfig({
        ...CLAUDE,
        AI_MODEL: 'claude-haiku-5-5',
        AI_MONTHLY_BUDGET_CENTS: '1200',
      }),
    ).toMatchObject({
      modele: 'claude-haiku-5-5',
      budgetMensuelCentimes: 1200,
    });
  });

  it.each(['-1', 'cinq euros', '2.5'])(
    'refuse un plafond qui ne serait pas un nombre entier de centimes (%s)',
    (valeur) => {
      expect(() => lireIAConfig({ AI_MONTHLY_BUDGET_CENTS: valeur })).toThrow(
        'AI_MONTHLY_BUDGET_CENTS',
      );
    },
  );
});
