---
id: DASH-1
title: "Résumés de module et Calculateur d'À faire"
epic: DASH
type: feature
priority: P0
size: M
milestone: M5 Tableau de bord et barre de commande
blocked_by: [CUISINE-9, AGENDA-1]
adr: [0011, 0017, 0030]
risques: []
revue_visuelle: false
---

## Contexte

Les **À faire** sont calculés à la lecture depuis l'état réel des modules : planning dont des repas attendent une décision, liste non arrêtée, ingrédient qui périme, Échéance proche. Rien n'est stocké, rien ne se coche. Les widgets hétérogènes ne passent **pas** par `AgendaContributor` : chaque module expose son résumé (ADR 0011).

## État actuel du code

- Le port d'Agenda comme modèle d'inversion de dépendance : `packages/api/src/app/agenda-port/` (`agenda.registry.ts`).

## À faire

- Port `ResumeurDeModule` : `resumer(maintenant) → ResumeDeModule` (contrat zod `zModuleSummary` : `{ module, indicators: { key, label, value }[], signals: Signal[] }`, `Signal` = `{ kind, ref, label, dueOn? }`) ; registre sur le modèle de `AgendaRegistry`.
- Résumeurs : `food` (planning de la semaine avec repas `PROPOSED` → signal ; liste ouverte → signal et indicateur « articles restants » ; ingrédient qui périme dans les trois jours → signal), `calendar` (Échéance dans les sept jours → signal), `training` si présent (prochaine séance → indicateur).
- Module profond `dashboard/a-faire.ts` (pur) : `aFaire(resumes) → AFaire[]` (tri : échéance la plus proche d'abord), chaque À faire avec un lien vers l'écran qui le résout.
- Routes : `GET /dashboard/todos`, `GET /dashboard/summaries`.

## Décisions déjà prises

- Le tableau de bord ne connaît aucun module : il ne lit que le registre.

## Critères d'acceptation

- [ ] Chaque situation produit son À faire, et il disparaît quand la situation change (test par situation).
- [ ] Ajouter un résumeur ne modifie pas le module `dashboard`.

## Vérification

- `pnpm exec nx test api -- a-faire` ; `pnpm exec nx test-integration api -- dashboard` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.

## Pour la prod

Rien.

## Hors périmètre

- L'écran : DASH-2.

## Dépendances

- CUISINE-9, AGENDA-1.
