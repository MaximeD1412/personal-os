-- Pose les Recettes et leurs lignes (CUISINE-5).
--
-- Conforme à l'ADR 0024 : cette migration n'ajoute que deux types et deux
-- tables. La version précédente de l'API, qui ne connaît pas les Recettes,
-- continue de fonctionner sans y toucher pendant la fenêtre de déploiement.
--
-- Une ligne porte l'Espace de sa Recette : la clé étrangère compare aussi
-- `scopeId` (ADR 0028), si bien que la base refuse une ligne rangée ailleurs
-- que sa recette. Un Ingrédient cité ne se supprime pas (RESTRICT).
--
-- Les portions de référence et les quantités sont strictement positives.
-- Prisma ne sait pas décrire une contrainte CHECK : elles ne vivent qu'ici, en
-- dernier rempart derrière les schémas de `contracts`.

-- CreateEnum
CREATE TYPE "RecipeUnit" AS ENUM ('G', 'KG', 'MG', 'ML', 'CL', 'L', 'TSP', 'TBSP', 'PIECE');

-- CreateEnum
CREATE TYPE "RecipeSource" AS ENUM ('MANUAL', 'GENERATED');

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "servings" INTEGER NOT NULL,
    "steps" TEXT[],
    "source" "RecipeSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Recipe_servings_check" CHECK ("servings" >= 1)
);

-- CreateTable
CREATE TABLE "RecipeLine" (
    "id" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" "RecipeUnit" NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "RecipeLine_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RecipeLine_quantity_check" CHECK ("quantity" > 0)
);

-- CreateIndex
CREATE INDEX "Recipe_scopeId_idx" ON "Recipe"("scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_id_scopeId_key" ON "Recipe"("id", "scopeId");

-- CreateIndex
CREATE INDEX "RecipeLine_scopeId_idx" ON "RecipeLine"("scopeId");

-- CreateIndex
CREATE INDEX "RecipeLine_ingredientId_idx" ON "RecipeLine"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeLine_recipeId_position_key" ON "RecipeLine"("recipeId", "position");

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "Scope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeLine" ADD CONSTRAINT "RecipeLine_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "Scope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeLine" ADD CONSTRAINT "RecipeLine_recipeId_scopeId_fkey" FOREIGN KEY ("recipeId", "scopeId") REFERENCES "Recipe"("id", "scopeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeLine" ADD CONSTRAINT "RecipeLine_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
