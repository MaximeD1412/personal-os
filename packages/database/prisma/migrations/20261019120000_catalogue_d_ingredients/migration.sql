-- Pose le catalogue d'Ingrédients (CUISINE-1).
--
-- Conforme à l'ADR 0024 : cette migration n'ajoute que deux types et une
-- table. La version précédente de l'API, qui n'a pas de module `food`,
-- continue de fonctionner sans y toucher pendant la fenêtre de déploiement.
--
-- Le catalogue est global, hors Espace : la table n'a pas de `scopeId`.
-- L'unicité du nom normalisé est celle du catalogue : la base refuse
-- elle-même un doublon que deux saisies simultanées feraient passer.
--
-- De même, un poids à la pièce ne va qu'avec les grammes ou les pièces : deux
-- modifications simultanées (l'une passe en millilitres, l'autre pose un
-- poids) ne doivent pas le faire passer à deux. Prisma ne sait pas décrire une
-- contrainte CHECK : elle ne vit qu'ici, et le service la traduit en
-- `food.grams_per_piece_not_applicable`.

-- CreateEnum
CREATE TYPE "CanonicalUnit" AS ENUM ('GRAM', 'MILLILITER', 'PIECE');

-- CreateEnum
CREATE TYPE "Allergen" AS ENUM ('GLUTEN', 'CRUSTACEANS', 'EGGS', 'FISH', 'PEANUTS', 'SOY', 'MILK', 'TREE_NUTS', 'CELERY', 'MUSTARD', 'SESAME', 'SULPHITES', 'LUPIN', 'MOLLUSCS');

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "canonicalUnit" "CanonicalUnit" NOT NULL,
    "gramsPerPiece" DECIMAL(10,2),
    "allergens" "Allergen"[],
    "perishable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Ingredient_gramsPerPiece_unit_check" CHECK ("gramsPerPiece" IS NULL OR "canonicalUnit" IN ('GRAM', 'PIECE'))
);

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_name_key" ON "Ingredient"("name");

