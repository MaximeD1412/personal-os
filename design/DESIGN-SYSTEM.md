# Design System — Sovereign Personal Cockpit (DCCM Personal OS)

Bibliothèque de composants pen.dev, prête pour une implémentation SvelteKit (Svelte 5, TypeScript) + Storybook.
Fichiers : `untitled.pen` (source), `design-system.json` (registre machine : ids des masters, parties surchargeables, slots, tokens), `DESIGN.md` (règles graphiques), sauvegarde `untitled.backup-2026-10-17-before-design-system.pen`.

## 0. Bibliothèque native `personalos.lib.pen`

Les 48 masters, leurs galeries et les 59 variables vivent dans `personalos.lib.pen`, une Design Library pen.dev indépendante des maquettes. `personalos.pen` la déclare :

```json
"imports": { "lib": "./personalos.lib.pen" }
```

Dans un document qui importe la bibliothèque, chaque nœud de la bibliothèque est adressé avec le préfixe de l'alias :
- instance : `{ "type": "ref", "ref": "lib:fm2Pg" }` (Button/Primary) ;
- override d'enfant : `descendants: { "lib:M0E3f8": { content: "Enregistrer" } }` ;
- override dans une instance imbriquée : `"lib:GUDs0/lib:RI99f"` (item Agenda de la Sidebar → icône) ;
- slot recommandé : `slot: ["lib:AsJMu"]`.

Pour réutiliser la bibliothèque dans un autre fichier `.pen` : ajouter la même clé `imports` (chemin relatif vers `personalos.lib.pen`) ou passer par le panneau Libraries de pen.dev (« Add library »), puis insérer des `ref` en `lib:<id>`. Les ids des masters sont ceux listés dans `design-system.json`.

## 1. Organisation dans pen.dev

Sept boards de 1424 px, nommés `Design System / 00 Foundations` à `06 Layout`, placés au-dessus des écrans. Chaque board contient :
- une section **Masters** (les composants réutilisables, `reusable: true`) ;
- des sections **Galerie** montrant variantes, tailles, tonalités et états sous forme d'instances surchargées (équivalent Storybook).

| Board | Masters |
|---|---|
| 00 Foundations | Aucun master. Nuanciers des 59 variables, pistes teintées, échelle typographique, espacements, rayons, tailles d'icônes, élévation. |
| 01 Actions | Button/Primary, Button/Secondary, Button/Ghost, Button/Destructive, Button/Icon, Button/Link, KeyboardHint |
| 02 Forms | Input, FormField, Checkbox, Switch, Stepper, SegmentedControl, Tab/Active, Tab/Inactive |
| 03 Data Display | Badge, Tag, Avatar, ProgressBar, Divider, CardTitle, CardHeader, Card, KpiTile, SectionHeader, ListRow, Table/HeaderCell, Table/Cell |
| 04 Navigation | NavItem, Sidebar, RailItem, Rail, TopBar, TabBarItem, MobileTabBar, MobileHeader, Breadcrumb/Item, Breadcrumb/Separator, Breadcrumb, PageHeader |
| 05 Feedback | Banner, Toast, Modal, EmptyState, Skeleton |
| 06 Layout | AppShell/Desktop, AppShell/Tablet, AppShell/Mobile |

Total : 48 masters. Les écrans ne contiennent plus que des instances (`ref`) de ces masters pour les éléments mutualisés.

## 2. Conventions

- **Nommage** : PascalCase, variante après `/` (`Button/Primary`, `Tab/Active`, `AppShell/Mobile`). Nom Svelte = nom du master sans la variante (`Button` avec prop `variant`).
- **Taille et tonalité = presets d'overrides**, pas des masters séparés. Exemple bouton `sm` : `padding [6,12]`, `Label.fontSize 12`, `Icon 16`. Exemple badge `success` : `fill #00a57233`, `Label.fill $secondary`, `Dot.fill $secondary`.
- **Parties nommées** : chaque enfant surchargeable a un nom stable (`Icon`, `Label`, `TrailingIcon`, `Dot`, `Value`, `Meta`, `Trailing`, `Content`, `Footer`…). Les ids figurent dans `design-system.json`.
- **Chemins d'override** : `instance/enfant` pour un enfant direct, `instance/instanceImbriquée/enfant` pour un composant imbriqué (ex. item actif de la sidebar : `sidebarInst/GUDs0` fond `#adc6ff33`, `sidebarInst/GUDs0/RI99f` fill `$primary`, `sidebarInst/GUDs0/QMBGA` fill `$primary` + 600).
- **Slots** : frames portant la propriété `slot` (`CardHeader/Trailing`, `Card/Content`, `Card/Footer`, `SectionHeader/Trailing`, `ListRow/Trailing`, `Modal/Content`, `PageHeader/Actions`, `AppShell/*/Main`, `Table/Cell`). On y insère des instances ou on remplace le slot par un sous-arbre complet.
- **Tokens** : toutes les couleurs sont des variables `$…` (frontmatter de DESIGN.md). Seules exceptions : les huit pistes alpha listées dans Foundations. Polices : `$font-body` (Inter), `$font-mono` (JetBrains Mono), icônes Material Symbols Outlined en 16/18/20/24/32.
- **États** : documentés dans les galeries (default, hover, focus-visible, pressed, disabled, loading, selected, checked, error). Les règles sont dans DESIGN.md > Interactive states.

