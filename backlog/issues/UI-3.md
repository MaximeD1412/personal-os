---
id: UI-3
title: "Retours et motifs d'écran : Banner, Toast, Modal, états, formulaire prérempli, confirmation"
epic: UI
type: feature
priority: P0
size: M
milestone: M1 UI
blocked_by: [UI-5, UI-6, SOCLE-4]
adr: [0030, 0018]
risques: [AG-2, AG-4]
revue_visuelle: true
reprend: 62
---

## Contexte

Chaque écran de module va créer, modifier, lister. L'ADR 0030 fixe le préremplissage par URL et l'affichage des erreurs de l'API ; l'ADR 0018 impose qu'aucune modification ne parte sans confirmation. La planche `Design System / 05 Feedback` de `design/personalos.lib.pen` en donne les briques, et l'écran « Motifs transverses » (`design/captures/ecrans/motifs-transverses-1424.png`, frame `C6sbOX`) leur composition : bandeau de préremplissage, erreurs de champ, dialogue de clôture, choix de portée d'une occurrence, états chargement, vide et erreur. Ce ticket en fait des composants, pour qu'un agent compose un écran au lieu de l'inventer.

## État actuel du code

- `packages/dashboard/src/app/formulaire.ts` (SOCLE-4) : `prefillDepuisRequete`, `erreursDeChamp`.
- Après UI-5 et UI-6 : `HlmButton`, `HlmInput`, `form-field`, `HlmBadge`, `HlmCard` restylés ; projet `dccm` et Storybook.
- Masters : `Banner` (`L9HFJ`), `Toast` (`bESqe`), `Modal` (`CX7L8`), `EmptyState` (`QLVDE`), `Skeleton` (`kNtnJ`).

## À faire

Briques de la planche Feedback, avec leurs stories (catégorie `Feedback`) :

| Master pen.dev | Implémentation Angular |
| --- | --- |
| `Banner` | spartan `alert` (générateur) restylé : `tone` `info`, `success`, `warning`, `error`, icône, titre, badge, message, actions secondaire et principale |
| `Toast` | spartan `sonner` (générateur) restylé : `success`, `error`, `neutral`, action en icône |
| `Modal` | spartan `alert-dialog` et `dialog` (générateur) restylés : titre, sous-titre, contenu projeté, actions, variante destructive ; `surface-container-high`, bordure `outline-variant`, ombre de popover |
| `EmptyState` | `DccmEmptyState` : variantes `empty` et `error`, icône 32, titre `title-sm`, description `body-dense`, une action principale |
| `Skeleton` | spartan `skeleton` (générateur) restylé : os `surface-container-highest` avec scintillement |

Motifs d'écran, avec leurs stories (catégorie `Patterns`) :

- `DccmFormPage` : trois présentations, `page` (défaut), `panel` (panneau à droite d'une liste, comme le formulaire de `calendrier-1424.png`) et `sheet` (panneau qui monte du bas, comme `calendrier-390.png`) ; la route du formulaire reste la même quelle que soit la présentation. En tête, `DccmPageHeader` (ou titre et bouton de fermeture en `panel` et `sheet`), bandeau « Certaines valeurs du lien n'ont pas été reprises : … » (`Banner` `warning`, paramètres ignorés par `prefillDepuisRequete`), zone de formulaire projetée, actions « Annuler » / action principale ; l'action principale est en `loading` pendant l'envoi.
- Erreurs de champ : `form-field` affiche l'erreur que `erreursDeChamp` tire du `fields` de l'API ; un 422 sans `fields` s'affiche dans un `Banner` `error` avec le `message` de l'API.
- `DccmConfirm` : service qui ouvre l'`alert-dialog` et renvoie le choix. Deux formes :
  - confirmation simple (« Clôturer la liste de courses ? », action principale nommée par le verbe, variante destructive pour une suppression) ;
  - choix de portée (« Cette occurrence uniquement » / « Toute la série », chaque option avec sa description), pour AGENDA-2.
- `DccmState` : `loading` (squelette à la forme du contenu attendu), `empty` (`DccmEmptyState` + action), `error` (`message` de l'API + « Réessayer »).
- Tests jest : `DccmFormPage` affiche les paramètres ignorés et désactive l'envoi en cours ; `DccmConfirm` renvoie le choix et `null` à l'annulation ; le dialogue piège le focus et rend le focus au déclencheur à la fermeture ; `DccmState` affiche le `message` de l'API.
- Section « Composer un écran » dans `docs/design-system.md` : liste, formulaire, détail ; l'URL de chaque formulaire et ses paramètres de préremplissage ; ce qui exige `DccmConfirm`.

## Décisions déjà prises

- Une transition métier (clôturer, arrêter, déclarer, publier, fusionner) passe toujours par `DccmConfirm` ; une création ou une modification simple non.
- Le choix de portée n'a pas d'option par défaut : l'utilisateur choisit toujours (AGENDA-2).
- Un `Toast` confirme une action réussie ; une erreur qui empêche d'avancer est un `Banner` ou une erreur de champ, jamais un `Toast` seul.
- Les textes de la maquette (SQLite, « HTTP 422 » affiché, ECONNREFUSED) ne sont pas repris : l'écran affiche le `message` de l'API (ADR 0030).

## Critères d'acceptation

- [ ] Les briques et les motifs ont leurs stories ; l'addon a11y ne signale aucune violation.
- [ ] Un formulaire composé avec `DccmFormPage` affiche les erreurs de champ renvoyées par l'API et les valeurs non reprises du lien.
- [ ] Le rendu correspond à l'écran « Motifs transverses ».
- [ ] La documentation « Composer un écran » existe.

## Vérification

- `pnpm exec nx affected -t lint test build --base=origin/develop` ; `pnpm exec nx run dccm:build-storybook`.
- Captures des stories jointes à la PR, à côté de `motifs-transverses-1424.png`.

## Pour la prod

Rien.

## Hors périmètre

- La migration des écrans existants : UI-4.

## Dépendances

- UI-5.
- UI-6.
- SOCLE-4.
