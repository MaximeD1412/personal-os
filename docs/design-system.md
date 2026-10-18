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
| Piste teintée `--<couleur>-<alpha>` (8)                                                  | idem                                                                | `bg-primary-20`, `bg-error-20`                                                                  |
| Espacement `--space-*`, `--gutter`, `--gutter-compact`, `--margin`, `--margin-mobile`    | `p-`, `m-`, `gap-`, `w-`… `<nom>`                                   | `p-space-md`, `gap-gutter`, `px-margin`                                                         |
| Rayon `--radius-sm` 4, `--radius` 8, `--radius-md` 12, `--radius-lg` 16, `--radius-full` | `rounded-sm`, `rounded`, `rounded-md`, `rounded-lg`, `rounded-full` | tag `rounded-sm`, bouton `rounded`, carte `rounded-md`                                          |
| Typographie `--text-<niveau>` (11)                                                       | `text-<niveau>` : taille, interligne, graisse et approche           | `text-headline-lg`, `text-body-dense`, `text-label-micro uppercase`, `text-code-mono font-mono` |
| Police `--font-body`, `--font-mono`                                                      | `font-body` (par défaut sur `body`), `font-mono`                    |                                                                                                 |
| Icône `--icon-xs` 16, `-sm` 18, `-md` 20, `-lg` 24, `-xl` 32                             | `icon-xs` … `icon-xl` sur `ng-icon`                                 | `<ng-icon name="matCheckOutline" class="icon-sm" />`                                            |
| Ombre `--shadow-popover`                                                                 | `shadow-popover`                                                    | modale, popover                                                                                 |

Les rayons `rounded-xl` à `rounded-4xl` restent ceux du preset spartan, dérivés
de `--radius` : ils n'existent pas dans la bibliothèque, un écran ne s'en sert
pas. Les tailles d'icône : 16 dans les badges, tags, fils d'Ariane et tableaux
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
   violation.
5. **Remplir sa ligne** dans la table ci-dessous, dans la PR du composant.
6. **Une valeur absente des jetons** (une piste alpha qu'un master emploie et
   que la Foundations ne liste pas, par exemple) s'ajoute à `tokens.css` sous un
   nom `<couleur>-<alpha>`, dans la PR du composant qui en a besoin, et l'écart
   se note dans l'audit ci-dessous.

## Masters et composants Angular

Une ligne par master de `personalos.lib.pen`. La colonne « Composant » se
remplit dans la PR qui l'implémente.

