export type NomDuFournisseur = 'claude' | 'factice';

export interface IAConfig {
  fournisseur: NomDuFournisseur;
  modele: string;
  /** Vide pour le double de test, qui n'appelle personne. */
  cleApi: string | null;
  budgetMensuelCentimes: number;
  prixEntreeParMillionCentimes: number;
  prixSortieParMillionCentimes: number;
}

export const IA_CONFIG = 'personal-os:ia-config';

const FOURNISSEURS: readonly NomDuFournisseur[] = ['claude', 'factice'];

const MODELE_PAR_DEFAUT = 'claude-sonnet-5-5';

const BUDGET_PAR_DEFAUT = 500;

type Environnement = Record<string, string | undefined>;

/**
 * La configuration du port IA. Hors production, le double de test répond par
 * défaut : un poste local, la CI et le staging n'appellent personne. La
 * production, elle, doit nommer `claude` : elle refuse de démarrer sur le
 * double, qui y rendrait des propositions inventées.
 *
 * Le tarif est exigé avec Claude, sans valeur par défaut : un modèle changé
 * sans son tarif fausserait le plafond en silence.
 */
export function lireIAConfig(env: Environnement = process.env): IAConfig {
  const production = env['APP_ENV'] === 'production';
  const fournisseur = lireFournisseur(env, production);

  // Le double ne coûte rien : son tarif n'a de sens que pour éprouver le plafond.
  const tarifParDefaut = fournisseur === 'claude' ? undefined : 0;

  return {
    fournisseur,
    modele: env['AI_MODEL'] || MODELE_PAR_DEFAUT,
    cleApi: fournisseur === 'claude' ? requis(env, 'ANTHROPIC_API_KEY') : null,
    budgetMensuelCentimes: centimes(
      env,
      'AI_MONTHLY_BUDGET_CENTS',
      BUDGET_PAR_DEFAUT,
    ),
    prixEntreeParMillionCentimes: centimes(
      env,
      'AI_PRICE_INPUT_PER_MTOK_CENTS',
      tarifParDefaut,
    ),
    prixSortieParMillionCentimes: centimes(
      env,
      'AI_PRICE_OUTPUT_PER_MTOK_CENTS',
      tarifParDefaut,
    ),
  };
}

function lireFournisseur(
  env: Environnement,
  production: boolean,
): NomDuFournisseur {
  const brut = env['AI_PROVIDER'];

  if (!brut) {
    if (production) {
      throw new Error(
        'AI_PROVIDER est requis en production, et doit valoir « claude ».',
      );
    }
    return 'factice';
  }
  if (!FOURNISSEURS.includes(brut as NomDuFournisseur)) {
    throw new Error(
      `AI_PROVIDER vaut « ${brut} » : seuls ${FOURNISSEURS.join(' et ')} sont connus.`,
    );
  }
  if (brut === 'factice' && production) {
    throw new Error(
      "AI_PROVIDER=factice est refusé en production : le double de test n'appelle aucun modèle.",
    );
  }
  return brut as NomDuFournisseur;
}

function requis(env: Environnement, nom: string): string {
  const valeur = env[nom];
  if (!valeur) {
    throw new Error(`${nom} est requis pour appeler Claude.`);
  }
  return valeur;
}

/** Un nombre entier de centimes, positif ou nul ; requis quand il n'a pas de défaut. */
function centimes(env: Environnement, nom: string, defaut?: number): number {
  const brut = env[nom];
  if (!brut) {
    if (defaut === undefined) {
      throw new Error(
        `${nom} est requis pour appeler Claude : le plafond de coût en dépend.`,
      );
    }
    return defaut;
  }

  const valeur = Number(brut);
  if (!Number.isInteger(valeur) || valeur < 0) {
    throw new Error(
      `${nom} doit être un nombre entier de centimes, positif ou nul.`,
    );
  }
  return valeur;
}
