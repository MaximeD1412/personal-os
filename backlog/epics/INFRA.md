---
id: EPIC-INFRA
title: "[EPIC] INFRA : outillage des agents, staging, déploiement poussé et exploitation"
labels: [epic:infra]
---

## Objectif

Rendre les agents autonomes de bout en bout : boucle d'agents partagée entre projets, worktrees isolés, jeu de démo, captures d'écran pour la revue visuelle, CI économe. Ajouter un staging de démonstration déployé à chaque merge sur `develop`, et un déploiement poussé par une clé SSH bridée dont le résultat se lit dans GitHub. Durcir ensuite l'exploitation (alerte de sauvegarde, provisionnement idempotent pour le homelab).

## Décisions

ADR 0020, 0024, 0031, 0032. ADR 0021 et 0023 remplacés.

## Issues

Ordre conseillé : INFRA-1, INFRA-2, INFRA-3, INFRA-6 → INFRA-10, INFRA-7 → INFRA-8 → INFRA-9 ; INFRA-4, INFRA-5, INFRA-13 à tout moment ; INFRA-11 en fin de parcours.
