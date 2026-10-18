---
id: UI-1
title: "Design system : fondations pen.dev (jetons, polices, icônes, Storybook)"
epic: UI
type: feature
priority: P0
size: M
milestone: M1 UI
blocked_by: []
adr: [0029]
risques: [AG-2, AG-4]
revue_visuelle: true
reprend: 59
---

## Contexte

Le design de Personal OS est terminé dans pen.dev : une bibliothèque de 48 composants maîtres et 59 variables, et les écrans de l'application en 1424 px et 390 px (`design/`). Ce ticket pose les fondations dont dépendent tous les autres tickets de l'epic UI : les jetons, les polices, les icônes, Storybook, et la documentation qui dit aux agents comment se servir du design system. UI-5, UI-6, UI-2 et UI-3 y construisent les composants.

## État actuel du code

- `design/` : `personalos.lib.pen` (bibliothèque, JSON lisible : variables, masters `reusable: true`, galeries), `personalos.pen` (écrans, qui importent la bibliothèque sous l'alias `lib:`), `DESIGN.md` (frontmatter des jetons, règles), `DESIGN-SYSTEM.md` (catalogue), `design-system.json` (ids des masters et de leurs parties), `captures/ecrans/*.png` (export de chaque écran, dont `tokens-specifications-1424.png`, `etats-interactifs-1424.png`, `motifs-transverses-1424.png`).
- `packages/theme/tokens.css` : jetons shadcn par défaut (OKLCH), mode clair sur `:root`, sombre sur `:root.dark`. Importé par `packages/dashboard/src/styles.css` et `packages/portfolio/src/styles.css`, après le preset `@spartan-ng/brain/hlm-tailwind-preset.css`.
- `packages/ui/{badge,button,card,input,label,select,utils}` : composants spartan/ui générés, un projet Nx par composant (alias `@personal-os/ui/<nom>`, préfixe `hlm`), cibles `build` et `lint` seulement.
- Icônes : `@ng-icons/core` et `@ng-icons/lucide` (33.4). Aucune police déclarée (`--font-sans` = pile système).
- Pas de Storybook dans le dépôt.
- La branche `codex/maquette-projet` ne contient aucun design system : on ne la fusionne pas.

## À faire

- **Audit** (début de la PR, résultat dans `docs/design-system.md`) : inventaire des 48 masters de `personalos.lib.pen` rapproché de la table de correspondance de UI-5, UI-6, UI-2 et UI-3 ; écarts entre `DESIGN.md`, `DESIGN-SYSTEM.md` et les valeurs réelles des masters (le `.pen` l'emporte, l'écart est noté).
- **Jetons** : réécrire `packages/theme/tokens.css` à partir des variables de `personalos.lib.pen` et du frontmatter de `DESIGN.md` :
  - les 43 couleurs sous leurs noms pen (`--surface`, `--surface-container-high`, `--on-surface`, `--outline-variant`, `--primary`, `--on-primary`, `--secondary`, `--tertiary`, `--error`…), valeurs hexa telles quelles ;
  - les pistes teintées de `design-system.json > tokens.tints` (`--primary-20`, `--primary-10`, `--secondary-15`, `--secondary-20`, `--tertiary-15`, `--tertiary-20`, `--error-20`, `--error-30`) ;
  - rayons (`--radius-sm` 4, `--radius` 8, `--radius-md` 12, `--radius-lg` 16), espacements (`space-xs` à `space-2xl`, `gutter`, `gutter-compact`, `margin`, `margin-mobile`), échelle typographique (`display-hero` à `code-mono`, taille, graisse, interligne, approche), ombre de popover ;
  - exposés à Tailwind par un bloc `@theme inline` (`bg-surface-container`, `text-on-surface-variant`, `text-headline-lg`, `rounded-md`…) ;
  - les alias attendus par spartan, redéfinis vers les jetons pen (table dans « Décisions déjà prises »).
- **Sombre seul** : supprimer le thème clair et la classe `dark`, `color-scheme: dark` sur `:root`. Commentaire en tête de fichier : un futur thème redéfinit les jetons sous `:root[data-theme="…"]`.
- **Polices** : `@fontsource-variable/inter` et `@fontsource-variable/jetbrains-mono`, importées par les deux feuilles globales ; `--font-body` et `--font-mono`. Chiffres tabulaires (`tnum`) disponibles par une classe utilitaire.
- **Icônes** : `@ng-icons/material-symbols` (variante Outlined), même version majeure que `@ng-icons/core`. Tailles 16, 18, 20, 24, 32 exposées. Les icônes lucide des composants spartan existants passent à Material Symbols.
- **Projet `dccm`** : bibliothèque Angular `packages/ui/dccm` (alias `@personal-os/ui/dccm`, préfixe `dccm`, un dossier par composant), vide pour l'instant, qui recevra les composants sans équivalent spartan.
- **Storybook** : `@storybook/angular` configuré par `nx g @nx/storybook:configuration dccm` (version compatible Angular 22 et Nx 23). Il charge `packages/dashboard/src/styles.css`, cherche les stories dans `packages/ui/**/*.stories.ts` et a les addons docs (autodocs), controls et a11y. Fond `surface`. Catégories : `Foundations`, `Actions`, `Forms`, `Data Display`, `Navigation`, `Feedback`, `Layout`. Cibles `dccm:storybook`, `dccm:build-storybook`.
- **Stories Foundations** : couleurs (nuanciers par rampe, avec nom et valeur), pistes teintées, échelle typographique, espacements, rayons, tailles d'icônes, élévation, à l'image de la planche `Design System / 00 Foundations` et de `tokens-specifications-1424.png`.
- **`docs/design-system.md`** : hiérarchie des références (celle de l'epic), audit, où vivent les composants, comment en ajouter un (générateur spartan d'abord, sinon `dccm`), table master → composant Angular (remplie par chaque ticket), et les règles de « Décisions déjà prises ».
- `AGENTS.md` : une ligne qui pointe `docs/design-system.md` avant de toucher un écran.

## Décisions déjà prises

- La bibliothèque pen.dev est la source de vérité visuelle ; `design/` n'est jamais modifié. Ses mentions de SvelteKit se lisent Angular et spartan/ui.
- Les noms des jetons sont ceux de pen.dev. Quand un nom shadcn a un autre sens, c'est le sens pen qui gagne : `--secondary` est le vert de validation, pas un gris neutre. Les composants spartan sont restylés en conséquence (UI-5, UI-6), on ne garde pas leurs classes shadcn.
- Alias spartan : `--background` → `--surface` ; `--foreground` → `--on-surface` ; `--card` → `--surface-container` ; `--card-foreground` → `--on-surface` ; `--popover` → `--surface-container-high` ; `--popover-foreground` → `--on-surface` ; `--primary-foreground` → `--on-primary` ; `--secondary-foreground` → `--on-secondary` ; `--muted` et `--accent` → `--surface-container-high` ; `--muted-foreground` → `--outline` ; `--accent-foreground` → `--on-surface` ; `--destructive` → `--error` ; `--border` et `--input` → `--surface-container-highest` ; `--ring` → `--primary` ; `--sidebar*` → `--surface-container-lowest`, `--on-surface-variant`, `--primary`.
- Un écran n'écrit jamais de couleur, de taille de police ni de rayon en dur : il passe par les jetons. Les seules valeurs alpha permises sont les pistes teintées.
- Pas de polices ni d'icônes chargées depuis un CDN : tout est servi par l'application (le portfolio vise Lighthouse ≥ 95, PORTFOLIO-6).
- La maquette donne l'apparence, le ticket donne le périmètre : un élément de maquette absent du ticket n'est pas implémenté. Les textes des maquettes (SQLite, « Nœud DCCM v4.8 », montants, noms) sont des textes de remplissage, pas des specs.
- Le MCP pen.dev n'est pas requis : le JSON des `.pen`, `design-system.json` et les captures suffisent. S'il est disponible, il sert à vérifier les valeurs.

## Critères d'acceptation

- [ ] `pnpm exec nx run dccm:storybook` démarre et montre les stories Foundations, conformes à la planche Foundations.
- [ ] `packages/theme/tokens.css` porte les 43 couleurs, les 8 pistes teintées, rayons, espacements et typographie de la bibliothèque, avec les mêmes noms et valeurs.
- [ ] Le tableau de bord et le portfolio s'affichent en sombre avec Inter, sans requête vers un CDN de polices.
- [ ] Les écrans existants (Agenda, Calendrier, Traces) restent utilisables : aucun texte illisible, aucun contrôle invisible.
- [ ] `docs/design-system.md` contient l'audit, les règles et la table de correspondance.

## Vérification

- `pnpm exec nx affected -t lint test build --base=origin/develop` ; `pnpm exec nx run dccm:build-storybook`.
- Captures : `scripts/captures.sh /agenda /calendrier` (non-régression), plus une capture des stories Foundations jointe à la PR.

## Pour la prod

Rien.

## Hors périmètre

- Les composants : UI-5 (actions, formulaires), UI-6 (affichage de données), UI-2 (coque), UI-3 (retours et motifs).
- La refonte des écrans existants : UI-4.

## Dépendances

Aucune.
