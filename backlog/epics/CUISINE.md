---
id: EPIC-CUISINE
title: "[EPIC] CUISINE : ingrédients, recettes, planning, courses, stock et génération IA"
labels: [epic:cuisine]
---

## Objectif

La chaîne alimentation complète, priorité du produit. Socle (M2) : catalogue d'Ingrédients et Alias, conversion en Unité canonique, Recettes, Planning de repas saisi à la main, Stock domestique, liste de courses figée et sa clôture, Repas cuisiné. Boucle (M3) : génération IA du planning par Tours de génération, avec Souhaits et contrôle déterministe des allergies, Produits et arrondi au conditionnement, écart avec la liste figée.

Le module Nest est unique (`food`) : recettes, planning, courses, produits et stock partagent leur cœur (PRD #1). Tout vit dans l'Espace foyer, que le module pose lui-même (ADR 0030).

## Décisions

ADR 0012, 0013, 0017, 0030. Risques : IA-1, IA-2, IA-3, CUI-1, CUI-2, CUI-3, SEC-6.

## Issues

Ordre conseillé : CUISINE-1 → CUISINE-2, CUISINE-3 → CUISINE-5 → CUISINE-6, CUISINE-7, CUISINE-8 → CUISINE-9 → CUISINE-10, CUISINE-11 ; puis CUISINE-14, CUISINE-15, CUISINE-18 → CUISINE-16 → CUISINE-17 ; CUISINE-12, CUISINE-13, CUISINE-19, CUISINE-4.
