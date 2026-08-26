import { lireAuthConfig } from './auth.config';

/**
 * La configuration est validée au démarrage, pas au premier clic sur « se
 * connecter ». Une pile qui se lève sans savoir authentifier passerait sa
 * vérification de santé, et l'agent de déploiement la garderait.
 */
describe('lireAuthConfig', () => {
  const environnementInitial = process.env;

  beforeEach(() => {
    process.env = {
      OIDC_ISSUER: 'https://auth.exemple.test/application/o/personal-os/',
      OIDC_CLIENT_ID: 'personal-os',
      OIDC_CLIENT_SECRET: 'secret',
      OIDC_REDIRECT_URI: 'https://app.exemple.test/api/auth/callback',
      DASHBOARD_URL: 'https://app.exemple.test/',
      AUTH_ALLOWED_EMAILS: 'Une.Personne@Exemple.test, autre@exemple.test',
    };
  });

  afterAll(() => {
    process.env = environnementInitial;
  });

  it.each([
    'OIDC_ISSUER',
    'OIDC_CLIENT_ID',
    'OIDC_CLIENT_SECRET',
    'OIDC_REDIRECT_URI',
    'DASHBOARD_URL',
  ])('refuse de démarrer sans %s', (variable) => {
    delete process.env[variable];

    expect(() => lireAuthConfig()).toThrow(variable);
  });

  it("refuse une liste d'admission vide, qui n'ouvrirait à personne", () => {
    // La panne serait longue à comprendre : elle ressemble trait pour trait à
    // un problème d'Authentik, alors qu'elle est ici.
    process.env['AUTH_ALLOWED_EMAILS'] = '  ,  ';

    expect(() => lireAuthConfig()).toThrow('AUTH_ALLOWED_EMAILS');
  });

  it('compare les adresses admises sans tenir compte de la casse', () => {
    // Authentik rend l'adresse telle qu'elle a été saisie ; la liste est
    // recopiée à la main sur le serveur. Les deux finissent par diverger.
    expect(lireAuthConfig().allowedEmails).toEqual([
      'une.personne@exemple.test',
      'autre@exemple.test',
    ]);
  });

  it("garde l'émetteur mot pour mot, barre finale comprise", () => {
    // C'est la valeur que porte le `iss` des jetons, et la comparaison y est
    // littérale : la raboter ferait échouer toutes les vérifications.
    expect(lireAuthConfig().issuer).toBe(
      'https://auth.exemple.test/application/o/personal-os/',
    );
  });

  it('exige le cookie Secure par défaut', () => {
    expect(lireAuthConfig().cookieSecure).toBe(true);
  });

  it('ne désarme Secure que sur une demande explicite', () => {
    process.env['SESSION_COOKIE_SECURE'] = 'false';

    expect(lireAuthConfig().cookieSecure).toBe(false);
  });

  it('refuse une durée de session qui ne serait pas un nombre de secondes', () => {
    process.env['SESSION_TTL_SECONDS'] = 'douze heures';

    expect(() => lireAuthConfig()).toThrow('SESSION_TTL_SECONDS');
  });
});
