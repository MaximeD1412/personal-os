# Le design system

À lire avant de toucher un écran ou un composant. Le design de Personal OS est
fait dans pen.dev (`design/`) ; ce document dit comment il se traduit en
Angular, Tailwind v4 et spartan/ui ([ADR 0029](adr/0029-tailwind-et-spartan-ui-sans-preprocesseur.md)),
où vit chaque morceau, et ce que la traduction a déjà tranché.

## Les références

Dans cet ordre de priorité, en cas de contradiction (epic UI, #55) :

1. `design/personalos.lib.pen` : la bibliothèque (48 masters, 59 variables),
   source de vérité visuelle. C'est un JSON lisible : `variables` porte les
   jetons, chaque master a `reusable: true`.
2. `design/DESIGN.md` : règles graphiques et jetons (frontmatter).
3. `design/DESIGN-SYSTEM.md` : définition fonctionnelle des composants
   (props, variantes, slots).
4. `design/design-system.json` : ids pen.dev des masters et de leurs parties.
5. `design/personalos.pen` et ses exports `design/captures/ecrans/*.png` :
   composition des écrans.

`design/` est en **lecture seule**. Ses documents visent SvelteKit et Svelte :
lire Angular et spartan/ui. Quand un document et le `.pen` divergent, le `.pen`
gagne ; les écarts connus sont dans l'[audit](#audit) plus bas. Le MCP pen.dev
n'est pas requis : le JSON et les captures suffisent, et s'il est disponible il
sert à vérifier une valeur.

## Où vivent les choses

| Quoi                                                                                    | Où                                                                                                                      |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Les jetons (couleurs, pistes teintées, espacements, rayons, typographie, icônes, ombre) | `packages/theme/tokens.css`, vérifié contre la bibliothèque par `nx test theme`                                         |
| Les polices (Inter, JetBrains Mono)                                                     | `@fontsource-variable/*`, chargées par le tableau `styles` de chaque application et de Storybook                        |
| Les icônes                                                                              | `@ng-icons/material-symbols/outline` (Material Symbols Outlined)                                                        |
| Un composant qui a un équivalent spartan                                                | `packages/ui/<nom>` (`@personal-os/ui/<nom>`, préfixe `hlm`), un projet Nx par composant                                |
| Un composant sans équivalent spartan                                                    | `packages/ui/dccm/src/<nom>/` (`@personal-os/ui/dccm`, préfixe `dccm`), exporté par `src/index.ts`                      |
| Les stories                                                                             | à côté du composant, `*.stories.ts` sous `packages/ui/`                                                                 |
| Les tests d'un composant                                                                | `*.spec.ts` à côté de lui (étape 5 de « Ajouter un composant »)                                                         |
| Storybook                                                                               | porté par le projet `dccm` : `nx run dccm:storybook` (port 4400), `nx run dccm:build-storybook` (`dist/storybook/dccm`) |

Storybook charge les polices puis `packages/dashboard/src/styles.css` : il voit
exactement les jetons de l'application. Il a les addons docs (une page
`Documentation` par composant, ses entrées lues par compodoc), controls et a11y.
Les catégories, dans l'ordre des planches pen.dev : `Foundations`, `Actions`,
`Forms`, `Data Display`, `Navigation`, `Feedback`, `Layout`. Le titre d'une
story est `<Catégorie>/<Composant>` (`Actions/Button`).

Le cache de `build-storybook` suit ce qu'il affiche : `dccm` dépend
implicitement de `theme` et de tous les projets de `packages/ui`, et la feuille
du tableau de bord est une de ses entrées. Un nouveau projet sous `packages/ui`
y entre sans rien déclarer ; une autre feuille chargée par Storybook s'ajoute à
ses `inputs` (`nx test theme` le vérifie).

## Les règles

- **La maquette donne l'apparence, le ticket donne le périmètre.** Un élément
  de maquette absent du ticket n'est pas implémenté. Les textes des maquettes
  (SQLite, « Nœud DCCM v4.8 », montants, noms) sont du remplissage, pas des
  specs.
- **Les noms des jetons sont ceux de pen.dev.** Quand un nom shadcn a un autre
  sens, le sens pen gagne : `--secondary` est le vert de validation, pas un gris
  neutre. Les composants spartan sont restylés en conséquence (UI-5, UI-6) ; on
  ne garde pas leurs classes shadcn.
- **Un écran n'écrit jamais de couleur, de taille de police ni de rayon en
  dur** : il passe par les jetons. Les seules valeurs alpha permises sont les
  pistes teintées (`bg-primary-20`, pas `bg-primary/20`).
- **Sombre seul.** `tokens.css` pose `color-scheme: dark` sur `:root` ; il n'y
  a ni thème clair ni classe `dark` (la variante `dark:` de spartan ne
  s'applique donc jamais). Un futur thème redéfinira les jetons de couleur sous
  `:root[data-theme="…"]`.
- **Rien depuis un CDN** : polices et icônes sont servies par l'application (le
  portfolio vise Lighthouse ≥ 95, PORTFOLIO-6).
