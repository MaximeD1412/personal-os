-- Pose les Listes de courses et leurs Articles (CUISINE-9).
--
-- Conforme à l'ADR 0024 : cette migration n'ajoute que des types et des
-- tables. La version précédente de l'API, qui ne les connaît pas, continue de
-- fonctionner sans y toucher pendant la fenêtre de déploiement.
--
-- Un Article porte un Ingrédient ou un libellé, jamais les deux ni aucun ; issu
-- du planning, il porte toujours un Ingrédient et sa quantité. Sa quantité est
-- strictement positive, et son unité n'a de sens qu'avec un Ingrédient et une
-- quantité. Une liste close a une date de clôture, une liste ouverte n'en a
-- pas. Ces contraintes CHECK, que Prisma ne sait pas décrire, le gardent en
-- base.

-- CreateEnum
CREATE TYPE "ShoppingListStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ShoppingListItemOrigin" AS ENUM ('PLAN', 'MANUAL');

-- CreateTable
CREATE TABLE "ShoppingList" (
    "id" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "mealPlanId" TEXT,
    "status" "ShoppingListStatus" NOT NULL DEFAULT 'OPEN',
    "producedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ShoppingList_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ShoppingList_closedAt_check" CHECK (("status" = 'CLOSED') = ("closedAt" IS NOT NULL))
);

-- CreateTable
CREATE TABLE "ShoppingListItem" (
    "id" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "shoppingListId" TEXT NOT NULL,
    "ingredientId" TEXT,
    "label" TEXT,
    "quantity" DECIMAL(12,3),
    "unit" "CanonicalUnit",
    "origin" "ShoppingListItemOrigin" NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,

    CONSTRAINT "ShoppingListItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ShoppingListItem_designation_check" CHECK (("ingredientId" IS NULL) <> ("label" IS NULL)),
    CONSTRAINT "ShoppingListItem_plan_check" CHECK ("origin" = 'MANUAL' OR ("ingredientId" IS NOT NULL AND "quantity" IS NOT NULL)),
    CONSTRAINT "ShoppingListItem_quantity_check" CHECK ("quantity" > 0),
    CONSTRAINT "ShoppingListItem_unit_check" CHECK (("unit" IS NOT NULL) = ("ingredientId" IS NOT NULL AND "quantity" IS NOT NULL)),
    CONSTRAINT "ShoppingListItem_position_check" CHECK ("position" >= 0)
);

-- CreateIndex
CREATE INDEX "ShoppingList_scopeId_status_idx" ON "ShoppingList"("scopeId", "status");

-- CreateIndex
CREATE INDEX "ShoppingList_mealPlanId_idx" ON "ShoppingList"("mealPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "ShoppingList_id_scopeId_key" ON "ShoppingList"("id", "scopeId");

-- CreateIndex
CREATE INDEX "ShoppingListItem_scopeId_idx" ON "ShoppingListItem"("scopeId");

-- CreateIndex
CREATE INDEX "ShoppingListItem_ingredientId_idx" ON "ShoppingListItem"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "ShoppingListItem_shoppingListId_position_key" ON "ShoppingListItem"("shoppingListId", "position");

-- AddForeignKey
ALTER TABLE "ShoppingList" ADD CONSTRAINT "ShoppingList_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "Scope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingList" ADD CONSTRAINT "ShoppingList_mealPlanId_scopeId_fkey" FOREIGN KEY ("mealPlanId", "scopeId") REFERENCES "MealPlan"("id", "scopeId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingListItem" ADD CONSTRAINT "ShoppingListItem_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "Scope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingListItem" ADD CONSTRAINT "ShoppingListItem_shoppingListId_scopeId_fkey" FOREIGN KEY ("shoppingListId", "scopeId") REFERENCES "ShoppingList"("id", "scopeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingListItem" ADD CONSTRAINT "ShoppingListItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

