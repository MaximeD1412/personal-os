---
id: DASH-2
title: "Accueil : ce qui m'attend, À faire et widgets de résumé"
epic: DASH
type: feature
priority: P0
size: M
milestone: M5 Tableau de bord et barre de commande
blocked_by: [DASH-1, UI-2]
adr: [0011, 0017]
risques: []
revue_visuelle: true
reprend: 11
---

## Contexte

La page d'accueil répond à « qu'est-ce qui m'attend dans les prochains jours ? » et « qu'est-ce qui requiert mon attention ? ».

## État actuel du code

- `GET /agenda`, `GET /dashboard/todos`, `GET /dashboard/summaries` (DASH-1) ; composants `DccmKpiTile`, `HlmCard` (UI-6) ; coque (UI-2).

## À faire

- Écran `/` (remplace la redirection vers `/agenda`) : « Les 7 prochains jours » (Agenda de la période), « À faire » (liens vers les écrans), widgets de résumé par module (`DccmKpiTile`).
- Zone d'en-tête réservée à la barre de commande (CMD-3).

## Décisions déjà prises

- Maquette : `accueil-1424.png`, `accueil-1024.png`, `accueil-390.png` dans `design/captures/ecrans/` (frames `O1sya8`, `D4B8M`, `PFX8V` de `design/personalos.pen`). Elle donne l'apparence, ce ticket le périmètre : un élément de maquette absent du ticket n'est pas implémenté, ses textes de remplissage ne sont pas repris, et l'écran se compose avec les composants du design system (`docs/design-system.md`).
- L'accueil ne fait que lire : aucune action ne s'y fait directement, chaque élément renvoie vers son écran.

## Critères d'acceptation

- [ ] L'accueil montre l'Agenda des sept jours, les À faire et les widgets du jeu de démo.
- [ ] Chaque À faire mène à l'écran qui le résout.

## Vérification

- `pnpm exec nx test dashboard` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.
- Captures : `scripts/captures.sh /`.

## Pour la prod

Rien.

## Hors périmètre

- La barre de commande : CMD-3. L'état de sauvegarde : DASH-3.

## Dépendances

- DASH-1, UI-2.