## 3. Catalogue des composants

Format : **Nom Svelte** (master pen.dev) — props — variantes / états — slots — dépendances — tokens.

### Actions
- **Button** (`Button/Primary`, `Button/Secondary`, `Button/Ghost`, `Button/Destructive`) — `variant`, `size: sm|md|lg`, `label`, `icon`, `trailingIcon`, `disabled`, `loading`, `fullWidth` — états default/hover/focus/pressed/disabled/loading ; contenu texte seul (`Icon.enabled=false`), icône + texte, icône + texte + icône de fin — tokens primary/on-primary/primary-fixed/primary-container, surface-container-high/highest, on-surface, error/error-container, radius 8.
- **IconButton** (`Button/Icon`) — `icon`, `size: 36|44`, `filled`, `ariaLabel` — tokens on-surface-variant, surface-container-high.
- **LinkButton** (`Button/Link`) — `label`, `icon`, `href` — token primary.
- **Kbd** (`KeyboardHint`) — `keys` — tokens surface-container-lowest, outline, radius 4.

### Forms
- **Input** (`Input`) — `value`, `placeholder`, `leadingIcon`, `trailingIcon`, `shortcut`, `invalid`, `disabled`, `type: text|search|select` — états default/focus/filled/error/disabled — dépend de Kbd — tokens surface-container-lowest, surface-container-highest, outline, on-surface, primary, error.
- **FormField** (`FormField`) — `label`, `helper`, `error` — slot par défaut = Input — dépend de Input.
- **Checkbox** (`Checkbox`) — `checked`, `disabled` — états unchecked/checked/focus/disabled — tokens surface-container-lowest, outline-variant, primary, on-primary.
- **Switch** (`Switch`) — `checked`, `disabled` — tokens primary, on-primary, surface-container-highest, outline.
- **Stepper** (`Stepper`) — `value`, `unit`, `min`, `max`, `size: 28|36` — dépend de IconButton.
- **SegmentedControl** (`SegmentedControl` + `Tab/Active`, `Tab/Inactive`) — `items[{label, icon?}]`, `value`, `size` — actif = primary 20 % + texte primary — tokens surface-container-lowest/low, primary, on-surface-variant.

### Data Display
- **Badge** (`Badge`) — `label`, `tone: info|success|warning|error|neutral`, `dot`, `icon`, `counter` — capsule 22 px — tokens primary/secondary/tertiary/error + tints.
- **Tag** (`Tag`) — `label`, `icon`, `accent` — rayon 4 — tokens surface-container-high/highest, on-surface-variant, primary.
- **Avatar** (`Avatar`) — `icon` ou `initials`, `size: 24|32|40`, `tone` — tokens primary/on-primary, secondary-container, surface-container-high.
- **ProgressBar** (`ProgressBar`) — `value 0..100` (largeur de `Fill`), `tone`, `thickness: 4|6` — tokens surface-container-highest + accent.
- **Divider** (`Divider`) — token surface-container-high.
- **CardTitle** (`CardTitle`) — `icon`, `title`, `iconTone` — icône 20 + title-sm.
- **CardHeader** (`CardHeader`) — `icon`, `title` — slot `trailing` (Badge, LinkButton, IconButton) — dépend de CardTitle, Badge.
- **Card** (`Card`) — `icon`, `title`, `meta`, `footerLink`, `nested` — slots `header`, `content`, `footer` — dépend de CardHeader, LinkButton — tokens surface-container, surface-container-highest (bordure), surface-container-high (imbriqué), radius 12, padding 16.
- **KpiTile** (`KpiTile`) — `icon`, `eyebrow`, `value`, `meta`, `status`, `link`, `tone`, `href` — tokens telemetry-metric, outline, primary.
- **SectionHeader** (`SectionHeader`) — `title`, `description` — slot `trailing` — headline-md.
- **ListRow** (`ListRow`) — `title`, `meta`, `checkable`, `checked`, `selected`, `chevron` — états default/hover/checked/selected — slot `trailing` — dépend de Checkbox, Badge.
- **TableHeaderCell / TableCell** (`Table/HeaderCell`, `Table/Cell`) — `label` / slot de contenu, `width` — label-micro / body-dense.

