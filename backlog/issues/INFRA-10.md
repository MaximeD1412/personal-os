---
id: INFRA-10
title: "Outil de captures pour la revue visuelle : session de démo et pages en 390 et 1280 px"
epic: INFRA
type: chore
priority: P0
size: S
milestone: M0 Outillage agents et staging
blocked_by: [INFRA-6]
adr: [0026, 0030]
risques: [AG-4]
revue_visuelle: false
---

## Contexte

Un ticket `revue-visuelle` joint à sa PR des captures mobile (390 px) et desktop (1280 px) de chaque écran touché, ouvert par son URL préremplie. Le tableau de bord n'a aucun écran sans session (ADR 0026), et un agent ne peut pas passer par Authentik.

## État actuel du code

- Sessions serveur en base (`Session`, cookie `HttpOnly`) : `packages/api/src/app/auth/` (`auth.repository.ts`, `cookies.ts`).
- Pile locale : `docker compose up` (tableau de bord sur 4200).
- Le skill `agent-browser` est disponible sur la machine (CLI `agent-browser`).

## À faire

- `scripts/captures.sh <chemin> [<chemin>…]` :
  1. crée une Session en base pour le premier compte de `DEMO_ACCOUNT_EMAILS` (via un petit script TS dans `packages/database/src/demo/session.ts`, qui refuse `APP_ENV=production`) ;
  2. pose le cookie de session dans `agent-browser` ;
  3. pour chaque chemin, capture en 390×844 et 1280×800 dans `captures/<slug>-{mobile,desktop}.png` ;
  4. supprime la Session à la fin.
- `captures/` dans `.gitignore`.
- Documenter dans `AGENTS.md` (section revue visuelle) la commande et la publication des captures : elles sont commitées sur une branche dédiée `captures/<n>` (jamais sur la branche du ticket) et référencées dans la description de la PR par leur URL `https://github.com/MaximeD1412/personal-os/blob/captures/<n>/<fichier>?raw=true`.

## Décisions déjà prises

- La session de démo n'existe que le temps de la capture ; aucune route de connexion de contournement n'est ajoutée à l'API.

## Critères d'acceptation

- [ ] `scripts/captures.sh /agenda /calendrier` produit 4 captures authentifiées.
- [ ] Aucune Session de capture ne reste en base après exécution, même en cas d'échec (trap).
- [ ] Refus avec `APP_ENV=production`.

## Vérification

- Pile locale lancée, `pnpm demo:seed`, puis `scripts/captures.sh /agenda`.

## Pour la prod

Rien.

## Hors périmètre

- Le jeu de démo : INFRA-6.

## Dépendances

- INFRA-6.
