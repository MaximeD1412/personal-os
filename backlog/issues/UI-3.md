---
id: UI-3
title: "Motifs d'écran : formulaire prérempli par URL, erreurs de champ, confirmation, états chargement, vide et erreur"
epic: UI
type: feature
priority: P0
size: M
milestone: M1 UI
blocked_by: [UI-1, SOCLE-4]
adr: [0030, 0018]
risques: [AG-2, AG-4]
revue_visuelle: true
---

## Contexte

Chaque écran de module va créer, modifier, lister. L'ADR 0030 fixe le préremplissage par URL et l'affichage des erreurs de l'API ; l'ADR 0018 impose qu'aucune modification ne parte sans confirmation. Ces motifs deviennent des composants, pour qu'un agent compose un écran au lieu de l'inventer.

## État actuel du code

- `packages/dashboard/src/app/formulaire.ts` (SOCLE-4) : `prefillDepuisRequete`, `erreursDeChamp`.
- `packages/ui/dccm/` (UI-1) ; contrôles spartan `packages/ui/{input,label,select,button}`.

## À faire

- `DccmField` : libellé, contrôle projeté, message d'erreur de champ (depuis `erreursDeChamp`), aide.
- `DccmFormPage` : titre, bandeau « valeurs non reprises » (paramètres ignorés du préremplissage), zone de formulaire, actions « Annuler » / action principale ; l'action principale est désactivée pendant l'envoi.
- `DccmConfirm` : dialogue de confirmation pour une action destructrice ou une transition (« Clôturer la liste ? »).
- `DccmState` : états `loading` (squelette), `empty` (message + action), `error` (`message` de l'API + « Réessayer »).
- Stories pour chacun.
- Section « Composer un écran » dans `docs/design-system.md` : liste, formulaire, détail ; l'URL de chaque formulaire et ses paramètres de préremplissage ; ce qui exige `DccmConfirm`.

## Décisions déjà prises

- Une transition métier (clôturer, arrêter, déclarer) passe toujours par `DccmConfirm` ; une création ou une modification simple non.

## Critères d'acceptation

- [ ] Les quatre composants ont leurs stories, en clair et en sombre.
- [ ] Un formulaire composé avec `DccmFormPage` et `DccmField` affiche les erreurs de champ renvoyées par l'API.
- [ ] La documentation « Composer un écran » existe.

## Vérification

- `pnpm exec nx affected -t lint test build --base=origin/develop` ; `pnpm exec nx run ui:build-storybook`.
- Captures des stories jointes à la PR.

## Pour la prod

Rien.

## Hors périmètre

- La migration des écrans existants : UI-4.

## Dépendances

- UI-1, SOCLE-4.
