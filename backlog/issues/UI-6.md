---
id: UI-6
title: "Design system : affichage de données (Badge, Tag, Avatar, Card, KpiTile, ListRow, tableau)"
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

La planche `Design System / 03 Data Display` de `design/personalos.lib.pen` définit tout ce qui montre de l'information : statuts, cartes, tuiles de métrique, lignes de liste, tableaux. Ce ticket l'implémente en Angular avec ses stories. La coque (UI-2), les retours (UI-3) et tous les écrans de module en dépendent.

## État actuel du code

- Après UI-1 : jetons pen, Material Symbols, projet `dccm`, Storybook, `docs/design-system.md`.
- `packages/ui/badge` (`HlmBadge`), `packages/ui/card` (`HlmCard` et ses directives d'en-tête, titre, contenu, pied) : générés par spartan, styles shadcn.
- Spécifications : `design/DESIGN.md` (Modular cards, Status badges, Typography, Domain pillars), `design/DESIGN-SYSTEM.md` (Data Display), `design/design-system.json > components`. Usage dans les écrans : `design/captures/ecrans/accueil-1424.png` (tuiles KPI), `stock-domestique-1424.png` (tableau, badges de péremption), `motifs-transverses-1424.png` (catalogue des badges d'état).

## À faire

Implémenter chaque master, avec une story par composant (contrôles, variantes, états hover et selected quand ils existent, exemples d'usage et contenus projetés documentés), sous la catégorie `Data Display` :

| Master pen.dev | Implémentation Angular |
| --- | --- |
| `Badge` | `HlmBadge` restylé : `tone` `info` (défaut), `success`, `warning`, `error`, `neutral` ; point (`dot`), icône, compteur ; capsule 22 px, `label-micro` 600 |
| `Tag` | `HlmBadge` `variant="tag"` : rayon 4, `surface-container-highest`, texte `on-surface-variant`, icône ; `accent` → texte `primary` |
| `Avatar` | spartan `avatar` (générateur) restylé : icône ou initiales, tailles 24, 32, 40, tonalités |
| `ProgressBar` | spartan `progress` (générateur) restylé : `tone`, épaisseur 4 ou 6 |
| `Divider` | spartan `separator` (générateur) restylé |
| `Card`, `CardHeader`, `CardTitle` | `HlmCard` restylé et ses directives : icône de pilier (20 px), titre `title-sm`, zone de fin d'en-tête projetée, contenu, pied avec lien ; `variant="nested"` (`surface-container-high`) ; padding 16 (12 sous 768 px) |
| `KpiTile` | `DccmKpiTile` (`packages/ui/dccm/kpi-tile`), compose `HlmCard` : icône, sur-titre, valeur `telemetry-metric` en chiffres tabulaires, méta, statut (`HlmBadge`), lien ; hauteur min 140 |
| `SectionHeader` | `DccmSectionHeader` : titre `headline-md`, description, zone de fin projetée |
| `ListRow` | `DccmListRow` : titre, méta, case à cocher optionnelle (spartan `checkbox`), chevron, zone de fin projetée ; états hover, checked (titre barré en `outline`), selected (`primary-10`, bordure `primary` 40 %) ; lien ou bouton selon l'usage |
| `Table/HeaderCell`, `Table/Cell` | spartan `table` (générateur) restylé : en-têtes `label-micro`, cellules `body-dense` |

- Lire chaque master dans `personalos.lib.pen` (id dans `design-system.json`) pour les valeurs exactes.
- Tests jest : `DccmListRow` émet la bascule de la case et reste utilisable au clavier ; `HlmBadge` rend un libellé ou une icône en plus de la couleur.
- Compléter la table de correspondance de `docs/design-system.md`, avec la table des tonalités de badge par sens (validé, en attente, alerte, information, neutre) reprise de `DESIGN.md`.

## Décisions déjà prises

- Un master qui a un équivalent spartan/ui passe par le générateur puis un restylage ; les autres vivent dans `packages/ui/dccm/<nom>`.
- Un statut ne passe jamais par la couleur seule : libellé ou icône toujours présents.
- Les piliers se distinguent par l'icône et le libellé : Agenda et Projets en `primary`, Sport et Finances en `secondary`, Repas, Stock et Courses en `tertiary`, Infrastructure en `outline`.
- Pas d'ombre sur les cartes : profondeur par la rampe de surfaces et la bordure 1 px `surface-container-highest`.
- Les cartes métier des écrans (événement d'Agenda, repas, recette, séance) ne sont pas faites ici : elles se composent dans les tickets de leur module à partir de `HlmCard`, `HlmBadge` et `DccmListRow`.

## Critères d'acceptation

- [ ] Chaque master de la table a sa story et son rendu correspond au master pen.dev.
- [ ] L'addon a11y ne signale aucune violation sur ces stories.
- [ ] Aucune couleur, taille de police ni rayon en dur dans les composants touchés.

## Vérification

- `pnpm exec nx affected -t lint test build --base=origin/develop` ; `pnpm exec nx run dccm:build-storybook`.
- Captures des stories (badges, carte, tuile KPI, lignes de liste, tableau) jointes à la PR.

## Pour la prod

Rien.

## Hors périmètre

- Boutons et contrôles de formulaire : UI-5.
- Navigation et coque : UI-2. Bannière, modale, états vide et erreur : UI-3.

## Dépendances

- UI-1.
