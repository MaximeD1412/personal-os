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

- `GET /agenda`, `GET /dashboard/todos`, `GET /dashboard/summaries` (DASH-1) ; primitives `DccmMetricCard`, `DccmSurface` (UI-1) ; coque (UI-2) ; éventuelle maquette `dashboard-home` reprise par UI-1.

## À faire

- Écran `/` (remplace la redirection vers `/agenda`) : « Les 7 prochains jours » (Agenda de la période), « À faire » (liens vers les écrans), widgets de résumé par module (`DccmMetricCard`).
- Zone d'en-tête réservée à la barre de commande (CMD-3).

## Décisions déjà prises

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
