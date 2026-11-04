// Minutes GitHub Actions du mois pour le compte, face à son quota inclus.
// Lancé chaque jour par .github/workflows/actions-minutes.yml : sort en erreur
// dès 80 % du quota, ou dès que la consommation projetée à la fin du mois le
// dépasse, et GitHub envoie l'échec par e-mail. Les agents ouvrent beaucoup de
// propositions : c'est ici qu'on voit la facture venir avant qu'elle arrive.
//
// L'usage couvre tous les dépôts du compte, publics compris : le chiffre ne
// peut être que supérieur à ce qui est facturé.
//
// Repris de TGR (.github/scripts/actions-minutes.mjs), même compte.
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const ALERT_RATIO = 0.8;

/** Minutes incluses dans GitHub Pro, sans variable ACTIONS_MINUTES_QUOTA. */
export const DEFAULT_QUOTA = 3000;

const DAY_MS = 86_400_000;

/**
 * Le quota lu dans ACTIONS_MINUTES_QUOTA. Une valeur absente prend celui de
 * GitHub Pro ; une valeur illisible fait échouer, plutôt que de surveiller en
 * silence un autre seuil que celui qu'on croit avoir posé.
 */
export function quotaDe(valeur) {
  if (valeur === undefined || valeur.trim() === '') return DEFAULT_QUOTA;
  const quota = Number(valeur);
  if (!/^\d+$/.test(valeur.trim()) || quota <= 0) {
    throw new Error(
      `Variable ACTIONS_MINUTES_QUOTA illisible (« ${valeur} ») : un nombre entier de minutes, par exemple 3000.`,
    );
  }
  return quota;
}

/**
 * Minutes du mois, à partir des lignes de GET /users/{user}/settings/billing/usage,
 * projection à la fin du mois au rythme déjà pris (au moins un jour écoulé) et
 * montant facturé en dollars (`billed` : netAmount, stockage compris).
 */
export function minutesReport(usageItems, quota, now = new Date()) {
  const actions = usageItems.filter(
    (i) => i.product.toLowerCase() === 'actions',
  );
  const used = actions
    .filter((i) => i.unitType.toLowerCase() === 'minutes')
    .reduce((sum, i) => sum + i.quantity, 0);
  const billed =
    Math.round(actions.reduce((sum, i) => sum + (i.netAmount ?? 0), 0) * 100) /
    100;
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  const projected = Math.round(
    (used * (end - start)) / Math.max(now.getTime() - start, DAY_MS),
  );
  return {
    used,
    quota,
    projected,
    billed,
    alert: used >= quota * ALERT_RATIO || projected > quota,
  };
}

async function main() {
  const { BILLING_TOKEN, GITHUB_USER, MINUTES_QUOTA, GITHUB_STEP_SUMMARY } =
    process.env;
  if (!BILLING_TOKEN) {
    throw new Error(
      'Secret ACTIONS_BILLING_TOKEN manquant : jeton fin du compte avec la permission « Plan » en lecture.',
    );
  }
  const quota = quotaDe(MINUTES_QUOTA);
  const now = new Date();
  const url = `https://api.github.com/users/${GITHUB_USER}/settings/billing/usage?year=${now.getUTCFullYear()}&month=${now.getUTCMonth() + 1}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${BILLING_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok)
    throw new Error(
      `API de facturation GitHub : ${res.status} ${await res.text()}`,
    );
  const { usageItems = [] } = await res.json();

  const { used, projected, billed, alert } = minutesReport(
    usageItems,
    quota,
    now,
  );
  const line = `Minutes Actions ce mois : ${Math.round(used)} / ${quota} (${Math.round((used / quota) * 100)} %, alerte à ${ALERT_RATIO * 100} %), ${projected} projetées à la fin du mois, ${billed.toFixed(2)} $ facturés`;
  console.log(line);
  if (GITHUB_STEP_SUMMARY) appendFileSync(GITHUB_STEP_SUMMARY, `${line}\n`);
  if (alert) {
    console.log(
      `::error::${line}. Réduire les exécutions (agents, propositions), ou vérifier que le budget de dépassement du compte couvre la différence.`,
    );
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