- **Une seule bibliothèque d'icônes**, Material Symbols Outlined
  (`mat<Nom>Outline`, par exemple `matKeyboardArrowDownOutline` pour
  `keyboard_arrow_down`). Le générateur spartan pose des icônes lucide :
  remplace-les à la génération. La taille passe par une classe `icon-*`, jamais
  par l'entrée `size` en pixels.
- **Les chiffres d'une carte, d'une métrique ou d'un horaire sont tabulaires** :
  `tabular-nums`.

### Les classes d'un composant

Les composants composent leurs classes par `hlm()` et `classes()`
(`@personal-os/ui/utils`), qui passent par tailwind-merge : de deux classes
du même groupe, la dernière gagne. Deux pièges, couverts par
`nx test utils` et `nx test button` :

- tailwind-merge ne connaît que les noms de Tailwind. `hlm.ts` lui déclare
  l'échelle typographique, les espacements et les tailles d'icône ; un
  nouveau `--text-<niveau>`, `--spacing-<nom>` ou `--icon-<taille>` s'y
  ajoute (le test relit `tokens.css`). Sans cela, `text-body-dense` passe pour une couleur et
  disparaît devant `text-on-surface`.
- `classes()` dédoublonne en gardant la **première** occurrence d'une classe.
  Une classe répétée d'une partie à l'autre d'un `cva` (la base et une
  variante composée) garde donc sa place de base, et perd devant la variante
  qu'elle devait remplacer. Une classe ne s'écrit qu'une fois par `cva`.

Les états suivent `DESIGN.md > Interactive states` : survol un cran plus haut
dans la rampe (ou bordure `outline-variant` pour un champ), focus visible
anneau 2 px `primary-20` et bordure `primary`, pressé `scale-98`, désactivé
`opacity-40` et `cursor-not-allowed`. Le désactivé d'un bouton se lit sur
`data-[disabled]` (le variant `data-disabled:` du preset spartan est en
`:where()`, sans spécificité, et ne se nie pas avec `not-`).
Un contrôle plus petit que 36 × 36 (case 18 px, interrupteur 36 × 20)
garde sa taille visuelle et étend sa cible tactile par un `::after` de
36 × 36 centré. Un clic sur un bouton désactivé ou en chargement est arrêté
en capture, avant les `(click)` du template.

### Les alias de spartan

Les composants spartan lisent des jetons shadcn. `tokens.css` les redirige vers
les jetons pen :

