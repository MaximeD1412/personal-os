-- Pose le Planning de repas et ses Repas planifiés (CUISINE-7).
--
-- Conforme à l'ADR 0024 : cette migration n'ajoute que des types et des
-- tables. La version précédente de l'API, qui ne les connaît pas, continue de
-- fonctionner sans y toucher pendant la fenêtre de déploiement.
--
-- Un repas porte une Recette ou un intitulé libre, jamais les deux ni aucun ;
-- il a au moins un Participant et jamais d'Invités en négatif. Le schéma
-- d'entrée et le service les refusent déjà (400, 422) : Prisma ne sachant pas
-- décrire ces contraintes CHECK, elles ne vivent qu'ici.
--
-- La clé étrangère vers la Recette refuse sa suppression : une recette
-- cuisinée par un repas à venir ne se supprime pas (`food.recipe_in_use`), et
-- le service remplace celle d'un repas passé par son titre avant de la
-- supprimer. Elle est en `NO ACTION`, qui lève 23503, et non en `RESTRICT`,
-- qui lèverait 23001, que Prisma ne traduit pas.

-- CreateEnum
CREATE TYPE "MealPlanStatus" AS ENUM ('OPEN', 'STOPPED');

-- CreateEnum
CREATE TYPE "MealMoment" AS ENUM ('LUNCH', 'DINNER');

-- CreateEnum
CREATE TYPE "MealPlanEntryDecision" AS ENUM ('APPROVED', 'PROPOSED', 'REFUSED');

-- CreateTable
CREATE TABLE "MealPlan" (
    "id" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "week" DATE NOT NULL,
    "status" "MealPlanStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPlanEntry" (
    "id" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "mealPlanId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "moment" "MealMoment" NOT NULL,
    "recipeId" TEXT,
    "title" TEXT,
    "participantIds" TEXT[],
    "guestCount" INTEGER NOT NULL DEFAULT 0,
    "decision" "MealPlanEntryDecision" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealPlanEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MealPlanEntry_dish_check" CHECK (("recipeId" IS NULL) <> ("title" IS NULL)),
    CONSTRAINT "MealPlanEntry_participants_check" CHECK (cardinality("participantIds") >= 1),
    CONSTRAINT "MealPlanEntry_guestCount_check" CHECK ("guestCount" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "MealPlan_scopeId_week_key" ON "MealPlan"("scopeId", "week");

-- CreateIndex
CREATE UNIQUE INDEX "MealPlan_id_scopeId_key" ON "MealPlan"("id", "scopeId");

-- CreateIndex
CREATE INDEX "MealPlanEntry_scopeId_idx" ON "MealPlanEntry"("scopeId");

-- CreateIndex
CREATE INDEX "MealPlanEntry_mealPlanId_idx" ON "MealPlanEntry"("mealPlanId");

-- CreateIndex
CREATE INDEX "MealPlanEntry_recipeId_idx" ON "MealPlanEntry"("recipeId");

-- CreateIndex
CREATE INDEX "MealPlanEntry_day_idx" ON "MealPlanEntry"("day");

-- AddForeignKey
ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "Scope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanEntry" ADD CONSTRAINT "MealPlanEntry_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "Scope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanEntry" ADD CONSTRAINT "MealPlanEntry_mealPlanId_scopeId_fkey" FOREIGN KEY ("mealPlanId", "scopeId") REFERENCES "MealPlan"("id", "scopeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanEntry" ADD CONSTRAINT "MealPlanEntry_recipeId_scopeId_fkey" FOREIGN KEY ("recipeId", "scopeId") REFERENCES "Recipe"("id", "scopeId") ON DELETE NO ACTION ON UPDATE CASCADE;

