---
id: EPIC-CMD
title: "[EPIC] CMD : barre de commande"
labels: [epic:cmd]
---

## Objectif

Une barre en haut du tableau de bord : l'utilisateur écrit son intention en français, l'application ouvre l'écran concerné prérempli, et il confirme. Elle ne modifie jamais rien sans confirmation et ne répond jamais par une phrase. Catalogue fermé, généré au build depuis les endpoints annotés ; les phrases non comprises sont journalisées.

## Décisions

ADR 0018, 0030 (préremplissage par URL, extension `x-command`).

## Issues

Ordre conseillé : CMD-1 → CMD-2 → CMD-3 → CMD-4.