| Alias spartan                                                                      | Jeton pen                                   |
| ---------------------------------------------------------------------------------- | ------------------------------------------- |
| `--background`                                                                     | `--surface`                                 |
| `--foreground`, `--card-foreground`, `--popover-foreground`, `--accent-foreground` | `--on-surface`                              |
| `--card`                                                                           | `--surface-container`                       |
| `--popover`, `--muted`, `--accent`                                                 | `--surface-container-high`                  |
| `--primary-foreground`                                                             | `--on-primary`                              |
| `--secondary-foreground`                                                           | `--on-secondary`                            |
| `--muted-foreground`                                                               | `--outline`                                 |
| `--destructive`                                                                    | `--error`                                   |
| `--border`, `--input`, `--sidebar-border`                                          | `--surface-container-highest`               |
| `--ring`, `--sidebar-primary`, `--sidebar-ring`                                    | `--primary`                                 |
| `--sidebar`                                                                        | `--surface-container-lowest`                |
| `--sidebar-foreground`                                                             | `--on-surface-variant`                      |
| `--sidebar-primary-foreground`                                                     | `--on-primary`                              |
| `--sidebar-accent`                                                                 | `--primary-20` (l'item actif de la Sidebar) |
| `--sidebar-accent-foreground`                                                      | `--primary`                                 |
| `--font-sans`                                                                      | `--font-body`                               |

Un composant restylé écrit les classes pen (`bg-surface-container`), pas les
alias (`bg-card`) : les alias ne servent qu'aux composants tels que le
générateur les pose.

### Des jetons aux classes Tailwind

| Jeton                                                                                    | Classes                                                             | Exemple                                                                                         |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Couleur `--<nom>` (43)                                                                   | `bg-`, `text-`, `border-`, `ring-`, `fill-`… `<nom>`                | `bg-surface-container`, `text-on-surface-variant`, `border-outline-variant`                     |
| Piste teintée `--<couleur>-<alpha>` (8, plus 2 hors Foundations)                         | idem                                                                | `bg-primary-20`, `bg-error-20`, `border-error-stroke-30`                                        |
| Espacement `--space-*`, `--gutter`, `--gutter-compact`, `--margin`, `--margin-mobile`    | `p-`, `m-`, `gap-`, `w-`… `<nom>`                                   | `p-space-md`, `gap-gutter`, `px-margin`                                                         |
| Rayon `--radius-sm` 4, `--radius` 8, `--radius-md` 12, `--radius-lg` 16, `--radius-full` | `rounded-sm`, `rounded`, `rounded-md`, `rounded-lg`, `rounded-full` | tag `rounded-sm`, bouton `rounded`, carte `rounded-md`                                          |
| Typographie `--text-<niveau>` (11)                                                       | `text-<niveau>` : taille, interligne, graisse et approche           | `text-headline-lg`, `text-body-dense`, `text-label-micro uppercase`, `text-code-mono font-mono` |
| Police `--font-body`, `--font-mono`                                                      | `font-body` (par défaut sur `body`), `font-mono`                    |                                                                                                 |
| Icône `--icon-2xs` 14, `-xs` 16, `-sm` 18, `-md` 20, `-lg` 24, `-xl` 32                  | `icon-2xs` … `icon-xl` sur `ng-icon`                                | `<ng-icon name="matCheckOutline" class="icon-sm" />`                                            |
| Ombre `--shadow-popover`, `--shadow-top-bar`                                             | `shadow-popover`, `shadow-top-bar`                                  | modale, popover ; la `TopBar`                                                                   |

Les rayons `rounded-xl` à `rounded-4xl` restent ceux du preset spartan, dérivés
de `--radius` : ils n'existent pas dans la bibliothèque, un écran ne s'en sert
pas. Les tailles d'icône : 14 dans les liens, les segments et la case cochée
(hors Foundations, mais employée par les masters) ; 16 dans les badges, tags, fils d'Ariane et tableaux
denses ; 18 dans la navigation, les listes et les boutons ; 20 dans les
en-têtes de carte et les tuiles KPI ; 24 dans la barre d'onglets mobile et les
actions de page ; 32 dans les états vides et d'erreur.

## Ajouter un composant

1. **Trouver son master** dans la table ci-dessous et dans
   `design/design-system.json` (id, parties, slots), puis ses galeries d'états
   dans la planche de sa catégorie (`personalos.lib.pen`).
2. **Le générateur spartan d'abord** : s'il existe un composant spartan
   équivalent, `nx g @spartan-ng/cli:ui <nom>` le pose dans `packages/ui/<nom>`.
   Remplace ses icônes lucide par Material Symbols, puis restyle-le aux jetons
   pen, variantes et tailles comprises, d'après le master.
3. **Sinon `dccm`** : un dossier `packages/ui/dccm/src/<nom>/`, une classe
   `Dccm<Nom>` au sélecteur `dccm-<nom>`, exportée par
   `packages/ui/dccm/src/index.ts`.
4. **Une story par composant** (`<nom>.stories.ts`, titre
   `<Catégorie>/<Composant>`), avec les variantes, tailles et états des
   galeries pen.dev, des contrôles pour ses entrées, et l'addon a11y sans
   violation. Survol, focus et pression se forcent par le paramètre `pseudo`
   (`storybook-addon-pseudo-states`) sur un sélecteur de la story
   (`pseudo: { hover: '[data-etat=hover]' }`). Le `tsconfig.lib.json` du
   projet exclut `**/*.stories.ts`.
5. **Ses comportements en jest**, à côté du composant (`nx test <projet>` ; un
   projet de `packages/ui` qui n'a pas encore de tests reçoit le
   `jest.config.cts` de `button`). Le composant s'ajoute à la liste de
   `packages/ui/dccm/src/design-system.spec.ts`, qui refuse couleur, taille
   de police et rayon en dur.
6. **Remplir sa ligne** dans la table ci-dessous, dans la PR du composant.
7. **Une valeur absente des jetons** (une piste alpha qu'un master emploie et
   que la Foundations ne liste pas, par exemple) s'ajoute à `tokens.css` sous un
   nom `<couleur>-<alpha>`, dans la PR du composant qui en a besoin, et l'écart
   se note dans l'audit ci-dessous.

## Masters et composants Angular

Une ligne par master de `personalos.lib.pen`. La colonne « Composant » se
remplit dans la PR qui l'implémente.

| Planche         | Master                 | Id       | Ticket      | Composant Angular                                                                                                    |
| --------------- | ---------------------- | -------- | ----------- | -------------------------------------------------------------------------------------------------------------------- |
| 01 Actions      | `Button/Primary`       | `fm2Pg`  | UI-5 (#106) | `HlmButton` (`@personal-os/ui/button`), `variant="primary"`, le défaut                                               |
| 01 Actions      | `Button/Secondary`     | `kSA0S`  | UI-5 (#106) | `HlmButton variant="secondary"`                                                                                      |
| 01 Actions      | `Button/Ghost`         | `skoX7`  | UI-5 (#106) | `HlmButton variant="ghost"`                                                                                          |
| 01 Actions      | `Button/Destructive`   | `YxFNj`  | UI-5 (#106) | `HlmButton variant="destructive"`                                                                                    |
| 01 Actions      | `Button/Icon`          | `XtxvG`  | UI-5 (#106) | `HlmButton size="icon"` (36) ou `"icon-lg"` (44) ; `ghost`, ou `secondary` pour le rempli ; `aria-label` obligatoire |
| 01 Actions      | `Button/Link`          | `AbBjI`  | UI-5 (#106) | `HlmButton variant="link"`                                                                                           |
| 01 Actions      | `KeyboardHint`         | `wUjrG`  | UI-5 (#106) | `HlmKbd` (`@personal-os/ui/kbd`)                                                                                     |
| 02 Forms        | `Input`                | `ALZVI`  | UI-5 (#106) | `HlmInput`, et `HlmInputGroup` pour les icônes et le raccourci (`@personal-os/ui/input`)                             |
| 02 Forms        | `FormField`            | `q3MAZQ` | UI-5 (#106) | `HlmField`, `HlmFieldLabel`, `HlmFieldDescription`, `HlmFieldError` (`@personal-os/ui/field`)                        |
| 02 Forms        | `Checkbox`             | `JwWQG`  | UI-5 (#106) | `HlmCheckbox` (`@personal-os/ui/checkbox`)                                                                           |
| 02 Forms        | `Switch`               | `S9hTL`  | UI-5 (#106) | `HlmSwitch` (`@personal-os/ui/switch`)                                                                               |
| 02 Forms        | `Stepper`              | `Ahi2D`  | UI-5 (#106) | `DccmStepper` (`@personal-os/ui/dccm`)                                                                               |
| 02 Forms        | `Tab/Active`           | `ms6qi`  | UI-5 (#106) | `HlmToggleGroupItem`, segment actif                                                                                  |
| 02 Forms        | `Tab/Inactive`         | `dsKE8`  | UI-5 (#106) | `HlmToggleGroupItem`, segment inactif                                                                                |
| 02 Forms        | `SegmentedControl`     | `ee30V`  | UI-5 (#106) | `HlmToggleGroup` (`@personal-os/ui/toggle-group`)                                                                    |
| 03 Data Display | `Badge`                | `AsJMu`  | UI-6 (#107) | `HlmBadge` (`@personal-os/ui/badge`), `variant="badge"` et `"counter"`                                               |
| 03 Data Display | `Tag`                  | `d6arwe` | UI-6 (#107) | `HlmBadge` `variant="tag"`                                                                                           |
| 03 Data Display | `Avatar`               | `qV14Y`  | UI-6 (#107) | `HlmAvatar`, `HlmAvatarFallback` (`@personal-os/ui/avatar`)                                                          |
| 03 Data Display | `ProgressBar`          | `phWRw`  | UI-6 (#107) | `HlmProgress`, `HlmProgressIndicator` (`@personal-os/ui/progress`)                                                   |
| 03 Data Display | `Divider`              | `n1yjU`  | UI-6 (#107) | `HlmSeparator` (`@personal-os/ui/separator`)                                                                         |
| 03 Data Display | `CardTitle`            | `JNiEe`  | UI-6 (#107) | `HlmCardTitle` (`@personal-os/ui/card`)                                                                              |
| 03 Data Display | `CardHeader`           | `t2Hdg8` | UI-6 (#107) | `HlmCardHeader`, `HlmCardAction`, `HlmCardDescription`                                                               |
| 03 Data Display | `SectionHeader`        | `xvhC6`  | UI-6 (#107) | `DccmSectionHeader` (`@personal-os/ui/dccm`)                                                                         |
| 03 Data Display | `Card`                 | `F9aBD`  | UI-6 (#107) | `HlmCard`, `HlmCardContent`, `HlmCardFooter`                                                                         |
| 03 Data Display | `KpiTile`              | `UmdUk`  | UI-6 (#107) | `DccmKpiTile` (`@personal-os/ui/dccm`)                                                                               |
| 03 Data Display | `Table/HeaderCell`     | `b4QLdx` | UI-6 (#107) | `HlmTh` (`th[hlmTableHead]`, `@personal-os/ui/table`)                                                                |
| 03 Data Display | `Table/Cell`           | `sUITn`  | UI-6 (#107) | `HlmTd` (`td[hlmTableCell]`), `HlmTable`, `HlmTr`…                                                                   |
| 03 Data Display | `ListRow`              | `DHctf`  | UI-6 (#107) | `DccmListRow` (`@personal-os/ui/dccm`)                                                                               |
| 04 Navigation   | `TopBar`               | `DVUUC`  | UI-2 (#60)  | `DccmTopBar` (`@personal-os/ui/dccm`), zone de recherche projetée `[dccmTopBarSearch]`                               |
| 04 Navigation   | `Sidebar`              | `EDbRo`  | UI-2 (#60)  | `DccmSidebar`, `variant="full"` (240 px)                                                                             |
| 04 Navigation   | `Rail`                 | `GfuO7`  | UI-2 (#60)  | `DccmSidebar variant="rail"` (72 px, libellés en infobulle `HlmTooltip`)                                             |
| 04 Navigation   | `MobileTabBar`         | `jFjwa`  | UI-2 (#60)  | `DccmTabBar`                                                                                                         |
| 04 Navigation   | `NavItem`              | `rXP4M`  | UI-2 (#60)  | `DccmNavItem` (`a[dccmNavItem]`, `span[dccmNavItem] comingSoon`)                                                     |
| 04 Navigation   | `RailItem`             | `sXviG`  | UI-2 (#60)  | `DccmNavItem compact`                                                                                                |
| 04 Navigation   | `TabBarItem`           | `jEtQt`  | UI-2 (#60)  | `DccmTabBarItem` (`a`, `button` ou `span[dccmTabBarItem]`)                                                           |
| 04 Navigation   | `Breadcrumb/Item`      | `D5oZd`  | UI-2 (#60)  | `HlmBreadcrumbItem`, `HlmBreadcrumbLink`, `HlmBreadcrumbPage` (`@personal-os/ui/breadcrumb`)                         |
| 04 Navigation   | `Breadcrumb/Separator` | `yKOOs`  | UI-2 (#60)  | `HlmBreadcrumbSeparator`                                                                                             |
| 04 Navigation   | `Breadcrumb`           | `PVPne`  | UI-2 (#60)  | `HlmBreadcrumb`, `HlmBreadcrumbList`                                                                                 |
| 04 Navigation   | `MobileHeader`         | `LNnJM`  | UI-2 (#60)  | `DccmMobileHeader`, bouton de commande projeté `[dccmMobileHeaderCommand]`                                           |
| 04 Navigation   | `PageHeader`           | `xMGff`  | UI-2 (#60)  | `DccmPageHeader`                                                                                                     |
| 05 Feedback     | `Banner`               | `L9HFJ`  | UI-3 (#62)  |                                                                                                                      |
| 05 Feedback     | `Toast`                | `bESqe`  | UI-3 (#62)  |                                                                                                                      |
| 05 Feedback     | `Skeleton`             | `kNtnJ`  | UI-3 (#62)  |                                                                                                                      |
| 05 Feedback     | `Modal`                | `CX7L8`  | UI-3 (#62)  |                                                                                                                      |
| 05 Feedback     | `EmptyState`           | `QLVDE`  | UI-3 (#62)  |                                                                                                                      |
| 06 Layout       | `AppShell/Desktop`     | `ZVeDP`  | UI-2 (#60)  | `DccmShell` (`@personal-os/ui/dccm`), à partir de 1280 px                                                            |
| 06 Layout       | `AppShell/Tablet`      | `izfng`  | UI-2 (#60)  | `DccmShell`, de 768 à 1279 px                                                                                        |
| 06 Layout       | `AppShell/Mobile`      | `jvzeX`  | UI-2 (#60)  | `DccmShell`, sous 768 px                                                                                             |

`Label` et `Select` n'ont pas de master : `HlmLabel` prend le libellé de
`FormField`, et le déclencheur de `HlmSelect` reprend la boîte de `Input`
(`inputBoxClasses`) avec l'icône de fin `keyboard_arrow_down`.

La planche `00 Foundations` n'a pas de master : elle est rendue par les stories
`Foundations` (`packages/ui/dccm/src/foundations/`).

## Affichage de données (UI-6)

Les composants de la planche 03 Data Display, leurs stories sous
`Data Display/*`. Ce que la traduction a tranché :

### Les tonalités de badge

Un badge dit un **sens**, pas une couleur. Le sens choisit la tonalité ; un
libellé ou une icône l'accompagnent toujours (en développement, `HlmBadge`
signale à la console un badge qui n'a ni l'un ni l'autre).

| Sens                                   | `tone`    | Texte, point, icône  | Fond                         |
| -------------------------------------- | --------- | -------------------- | ---------------------------- |
| Validé, en ligne, sain                 | `success` | `secondary`          | `secondary-20` (`#00a57233`) |
| En attente, bientôt, à venir           | `warning` | `tertiary`           | `tertiary-15` (`#ffb95f26`)  |
| Alerte, dégradé, en échec              | `error`   | `error`              | `error-20` (`#93000a33`)     |
| Information (par défaut)               | `info`    | `primary`            | `primary-20` (`#adc6ff33`)   |
| Neutre (un état sans valeur, une date) | `neutral` | `on-surface-variant` | `surface-container-high`     |

- `<span hlmBadge tone="warning" dot>En attente</span>` : `dot` pose un point
  de 6 px dans la couleur du texte ; une `ng-icon` projetée avant le libellé
  prend 16 px (`icon-xs`).
- `variant="counter"` : le compteur de 16 px, dans la tonalité de son
  contexte ; `solid` le remplit en `primary-container`.
- `variant="tag"` : un **mot-clé** (lieu, rayon, sprint), pas un statut. Rayon
  4, `surface-container-high`, texte `on-surface-variant` ; `accent` passe le
  texte en `primary`.

### Cartes et piliers

- `hlmCard` (`variant="nested"` pour une carte dans une carte), puis
  `hlmCardHeader` avec `hlmCardTitle`, `hlmCardDescription` et la zone de fin
  `hlmCardAction`, `hlmCardContent`, `hlmCardFooter`. Le pied met en forme son
  `<a>` enfant comme le lien du master (`primary`, 11/600, flèche 16).
- L'icône de pilier est la première `ng-icon` du titre, colorée par
  `hlmCardTitle [tone]` : Agenda et Projets `primary`, Sport et Finances
  `secondary`, Repas, Stock et Courses `tertiary`, Infrastructure `outline`.
  `dccm-kpi-tile` prend le même `tone`.
- Pas d'ombre : la profondeur vient de la rampe de surfaces et de la bordure
  `surface-container-highest`. Padding 16, 12 sous 768 px.
- Les cartes métier (événement, repas, recette, séance) se composent dans leur
  module avec ces directives, `hlmBadge` et `dccm-list-row`.

### Lignes, tuiles et tableaux

- **`DccmListRow`** : l'élément qui le porte dit l'usage. `<a dccmListRow>`
  mène au détail (avec `chevron`), `<button dccmListRow>` agit,
  `<dccm-list-row checkable [(checked)]>` porte une case à cocher, qui ne se
  pose jamais dans un lien ou un bouton. Le titre est le libellé de la case :
  il la nomme, et un clic dessus la bascule ; au clavier, Tab puis Espace.
  Cochée, le titre est barré en `outline` ; `selected`, la ligne passe en
  `primary-10` bordé de `primary-40`. Le titre est l'entrée `label` (pas
  `title`, qui poserait une infobulle native) : la règle
  `@angular-eslint/template/elements-content` l'accepte dans `dccm` et le
  tableau de bord.
- **`DccmKpiTile`** : sur un lien (`<a dccmKpiTile routerLink="…">`), toute la
  tuile mène au module et une flèche le dit. Le statut est un texte
  (`status`) ou un `hlmBadge` projeté. Son icône est un nom fourni par l'écran
  (`provideIcons`).
- **Tableau** : les directives spartan (`hlmTableContainer`, `hlmTable`,
  `hlmTableHeader`, `hlmTableRow`, `hlmTableHead`, `hlmTableCell`). La cellule
  principale d'une ligne s'écrit `class="font-semibold text-on-surface"` ; une
  ligne sélectionnée porte `data-state="selected"`.
- **`hlm()` connaît aussi les espacements pen** (`p-gutter`, `gap-space-md`),
  pour que `p-gutter-compact md:p-gutter` de la carte se fusionne avec un
  `p-*` passé par l'écran ; voir « Des jetons aux classes Tailwind ».

## Navigation et coque (UI-2)

Les planches 04 Navigation et 06 Layout, leurs stories sous `Navigation/*` et
`Layout/*`. Ce que la traduction a tranché :

### La coque

- **`DccmShell`** range ce qu'on lui projette selon la largeur : à partir de
  1280 px, `dccm-top-bar` et `dccm-sidebar` ; de 768 à 1279 px, `dccm-top-bar`
  et `dccm-sidebar variant="rail"` (768 à 1023 n'est pas dessiné, il suit la
  tablette) ; sous 768 px, `dccm-mobile-header` et `dccm-tab-bar`. Tout le
  reste est le contenu, dans un `<main>` à marge 24 (16 sur mobile). Ce qui ne
  sert pas à une largeur est en `display: none`, donc hors de l'arbre
  d'accessibilité. La variante de la Sidebar se lit sur son attribut
  `variant`, écrit en dur.
- **La navigation se décrit une fois**, dans
  `packages/dashboard/src/app/navigation.ts` (`DccmNavGroup`,
  `DccmNavEntry`). Une entrée sans chemin, ou dont l'écran n'a pas de route
  dans la configuration du routeur, est « À venir » : badge `warning` dans la
  Sidebar, estompée (`opacity-40`) dans le Rail et la barre d'onglets, faute
  de place pour le badge. Ce n'est ni un lien ni un arrêt de tabulation : un
  `span` `aria-disabled`, dont le libellé dit « (à venir) » aux lecteurs
  d'écran. Une redirection seule ne fait pas exister un écran.
- **L'entrée active** est celle de l'écran affiché (`routerLinkActive`, exact
  pour `/`) : `primary-20`, texte et icône `primary`, `aria-current="page"`.
  Focus : anneau 2 px `primary` intérieur, comme la galerie.
- **Le panneau « Plus »** de la barre d'onglets est un `hlm-sheet` (côté
  gauche) qui reprend la Sidebar, le sélecteur d'Espace et le compte. Le
  dialogue de CDK piège le focus, le ferme par Échap et rend le focus au
  bouton ; suivre un lien le ferme (`(navigate)` de la Sidebar).

### Les pièces

- **`DccmNavItem`** : sur `<a routerLink>` ou sur `<span comingSoon>` ;
  `compact` donne le `RailItem` (48 × 40, icône 20, libellé en `sr-only`).
- **`DccmSidebar`** : groupes en `label-micro` capitales `outline` (titres
  lus par `aria-labelledby` sur chaque liste, visuellement masqués en rail,
  où un filet sépare les groupes), pied avec « Aide et support » et la
  pastille d'état (`role="status"`, un point de 8 px et son libellé ; en rail,
  le point seul et son libellé en infobulle).
- **`DccmTopBar`** : fond `surface-container-lowest-90`, flou 12 et
  `shadow-top-bar` ; marque, sélecteur d'Espace (`hlm-toggle-group size="md"`
  à libellés 11 px, `[(scope)]`), zone de recherche projetée, bloc compte
  (Avatar, nom, « Déconnexion »). Le logo du `.pen` est une image absente du
  dépôt : l'emblème est l'icône `diamond` sur `surface-container-high`.
- **`DccmMobileHeader`** : la marque en tag accentué, la pastille d'état en
  badge `dot` sur `surface-container-low`, le bouton de commande projeté.
- **`DccmTabBar`** : les onglets reçus, puis ceux qu'on projette (« Plus »
  sur un `button[dccmTabBarItem]`). Cible 64 × 48.
- **`DccmPageHeader`** : fil d'Ariane (`HlmBreadcrumb`), titre
  `headline-lg-mobile` puis `headline-lg` à partir de 768, sous-titre
  `outline`, actions projetées.
- **`HlmTooltip`** et **`HlmSheet`** n'ont pas de master : l'infobulle prend
  `surface-container-highest`, `label-regular` et `shadow-popover` ; le
  panneau `surface-container-lowest`, une bordure
  `surface-container-highest`, `shadow-popover`, sur un voile
  `surface-container-lowest-80` (celui de la barre de commande).
- **Le sélecteur d'Espace** ne liste que les Espaces de l'API et ne filtre
  rien : il retient l'Espace pré-choisi d'une création
  (`EspaceCourant.espace()`, Espace personnel par défaut), que les
  formulaires liront.

## Audit

Fait le 18 octobre 2026 (UI-1, #59), sur `personalos.lib.pen` v2.21.

### Inventaire

- **48 masters**, tous affectés à un ticket : 15 à UI-5, 13 à UI-6, 15 à UI-2,
  5 à UI-3. Aucun master orphelin, aucun ticket qui cite un master absent.
- `design-system.json` décrit **43 composants** pour ces 48 masters : les quatre
  `Button/*` y sont un seul `Button` à variantes, et `Tab/Active`,
  `Tab/Inactive` sont rangés sous `SegmentedControl`. Ce n'est pas un écart :
  les tickets suivent le même regroupement.
- **59 variables** : 43 couleurs, 8 espacements, 5 rayons, 3 polices.
  `tokens.css` les porte toutes, plus les 8 pistes teintées de
  `design-system.json` et les deux espacements mobiles du frontmatter
  (`gutter-compact` 12, `margin-mobile` 16).

### Écarts entre les documents et le `.pen`

Le `.pen` l'emporte ; `tokens.css` et les composants suivent sa colonne.

| Sujet                       | `DESIGN.md`, `DESIGN-SYSTEM.md`, `design-system.json`                                                                                             | `personalos.lib.pen`                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fichier source              | `untitled.pen` (`DESIGN.md`, `DESIGN-SYSTEM.md`)                                                                                                  | `personalos.lib.pen`, importé par `personalos.pen`                                                                                                                          |
| Couleurs du frontmatter     | 47 : aussi `surface-tint`, `background`, `on-background`, `surface-variant`                                                                       | 43 ; `--background` n'existe que comme alias spartan (= `surface`)                                                                                                          |
| Rayon `xl`                  | `rounded.xl: 1.5rem`                                                                                                                              | absent ; `radius-full` à la place de `full`                                                                                                                                 |
| Approche (letter-spacing)   | en em : `display-hero` -0.03, `headline-lg` -0.02, `headline-lg-mobile` -0.015, `headline-md` -0.01, `label-micro` 0.02, `telemetry-metric` -0.02 | en px : -1.2, -0.5, -0.3, -0.2, **0.5**, -0.4. Les premiers sont des arrondis ; `label-micro` diffère vraiment (0,22 px contre 0,5 px)                                      |
| Interligne                  | dans le frontmatter                                                                                                                               | absent du `.pen` : `tokens.css` prend celui du frontmatter                                                                                                                  |
| Pistes teintées             | 5 (`DESIGN.md`)                                                                                                                                   | 8 (Foundations, `design-system.json`) : en plus `secondary-20` (`secondary-container` 20 %), `tertiary-20` (`tertiary-container` 20 %), `error-30` (`error-container` 30 %) |
| Ombre de popover            | `0 12px 32px -4px rgba(0,0,0,0.65)`                                                                                                               | `0 12px 32px` sans étalement, `#000000a6`                                                                                                                                   |
| Fond de `Modal`             | `surface-container-high` (et la Foundations, « Modale / popover »)                                                                                | le master `Modal` est en `surface-container` ; à trancher par UI-3 sur le master                                                                                            |
| `Tag`                       | fond `surface-container-highest` (`DESIGN.md`, UI-6)                                                                                              | `surface-container-high`                                                                                                                                                    |
| Badge `success`             | `secondary` 15 % (`DESIGN.md`)                                                                                                                    | `secondary-container` 20 % (`secondary-20`) ; UI-6 suit le `.pen`                                                                                                           |
| `Badge`                     | hauteur 22, padding 2/10                                                                                                                          | padding 2/8, hauteur à l'auto ; icône 14                                                                                                                                    |
| `Tab` et `SegmentedControl` | segment 28 px, `label-regular` (12/500), inactif en `outline`                                                                                     | padding 4/8, libellé 11 (600 actif, 500 inactif), inactif en `on-surface-variant`                                                                                           |
| `KpiTile`                   | sur-titre en `label-micro`                                                                                                                        | sur-titre 12/500, approche 1 px                                                                                                                                             |
| `Stepper`                   | rayons du système                                                                                                                                 | case de valeur au rayon 6, hors jetons                                                                                                                                      |
| Tailles d'icône             | « quatre tailles », plus 32 pour les états vides                                                                                                  | cinq tailles en Foundations ; les masters emploient aussi 14 (`Badge`, `Tag`, `Tab`, case cochée, `Button/Link`, séparateur de fil d'Ariane)                                |
| `TopBar`                    | pas d'ombre diffuse                                                                                                                               | ombre `0 1px 8px #00000080` et flou d'arrière-plan 12                                                                                                                       |
| Captures de documentation   | `tokens-specifications-1424.png` montre d'anciennes valeurs (`--color-*`, `.dark`, rayons 0,25/0,5/0,75 rem)                                      | ignorées : ce sont des écrans de maquette, pas la bibliothèque                                                                                                              |

### Ce que les composants ont tranché

- **Actions et formulaires (UI-5, #106).** Les galeries du `.pen` donnent le
  survol et le pressé de chaque variante de `Button`, sauf le pressé du
  primaire, en `primary-container` dans la galerie : un bouton texte n'a jamais
  ce fond, il garde `primary` et l'échelle 0,98. Le focus suit `DESIGN.md`
  (anneau 2 px `primary-20`, bordure 1 px `primary`) et non l'ombre `primary`
  40 % des galeries. La case de valeur du `Stepper` prend `rounded` (8, le
  rayon des contrôles) faute de jeton à 6. Les segments suivent le `.pen`
  (padding 4/8, 11 px), avec sa variante 12 px sur `surface-container-low` au
  rayon 12 (`size="md"`). Le champ passe en erreur quand son contrôle est
  invalide et touché, ou par `forceInvalid` : `aria-invalid` seul le
  marquerait rouge dès l'ouverture d'un formulaire vide. `KeyboardHint` et
  `FormField` passent par les générateurs spartan `kbd` et `field` (spartan
  1.3 n'a plus de `form-field`), selon la règle « le générateur d'abord ».
  La taille d'icône 14 devient le jeton `--icon-2xs`.

### Valeurs alpha hors des pistes teintées

Les masters et leurs galeries emploient des alphas que la Foundations ne liste
pas. Chacune s'ajoutera à `tokens.css` dans la PR du composant qui la consomme
(règle 7 de « Ajouter un composant ») :

| Valeur                   | Lecture                         | Où                                                                                                                                                                            |
| ------------------------ | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `#ffb4ab4d`              | `error` 30 %                    | bordure de `Button/Destructive` : `--error-stroke-30` (UI-5 ; `error-30` désigne déjà `error-container`)                                                                      |
| `#adc6ff66`              | `primary` 40 %                  | anneau de focus des galeries `Button` et `Input` : non retenu, UI-5 suit `DESIGN.md` (`primary-20`) ; bordure de ligne sélectionnée (`DESIGN.md`) : **`--primary-40`** (UI-6) |
| `#ffb95f33`              | `tertiary` 20 %                 | fond d'icône de `Banner` (UI-3)                                                                                                                                               |
| `#4edea31a`              | `secondary` 10 %                | galeries                                                                                                                                                                      |
| `#93000a66`              | `error-container` 40 %          | `Button/Destructive` pressé : `--error-40` (UI-5)                                                                                                                             |
| `#0a0e14e6`              | `surface-container-lowest` 90 % | fond de `TopBar` : **`--surface-container-lowest-90`** (UI-2)                                                                                                                 |
| `#10141ae6`              | `surface` 90 %                  | fond de `MobileTabBar` et `MobileHeader` : **`--surface-90`** (UI-2)                                                                                                          |
| `#0a0e14cc`              | `surface-container-lowest` 80 % | voile de la barre de commande (`personalos.pen`), repris sous le panneau « Plus » : **`--surface-container-lowest-80`** (UI-2)                                                |
| `#00000080`, `#0000000d` | ombres                          | `TopBar` : **`--shadow-top-bar`** (UI-2) ; l'ombre `#0000000d` du segment actif du sélecteur d'Espace n'est pas reprise (le `SegmentedControl` n'en a pas)                    |
