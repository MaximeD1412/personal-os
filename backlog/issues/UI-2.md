---
id: UI-2
title: "Coque de l'application : Sidebar, Rail, TopBar, barre d'onglets mobile, sélecteur d'Espace"
epic: UI
type: feature
priority: P0
size: M
milestone: M1 UI
blocked_by: [UI-5, UI-6]
adr: [0014, 0029]
risques: [AG-4]
revue_visuelle: true
reprend: 60
---

## Contexte

Les planches `Design System / 04 Navigation` et `06 Layout` de `design/personalos.lib.pen` définissent la coque de Personal OS sur trois largeurs : Sidebar 240 px sous une TopBar de 64 px sur desktop, Rail de 72 px sur tablette, MobileHeader et barre d'onglets en bas sur mobile. La coque affiche les Espaces atteignables sans jamais filtrer côté front : le filtrage est une règle de l'API (ADR 0014, 0028). Tous les écrans s'y logent ; la barre de commande (CMD-3) occupera la zone de recherche de la TopBar.

## État actuel du code

- `packages/dashboard/src/app/app.ts`, `app.html` : coque minimale (titre, compte, bouton de déconnexion, sonde de santé, trois liens `hlmBtn`), `app.routes.ts` (`''` → `agenda`, `agenda`, `calendrier`, `fil-traceur`).
- `espace.service.ts` (`mesEspaces()`), `auth.service.ts` (`moi()`, `seDeconnecter()`), `health.service.ts` (`read()`).
- Après UI-5 et UI-6 : boutons, toggle-group, Badge, Tag, Avatar, Divider restylés ; projet `dccm` et Storybook.
- Maquettes : `design/captures/ecrans/agenda-1424.png` (Sidebar, TopBar), `accueil-1024.png` (Rail), `agenda-390.png` et `accueil-390.png` (MobileHeader, barre d'onglets). Masters : `Sidebar` (`EDbRo`), `NavItem` (`rXP4M`), `Rail` (`GfuO7`), `RailItem` (`sXviG`), `TopBar` (`DVUUC`), `MobileHeader` (`LNnJM`), `MobileTabBar` (`jFjwa`), `TabBarItem` (`jEtQt`), `Breadcrumb` (`PVPne`), `PageHeader` (`xMGff`), `AppShell/Desktop|Tablet|Mobile` (`ZVeDP`, `izfng`, `jvzeX`).

## À faire

Composants, avec leurs stories (catégories `Navigation` et `Layout`) :

| Master pen.dev | Implémentation Angular |
| --- | --- |
| `NavItem`, `RailItem` | `DccmNavItem` : icône 18, libellé 13/500, `active`, `comingSoon` (badge « À venir » `warning`, non cliquable), mode compact pour le rail ; lien `routerLink` |
| `Sidebar`, `Rail` | `DccmSidebar` : groupes (`label-micro` en `outline`), `variant` `full` (240 px) ou `rail` (72 px, libellés en infobulle), pied (Aide et support, pastille d'état) |
| `TopBar` | `DccmTopBar` : marque, sélecteur d'Espace, zone de recherche projetée (vide ici, CMD-3 la remplit), bloc compte (Avatar, nom, déconnexion) |
| `MobileHeader` | `DccmMobileHeader` : marque, pastille d'état, bouton de commande projeté |
| `MobileTabBar`, `TabBarItem` | `DccmTabBar` : cinq entrées, icône 24, libellé 11, cible 56 × 44 minimum |
| `Breadcrumb/*` | spartan `breadcrumb` (générateur) restylé : `label-micro` en majuscules, séparateur `chevron_right` 14 |
| `PageHeader` | `DccmPageHeader` : fil d'Ariane, titre `headline-lg` (22 px sous 768), sous-titre, actions projetées |
| `AppShell/Desktop`, `/Tablet`, `/Mobile` | `DccmShell` : un seul composant ; ≥ 1280 px TopBar + Sidebar ; 768 à 1279 px TopBar + Rail ; < 768 px MobileHeader + DccmTabBar ; contenu avec marge 24 (16 sur mobile) |

Branchement dans `packages/dashboard` :

- `app.html` passe à `DccmShell`. La navigation est décrite une fois, dans `packages/dashboard/src/app/navigation.ts` :
  - **Organisation** : Accueil `/`, Agenda `/agenda`, Calendrier `/calendrier`, Sport `/sport` ;
  - **Cuisine & Nutrition** : Planning des repas `/repas/planning`, Recettes `/repas/recettes`, Stock `/repas/stock`, Courses `/courses` ;
  - **Gestion** : Finances, Documents, Immobilier ;
  - **Professionnel** : Projets `/projets`, Portfolio `/portfolio`, Documentation ;
  - **Système** : Sauvegardes, Intégrations, Paramètres `/foyer/preferences` ;
  - pied : Aide et support.
- Une entrée est active si sa route existe dans la configuration du routeur, sinon elle est affichée « À venir », désactivée. Elle s'active d'elle-même le jour où le ticket de son module ajoute la route.
- Barre d'onglets mobile : Accueil, Agenda, Sport, Repas (`/repas/planning`), Plus. « Plus » ouvre un panneau (spartan `sheet`) contenant toute la navigation.
- Sélecteur d'Espace (toggle-group « Mon espace » / « Foyer ») : liste les Espaces renvoyés par `EspaceService` et retient l'Espace pré-choisi pour une création (signal dans un service `EspaceCourant`, lu par les formulaires). Il ne filtre aucune donnée.
- Compte connecté (`AuthService.moi()`) et déconnexion (`seDeconnecter()`, comportement actuel conservé) dans la TopBar.
- Pastille d'état du pied de la Sidebar et du MobileHeader : « API joignable » / « API injoignable », d'après `HealthService.read()`.
- Le lien « Fil traceur » quitte la navigation ; la route `/fil-traceur` reste accessible par son URL.
- Tests jest : une entrée sans route est « À venir » et non cliquable ; le sélecteur ne liste que les Espaces de l'API ; la déconnexion redirige comme aujourd'hui. Tests de `app.spec.ts` adaptés.

## Décisions déjà prises

- Ordre et libellés des groupes : ceux du master `Sidebar`. Finances, Documents, Immobilier, Documentation, Intégrations et Aide et support sont hors V1 : toujours « À venir ».
- Entre 768 et 1023 px (non dessiné), la coque suit la version tablette (Rail).
- Le bouton de thème de la TopBar n'est pas implémenté (sombre seul en V1).
- Les textes de la maquette (« Nœud DCCM actif », « v4.8 », « Propriétaire ») ne sont pas repris : la pastille dit l'état réel de l'API, le bloc compte affiche le nom du Compte.
- Navigation clavier : ordre de tabulation visuel, `aria-current="page"` sur l'entrée active, panneau « Plus » qui piège le focus et se ferme par Échap.

## Critères d'acceptation

- [ ] La coque correspond aux maquettes en 390, 1024 et 1280 px.
- [ ] Chaque entrée active mène à son écran ; les entrées « À venir » ne sont pas cliquables.
- [ ] Le sélecteur ne liste que les Espaces renvoyés par l'API.
- [ ] Chaque composant a sa story ; l'addon a11y ne signale aucune violation.

## Vérification

- `pnpm exec nx test dashboard` ; `pnpm exec nx affected -t lint test build --base=origin/develop` ; `pnpm exec nx run dccm:build-storybook`.
- Captures : `scripts/captures.sh /agenda /calendrier` en 390 et 1280 px, plus 1024 px, à côté de `agenda-1424.png`, `accueil-1024.png` et `agenda-390.png`.

## Pour la prod

Rien.

## Hors périmètre

- La barre de commande : CMD-3.
- Le contenu des écrans Agenda et Calendrier : UI-4. L'accueil : DASH-2.

## Dépendances

- UI-5.
- UI-6.