### Navigation
- **NavItem** (`NavItem`) — `icon`, `label`, `active`, `comingSoon`, `href` — états default/hover/active/focus/disabled — dépend de Badge.
- **Sidebar** (`Sidebar`) — `activeKey`, `groups`, `nodeStatus` — composée de 18 instances NavItem (ids dans le JSON) ; l'item actif est un override d'instance par page.
- **RailItem / Rail** (`RailItem`, `Rail`) — rail 72 px, icône 20, item actif par override.
- **TopBar** (`TopBar`) — `brand`, `environment`, `searchPlaceholder`, `user` — internes conservés tels qu'importés (recherche = bouton 576 px, à surcharger à 320 px en tablette).
- **TabBarItem / MobileTabBar** (`TabBarItem`, `MobileTabBar`) — `activeKey: Accueil|Agenda|Sport|Repas|Plus` — 5 instances TabBarItem, actif par override.
- **MobileHeader** (`MobileHeader`) — `brand`, `nodeStatus`, `showCommand` — dépend de IconButton, Tag, Badge, Avatar.
- **BreadcrumbItem / BreadcrumbSeparator / Breadcrumb** — `items[]`, `current` — label-micro, séparateur chevron 14.
- **PageHeader** (`PageHeader`) — `breadcrumb`, `title`, `subtitle` — slot `actions` — dépend de Breadcrumb, Button.

### Feedback
- **Banner** (`Banner`) — `tone: info|success|warning|error`, `icon`, `title`, `badge`, `message`, `secondaryLabel`, `primaryLabel` — dépend de Badge, Button.
- **Toast** (`Toast`) — `tone: success|error|neutral`, `icon`, `message`, `actionIcon`.
- **Modal** (`Modal`) — `title`, `subtitle`, `confirmLabel`, `cancelLabel`, `destructive` — slot `content` — dépend de IconButton, Button.
- **EmptyState** (`EmptyState`) — `variant: empty|error`, `icon`, `title`, `description`, `actionLabel` — dépend de Button.
- **Skeleton** (`Skeleton`) — `lines`, `widths`.

### Layout
- **AppShell** (`AppShell/Desktop`, `AppShell/Tablet`, `AppShell/Mobile`) — slot `main` — compose TopBar + Sidebar (1424 / sidebar 240), TopBar + Rail (1024 / rail 72), MobileHeader + MobileTabBar (390). Grille : marge 24 / gutter 16 desktop, marge 16 / gutter 12 mobile.

## 4. Instances dans les écrans (après remplacement)

| Master | Instances | Master | Instances |
|---|---|---|---|
| Badge | 309 | Tag | 195 |
| Button/Primary | 57 | Breadcrumb/Item | 36 |
| Tab/Inactive + Tab/Active | 29 + 9 | Avatar | 23 |
| NavItem | 23 | KeyboardHint | 21 |
| RailItem | 21 | KpiTile | 18 |
| CardTitle | 17 | TopBar | 16 |
| Sidebar | 15 | Button/Secondary | 15 |
| MobileTabBar | 13 | Button/Ghost · Destructive | 12 · 12 |
| Checkbox | 11 | Input | 8 |
| Button/Icon · TabBarItem | 8 · 8 | Banner · ProgressBar · ListRow | 5 · 5 · 5 |

Le rendu des écrans est inchangé, à une exception près : les six tuiles KPI de l'Accueil (desktop et tablette) prennent le style carte de DESIGN.md (fond surface-container, bordure 1 px, padding 16) au lieu du fond surface-container-low / padding 12 hérité de Stitch.

## 5. Éléments non mutualisés (et pourquoi)

- **TopBar** : internes conservés en frames importées (recherche, switch d'environnement, bloc utilisateur). Refactor possible en Input + SegmentedControl + Avatar sans impact visuel.
- **En-têtes mobiles des 13 écrans** : structures différentes page par page ; le master MobileHeader sert pour les nouveaux écrans.
- **Champs de recherche / filtres dans les écrans** : non échangés pour éviter un décalage de rendu ; le master Input est la référence.
- **Tableaux Stock et Recettes** : cellules hétérogènes ; Table/HeaderCell et Table/Cell donnent la base.
- **Cartes métier** (événements agenda, cases du calendrier, cartes repas, recettes avec image, projets, séances sport) : spécifiques à chaque pilier ; candidats à des composants de domaine (`EventCard`, `MealCard`, `RecipeCard`, `WorkoutCard`) à définir côté SvelteKit à partir de Card + CardHeader + Badge.
- **Barres de progression, steppers et switch** dans les écrans : masters disponibles, instances non échangées (structures légèrement différentes).
- **Pages de documentation** (storybook, tokens, motifs transverses) et **portfolio public** : hors périmètre produit.

## 6. Lecture par un agent via MCP

1. `get_app_state` liste les 48 masters. 2. `design-system.json` donne, pour chaque master, l'id, les parties surchargeables et les slots. 3. `Get(masterId)` retourne le sous-arbre avec toutes les valeurs tokenisées. 4. `Get(instanceId, {resolveInstances: true})` expose une instance résolue avec ses overrides. 5. Les galeries des boards 01 à 05 montrent les états à reproduire dans les stories.
