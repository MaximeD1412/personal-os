---
id: UI-1
title: "Design system DCCM : reprendre la maquette (tokens, Storybook, primitives)"
epic: UI
type: feature
priority: P0
size: M
milestone: M1 UI
blocked_by: []
adr: [0029]
risques: [AG-2, AG-4]
revue_visuelle: true
---

## Contexte

Un design system a été commencé sur la branche `codex/maquette-projet` : direction sombre bleutée, tokens par rôle, Storybook, primitives DCCM prévues. On repart de là, tel quel, pour que les écrans des modules se composent au lieu de s'inventer. Le contenu de cette branche sera revu plus tard ; ce ticket l'intègre proprement sur `develop`.

## État actuel du code

- Sur `origin/codex/maquette-projet` (à pousser par l'humain avant le ticket, voir Dépendances) : `docs/design-system.md` (intention, tokens, primitives à extraire, coque), `.storybook/` (`main.ts`, `preview.ts`), `packages/ui/dccm/`, `packages/theme/tokens.css` modifié, `packages/dashboard/src/app/dashboard-home.{ts,html}`, changements de `eslint.config.mjs`, `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`.
- Sur `develop` : `packages/ui/{badge,button,card,input,label,select,utils}` (spartan/ui), `packages/theme/tokens.css`.
- Figma de référence : « DCCM — Design system & Personal OS » (lien dans `docs/design-system.md`).

## À faire

- Fusionner `origin/codex/maquette-projet` dans la branche du ticket, résoudre les conflits avec `develop` en gardant les conventions de `develop` (ADR 0029, 0030).
- Primitives de `docs/design-system.md` présentes et chacune avec une story : `DccmSurface`, `DccmNavItem`, `DccmStatusBadge`, `DccmMetricCard`, `DccmServiceTile` (la coque `DccmShell` est UI-2, la barre `DccmCommandBar` est CMD-3).
- Cible Nx `storybook` (et `build-storybook`) qui fonctionne ; mode clair et sombre basculables dans Storybook.
- `docs/design-system.md` sur `develop`, complété d'une section « Utiliser le design system » (où vivent les primitives, comment en ajouter une, règle : un écran n'écrit pas de couleur en dur).
- Retirer `dashboard-home` s'il n'est qu'une maquette statique (sa version réelle est DASH-2), ou le garder derrière une route `/maquette` non liée.

## Décisions déjà prises

- Le mode sombre est le défaut, le clair reste disponible (`docs/design-system.md`).
- Aucune primitive ne duplique un contrôle spartan : elles composent `hlmBtn`, `hlmCard`, etc.

## Critères d'acceptation

- [ ] `pnpm exec nx run ui:storybook` démarre et montre chaque primitive en clair et en sombre.
- [ ] Aucune couleur en dur dans `packages/ui/dccm/` (jetons uniquement).
- [ ] La campagne de vérification passe.

## Vérification

- `pnpm exec nx affected -t lint test build --base=origin/develop` ; `pnpm exec nx run ui:build-storybook`.
- Captures : `scripts/captures.sh /agenda /calendrier` (non-régression), plus des captures des stories principales jointes à la PR.

## Pour la prod

Rien.

## Hors périmètre

- La coque et la navigation : UI-2. Les motifs de formulaire : UI-3.

## Dépendances

Aucun ticket. **Geste humain préalable** : commiter et pousser la branche `codex/maquette-projet` (ses changements ne sont aujourd'hui que dans le checkout principal).
