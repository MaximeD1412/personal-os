---
id: SOCLE-7
title: "Retirer l'entité jouet Trace et le fil traceur"
epic: SOCLE
type: chore
priority: P2
size: S
milestone: M0 Outillage agents et staging
blocked_by: [SOCLE-3]
adr: [0024, 0016]
risques: []
revue_visuelle: false
---

## Contexte

`Trace` n'existait que pour démontrer le cloisonnement (#6) « jusqu'au jour où un vrai module portera un Espace ». `Event` en porte un depuis #7.

## État actuel du code

- API : `packages/api/src/app/traces/` ; `app.module.ts`.
- Front : `traces.ts`, `trace.service.ts`, `traces.spec.ts`, route `/fil-traceur`.
- `contracts/src/lib/trace.ts` ; modèle `Trace` ; `packages/database/src/lib/espace/modeles.ts` et `cloisonnement.spec.ts` ; `packages/api/test/module-restreint.ts` ; `cloisonnement.integration-spec.ts`.

## À faire

- Réécrire les tests de cloisonnement qui s'appuient sur `Trace` pour qu'ils s'appuient sur `Event`, sans perdre un seul cas.
- Supprimer le module, l'écran, la route, le contrat.
- Migration en deux temps (ADR 0024) : ce ticket retire tout usage du code ; la table `Trace` est supprimée par une migration **dans la même PR** seulement si aucune version précédente déployée ne la lit encore — sinon, ajouter à `docs/pilotage/mep.json` un élément « supprimer la table Trace après la prochaine livraison ».

## Décisions déjà prises

- Option retenue : la table est supprimée à la livraison suivante (élément MEP), pour respecter strictement l'ADR 0024.

## Critères d'acceptation

- [ ] Plus aucune référence à `Trace` dans le code applicatif.
- [ ] Les tests de cloisonnement couvrent les mêmes cas qu'avant, sur `Event`.

## Vérification

- `pnpm exec nx test-integration api -- cloisonnement` ; `pnpm exec nx test database` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.

## Pour la prod

Un élément MEP : migration de suppression de la table `Trace` après la prochaine livraison.

## Hors périmètre

Aucun.

## Dépendances

- SOCLE-3.
