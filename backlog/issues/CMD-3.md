---
id: CMD-3
title: "Barre de commande : saisie d'intention, ouverture de l'écran prérempli, échec franc"
epic: CMD
type: feature
priority: P0
size: M
milestone: M5 Tableau de bord et barre de commande
blocked_by: [CMD-2, DASH-2]
adr: [0018]
risques: [SEC-6]
revue_visuelle: true
---

## Contexte

Un champ unique en haut du tableau de bord : l'utilisateur écrit son intention en français, l'application ouvre l'écran concerné prérempli, il relit et confirme. Quand rien ne correspond, la barre le dit franchement et propose l'écran le plus proche.

## État actuel du code

- `POST /command-bar/resolve` (CMD-2) ; zone d'en-tête réservée dans la coque (UI-2) et sur l'accueil (DASH-2) ; `docs/design-system.md` décrit `DccmCommandBar`.

## À faire

- `DccmCommandBar` dans `packages/ui/dccm/` (+ story) : champ, raccourci clavier (`Ctrl+K` / `Cmd+K`), état « je cherche… ».
- Sur `action` : navigation vers l'URL préremplie (le formulaire affiche lui-même les valeurs ignorées) ; sur `none` : message « Je ne sais pas encore faire ça. » et lien vers l'écran le plus proche s'il existe.
- La barre est présente sur toutes les pages, dans la coque.

## Décisions déjà prises

- Aucune réponse en phrase, aucun chiffre affiché par la barre elle-même.

## Critères d'acceptation

- [ ] Une intention connue ouvre le formulaire prérempli, sans rien enregistrer.
- [ ] Une intention inconnue affiche l'échec franc.

## Vérification

- `pnpm exec nx test dashboard` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.
- Captures : `scripts/captures.sh /` avec la barre ouverte, et le formulaire ouvert par une commande (double IA).

## Pour la prod

Rien.

## Hors périmètre

- Les annotations : CMD-4.

## Dépendances

- CMD-2, DASH-2.