| Planche         | Master                 | Id       | Ticket      | Composant Angular |
| --------------- | ---------------------- | -------- | ----------- | ----------------- |
| 01 Actions      | `Button/Primary`       | `fm2Pg`  | UI-5 (#106) |                   |
| 01 Actions      | `Button/Secondary`     | `kSA0S`  | UI-5 (#106) |                   |
| 01 Actions      | `Button/Ghost`         | `skoX7`  | UI-5 (#106) |                   |
| 01 Actions      | `Button/Destructive`   | `YxFNj`  | UI-5 (#106) |                   |
| 01 Actions      | `Button/Icon`          | `XtxvG`  | UI-5 (#106) |                   |
| 01 Actions      | `Button/Link`          | `AbBjI`  | UI-5 (#106) |                   |
| 01 Actions      | `KeyboardHint`         | `wUjrG`  | UI-5 (#106) |                   |
| 02 Forms        | `Input`                | `ALZVI`  | UI-5 (#106) |                   |
| 02 Forms        | `FormField`            | `q3MAZQ` | UI-5 (#106) |                   |
| 02 Forms        | `Checkbox`             | `JwWQG`  | UI-5 (#106) |                   |
| 02 Forms        | `Switch`               | `S9hTL`  | UI-5 (#106) |                   |
| 02 Forms        | `Stepper`              | `Ahi2D`  | UI-5 (#106) |                   |
| 02 Forms        | `Tab/Active`           | `ms6qi`  | UI-5 (#106) |                   |
| 02 Forms        | `Tab/Inactive`         | `dsKE8`  | UI-5 (#106) |                   |
| 02 Forms        | `SegmentedControl`     | `ee30V`  | UI-5 (#106) |                   |
| 03 Data Display | `Badge`                | `AsJMu`  | UI-6 (#107) |                   |
| 03 Data Display | `Tag`                  | `d6arwe` | UI-6 (#107) |                   |
| 03 Data Display | `Avatar`               | `qV14Y`  | UI-6 (#107) |                   |
| 03 Data Display | `ProgressBar`          | `phWRw`  | UI-6 (#107) |                   |
| 03 Data Display | `Divider`              | `n1yjU`  | UI-6 (#107) |                   |
| 03 Data Display | `CardTitle`            | `JNiEe`  | UI-6 (#107) |                   |
| 03 Data Display | `CardHeader`           | `t2Hdg8` | UI-6 (#107) |                   |
| 03 Data Display | `SectionHeader`        | `xvhC6`  | UI-6 (#107) |                   |
| 03 Data Display | `Card`                 | `F9aBD`  | UI-6 (#107) |                   |
| 03 Data Display | `KpiTile`              | `UmdUk`  | UI-6 (#107) |                   |
| 03 Data Display | `Table/HeaderCell`     | `b4QLdx` | UI-6 (#107) |                   |
| 03 Data Display | `Table/Cell`           | `sUITn`  | UI-6 (#107) |                   |
| 03 Data Display | `ListRow`              | `DHctf`  | UI-6 (#107) |                   |
| 04 Navigation   | `TopBar`               | `DVUUC`  | UI-2 (#60)  |                   |
| 04 Navigation   | `Sidebar`              | `EDbRo`  | UI-2 (#60)  |                   |
| 04 Navigation   | `Rail`                 | `GfuO7`  | UI-2 (#60)  |                   |
| 04 Navigation   | `MobileTabBar`         | `jFjwa`  | UI-2 (#60)  |                   |
| 04 Navigation   | `NavItem`              | `rXP4M`  | UI-2 (#60)  |                   |
| 04 Navigation   | `RailItem`             | `sXviG`  | UI-2 (#60)  |                   |
| 04 Navigation   | `TabBarItem`           | `jEtQt`  | UI-2 (#60)  |                   |
| 04 Navigation   | `Breadcrumb/Item`      | `D5oZd`  | UI-2 (#60)  |                   |
| 04 Navigation   | `Breadcrumb/Separator` | `yKOOs`  | UI-2 (#60)  |                   |
| 04 Navigation   | `Breadcrumb`           | `PVPne`  | UI-2 (#60)  |                   |
| 04 Navigation   | `MobileHeader`         | `LNnJM`  | UI-2 (#60)  |                   |
| 04 Navigation   | `PageHeader`           | `xMGff`  | UI-2 (#60)  |                   |
| 05 Feedback     | `Banner`               | `L9HFJ`  | UI-3 (#62)  |                   |
| 05 Feedback     | `Toast`                | `bESqe`  | UI-3 (#62)  |                   |
| 05 Feedback     | `Skeleton`             | `kNtnJ`  | UI-3 (#62)  |                   |
| 05 Feedback     | `Modal`                | `CX7L8`  | UI-3 (#62)  |                   |
| 05 Feedback     | `EmptyState`           | `QLVDE`  | UI-3 (#62)  |                   |
| 06 Layout       | `AppShell/Desktop`     | `ZVeDP`  | UI-2 (#60)  |                   |
| 06 Layout       | `AppShell/Tablet`      | `izfng`  | UI-2 (#60)  |                   |
| 06 Layout       | `AppShell/Mobile`      | `jvzeX`  | UI-2 (#60)  |                   |

La planche `00 Foundations` n'a pas de master : elle est rendue par les stories
`Foundations` (`packages/ui/dccm/src/foundations/`).

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
| `Badge`                     | hauteur 22, padding 2/10                                                                                                                          | padding 2/8, hauteur à l'auto ; icône 14                                                                                                                                    |
| `Tab` et `SegmentedControl` | segment 28 px, `label-regular` (12/500), inactif en `outline`                                                                                     | padding 4/8, libellé 11 (600 actif, 500 inactif), inactif en `on-surface-variant`                                                                                           |
| `KpiTile`                   | sur-titre en `label-micro`                                                                                                                        | sur-titre 12/500, approche 1 px                                                                                                                                             |
| `Stepper`                   | rayons du système                                                                                                                                 | case de valeur au rayon 6, hors jetons                                                                                                                                      |
| Tailles d'icône             | « quatre tailles », plus 32 pour les états vides                                                                                                  | cinq tailles en Foundations ; les masters emploient aussi 14 (`Badge`, `Tag`, `Tab`, case cochée, `Button/Link`, séparateur de fil d'Ariane)                                |
| `TopBar`                    | pas d'ombre diffuse                                                                                                                               | ombre `0 1px 8px #00000080` et flou d'arrière-plan 12                                                                                                                       |
| Captures de documentation   | `tokens-specifications-1424.png` montre d'anciennes valeurs (`--color-*`, `.dark`, rayons 0,25/0,5/0,75 rem)                                      | ignorées : ce sont des écrans de maquette, pas la bibliothèque                                                                                                              |

### Valeurs alpha hors des pistes teintées

Les masters et leurs galeries emploient des alphas que la Foundations ne liste
pas. Chacune s'ajoutera à `tokens.css` dans la PR du composant qui la consomme
(règle 6 de « Ajouter un composant ») :

| Valeur                   | Lecture                         | Où                                                                                                   |
| ------------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `#ffb4ab4d`              | `error` 30 %                    | bordure de `Button/Destructive` (UI-5)                                                               |
| `#adc6ff66`              | `primary` 40 %                  | anneau de focus des galeries `Button` et `Input` (UI-5), bordure de ligne sélectionnée (`DESIGN.md`) |
| `#ffb95f33`              | `tertiary` 20 %                 | fond d'icône de `Banner` (UI-3)                                                                      |
| `#4edea31a`              | `secondary` 10 %                | galeries                                                                                             |
| `#93000a66`              | `error-container` 40 %          | galeries                                                                                             |
| `#0a0e14e6`              | `surface-container-lowest` 90 % | fond de `TopBar` (UI-2)                                                                              |
| `#10141ae6`              | `surface` 90 %                  | fond de `MobileTabBar` et `MobileHeader` (UI-2)                                                      |
| `#00000080`, `#0000000d` | ombres                          | `TopBar`, sélecteur d'environnement (UI-2)                                                           |
