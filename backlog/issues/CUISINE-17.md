---
id: CUISINE-17
title: "Écran de génération : lancer un tour, statuer sur chaque repas, relancer, arrêter"
epic: CUISINE
type: feature
priority: P0
size: M
milestone: M3 Cuisine boucle
blocked_by: [CUISINE-16]
adr: [0030]
risques: [IA-1]
revue_visuelle: true
reprend: 78
---

## Contexte

L'utilisateur lance la génération d'une semaine, statue sur chacun des repas proposés, relance un tour pour les refusés, et arrête le planning quand tout est approuvé. Il peut consulter la trace d'un tour pour comprendre une proposition étrange.

## État actuel du code

- Routes de CUISINE-15 et CUISINE-16 ; écran `/repas/planning?semaine=…` (CUISINE-7) avec ses Souhaits (CUISINE-18).

## À faire

- Sur `/repas/planning?semaine=…` : « Générer la semaine » (choix des créneaux à remplir, participants et invités par créneau, tous cochés par défaut), puis chaque repas proposé avec « Approuver » / « Refuser » ; « Relancer un tour » actif seulement quand tout est statué ; « Arrêter le planning » quand tout est approuvé (`DccmConfirm`).
- Les créneaux vidés par le contrôle affichent leur raison (« Écarté : contient des noix, allergie de … »).
- Lien « Voir la trace » par tour : `/repas/generation/traces/:traceId` (prompt, réponse, modèle, coût).
- Erreur `ai.budget_exceeded` affichée telle quelle.

## Décisions déjà prises

- Maquette : `planning-de-repas-1424.png`, `planning-de-repas-390.png`, `planning-de-repas-overlays.png` dans `design/captures/ecrans/` (frames `DjOyh`, `P0DQS`, `z6HKq` de `design/personalos.pen`). Elle donne l'apparence, ce ticket le périmètre : un élément de maquette absent du ticket n'est pas implémenté, ses textes de remplissage ne sont pas repris, et l'écran se compose avec les composants du design system (`docs/design-system.md`).
- La raison d'un rejet nomme l'allergène et le Compte concerné.

## Critères d'acceptation

- [ ] Le parcours génère → statuer → relancer → arrêter fonctionne avec le double IA.
- [ ] « Relancer » est désactivé tant qu'un repas attend une décision.

## Vérification

- `pnpm exec nx test dashboard` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.
- Captures : `scripts/captures.sh '/repas/planning?semaine=<lundi suivant>'` avec un tour proposé (double IA), et la page de trace.

## Pour la prod

Rien.

## Hors périmètre

Aucun.

## Dépendances

- CUISINE-16.
