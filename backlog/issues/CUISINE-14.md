---
id: CUISINE-14
title: "Port IA : interface unique, adaptateur Claude, double de test, trace et plafond de coût"
epic: CUISINE
type: feature
priority: P0
size: M
milestone: M3 Cuisine boucle
blocked_by: [SOCLE-3]
adr: [0030, 0018]
risques: [IA-2, IA-3, IA-4, SEC-6]
revue_visuelle: false
---

## Contexte

Le PRD veut que l'IA (génération de planning, résolution d'intention de la barre de commande) passe par **une interface applicative unique**, le fournisseur étant un détail remplaçable. Chaque appel est tracé (prompt, modèle, réponse) pour comprendre une proposition étrange, et le coût est plafonné. Fournisseur retenu : l'API Claude d'Anthropic.

## État actuel du code

- Aucun code IA. Configuration par variables d'environnement (`packages/api/src/app/auth/auth.config.ts` comme modèle de lecture et de validation de configuration).

## À faire

- **Avant d'écrire le code, charger le skill `claude-api`** (SDK, identifiants de modèles, sorties structurées).
- `packages/api/src/app/ai/` :
  - port `GenerateurIA` : `genererStructure<T>({ but, systeme, message, schema: ZodType<T>, maxTokens }) → Promise<{ valeur: T, traceId }>` ; la sortie est **toujours** validée par le schéma zod (sortie structurée de l'API, puis `schema.parse`) ; une sortie invalide → `ErreurMetier('ai.invalid_output', …, 502)` après une seule nouvelle tentative ;
  - adaptateur `ClaudeGenerateur` (`@anthropic-ai/sdk`), modèle par `AI_MODEL` (défaut `claude-sonnet-5-5`), clé `ANTHROPIC_API_KEY` ;
  - double `GenerateurIAFactice` pour les tests : réponses programmées par `but`, aucun réseau ;
  - choix par `AI_PROVIDER` (`claude` | `factice`, `factice` par défaut hors production ; la production refuse de démarrer avec `factice`).
- Trace : Prisma `AiTrace { id, scopeId, purpose, model, system, input, output, inputTokens, outputTokens, costCents, createdAt }`, Espace foyer ; route `GET /ai-traces?cursor=` (journal en ajout seul, curseur, 50 par défaut) et `GET /ai-traces/:id`.
- Plafond : `AI_MONTHLY_BUDGET_CENTS` (défaut 500) ; avant chaque appel, si la somme des `costCents` du mois civil (Paris) l'atteint → 422 `ai.budget_exceeded`. Coût estimé à partir des jetons et d'un tarif par modèle en configuration (`AI_PRICE_INPUT_PER_MTOK_CENTS`, `AI_PRICE_OUTPUT_PER_MTOK_CENTS`).
- Aucun outil d'écriture n'est jamais donné au modèle : il produit des données, l'application décide (risque SEC-6).

## Décisions déjà prises

- Une seule nouvelle tentative sur sortie invalide, puis échec explicite.
- Pas d'écran des traces dans ce ticket : l'accès se fait depuis l'écran de génération (CUISINE-17).

## Critères d'acceptation

- [ ] Les tests n'appellent jamais le réseau (double).
- [ ] Une sortie qui ne respecte pas le schéma est rejetée.
- [ ] Le plafond mensuel bloque l'appel suivant avec `ai.budget_exceeded`.
- [ ] Chaque appel laisse une trace consultable.

## Vérification

- `pnpm exec nx test api -- ai` ; `pnpm exec nx test-integration api -- ai-trace` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.

## Pour la prod

Ajouter à `docs/pilotage/mep.json` : créer une clé API Anthropic dédiée avec une limite de dépense côté console, poser `ANTHROPIC_API_KEY`, `AI_PROVIDER=claude`, `AI_MODEL`, `AI_MONTHLY_BUDGET_CENTS` et les deux tarifs dans `stack.env` (prod) ; le staging garde `AI_PROVIDER=factice`.

## Hors périmètre

- La génération du planning : CUISINE-16. La résolution d'intention : CMD-2.

## Dépendances

- SOCLE-3.
