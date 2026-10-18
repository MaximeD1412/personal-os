---
id: UI-5
title: "Design system : actions et formulaires (Button, Input, FormField, Checkbox, Switch, Stepper, SegmentedControl)"
epic: UI
type: feature
priority: P0
size: M
milestone: M1 UI
blocked_by: [UI-1]
adr: [0029]
risques: [AG-2, AG-4]
revue_visuelle: true
---

## Contexte

Les planches `Design System / 01 Actions` et `02 Forms` de `design/personalos.lib.pen` définissent les contrôles de saisie et d'action de toute l'application. Ce ticket les implémente en Angular, avec leurs stories. UI-2 (coque), UI-3 (formulaires, confirmation) et tous les écrans en dépendent.

## État actuel du code

- Après UI-1 : jetons pen dans `packages/theme/tokens.css`, Material Symbols, projet `dccm` (`packages/ui/dccm`), Storybook (`dccm:storybook`), `docs/design-system.md` et sa table de correspondance.
- `packages/ui/button` (`HlmButton`, variantes shadcn `default|outline|secondary|ghost|destructive|link`, tailles `default|xs|sm|lg|icon*`), `packages/ui/input`, `packages/ui/label`, `packages/ui/select` : générés par spartan, styles shadcn.
- Spécifications : `design/DESIGN.md` (Buttons, Inputs & search, Checkboxes, Tabs & segmented controls, Interactive states), `design/DESIGN-SYSTEM.md` (Actions, Forms), `design/design-system.json > components` (props, presets de taille, parties). Galeries d'états : `design/captures/ecrans/etats-interactifs-1424.png`.

## À faire

Implémenter chaque master, avec une story par composant (contrôles interactifs, toutes les variantes, états default, hover, focus-visible, pressed, disabled, plus loading, error et checked quand ils existent), sous les catégories `Actions` et `Forms` :

| Master pen.dev | Implémentation Angular |
| --- | --- |
| `Button/Primary`, `Button/Secondary`, `Button/Ghost`, `Button/Destructive` | `HlmButton` restylé : `variant` `primary` (défaut), `secondary`, `ghost`, `destructive` ; `size` `sm` (28), `md` (36, défaut), `lg` (40) ; icône de tête et de fin ; `loading` (indicateur, désactive le bouton) ; `fullWidth` |
| `Button/Icon` | `HlmButton` `size` `icon` (36) et `icon-lg` (44), `aria-label` obligatoire |
| `Button/Link` | `HlmButton` `variant="link"` |
| `KeyboardHint` | `DccmKbd` (`packages/ui/dccm/kbd`) |
| `Input` | `HlmInput` restylé : icône de tête et de fin, raccourci (`DccmKbd`), états focus, filled, error (`aria-invalid`), disabled ; tailles 36 et 40 |
| `FormField` | spartan `form-field` (générateur), restylé : libellé, aide, erreur |
| `Checkbox` | spartan `checkbox` (générateur), restylé : 18 px, rayon 4 |
| `Switch` | spartan `switch` (générateur), restylé |
| `Stepper` | `DccmStepper` (`packages/ui/dccm/stepper`) : valeur, unité, `min`, `max`, tailles 28 et 36, compose `HlmButton` icône ; compatible formulaires réactifs (`ControlValueAccessor`) |
| `SegmentedControl`, `Tab/Active`, `Tab/Inactive` | spartan `toggle-group` (générateur) restylé en un seul composant : choix unique, segment actif en `primary-20` et texte `primary` |
| (pas de master) `Label`, `Select` | `HlmLabel`, `HlmSelect` restylés aux jetons (le Select suit l'apparence de `Input`) |

- Lire chaque master dans `personalos.lib.pen` (id dans `design-system.json`) : dimensions, rayons, couleurs et typographies viennent de là, pas d'une estimation.
- Retirer les variantes shadcn qui n'ont pas d'équivalent pen (`outline`, `xs`, `icon-xs`, `icon-sm`) et migrer leurs usages dans `packages/dashboard` et `packages/portfolio` vers la variante pen la plus proche (`outline` → `secondary`).
- Tests jest des comportements : `loading` désactive le bouton ; `DccmStepper` respecte `min` et `max` et écrit dans un `FormControl` ; le toggle-group n'a qu'un segment actif et se pilote au clavier.
- Compléter la table de correspondance de `docs/design-system.md`.

## Décisions déjà prises

- Un master qui a un équivalent spartan/ui passe par `nx g @spartan-ng/cli:ui <nom>` puis un restylage aux jetons ; il ne devient pas un composant `Dccm`. Les autres composants vivent dans `packages/ui/dccm/<nom>`.
- Plusieurs masters peuvent n'être qu'un composant avec une propriété (`Button/*` → `variant`, `Tab/*` → état du segment).
- Survol : un cran plus haut dans la rampe ou bordure `outline-variant`. Focus visible : anneau 2 px `primary-20` plus bordure `primary`, jamais retiré. Pressé : `scale(0.98)`. Désactivé : opacité 40 %, `cursor: not-allowed` (`DESIGN.md > Interactive states`).
- Cibles tactiles : 36 × 36 minimum sur mobile, 44 × 44 de préférence.
- `primary-container` n'est jamais le fond d'un bouton texte.

## Critères d'acceptation

- [ ] Chaque master de la table a sa story, avec contrôles et états, et son rendu correspond au master pen.dev (dimensions, couleurs, typographie, rayon).
- [ ] L'addon a11y ne signale aucune violation sur ces stories.
- [ ] Aucune couleur, taille de police ni rayon en dur dans les composants touchés.
- [ ] Les écrans existants compilent et leurs tests passent après la migration des variantes.

## Vérification

- `pnpm exec nx affected -t lint test build --base=origin/develop` ; `pnpm exec nx run dccm:build-storybook`.
- Captures des stories (boutons, champ en erreur, toggle-group) jointes à la PR, à côté de `etats-interactifs-1424.png`.

## Pour la prod

Rien.

## Hors périmètre

- Badge, Tag, Card, ListRow et l'affichage de données : UI-6.
- Le formulaire de page, le bandeau de préremplissage et la confirmation : UI-3.

## Dépendances

- UI-1.
