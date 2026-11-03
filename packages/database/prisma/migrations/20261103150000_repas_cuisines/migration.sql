-- Pose les Repas cuisinés (CUISINE-11).
--
-- Conforme à l'ADR 0024 : cette migration ajoute deux tables et un index
-- unique sur `MealPlanEntry` ("id", "scopeId"), que l'unicité de "id" rend
-- toujours satisfait. La version précédente de l'API ne connaît pas ces
-- tables et continue de fonctionner sans y toucher.
--
-- Un repas ne se cuisine qu'une fois. Les clés étrangères portent l'Espace
-- avec le repas, puis avec le Repas cuisiné (ADR 0028). Une ligne déclare une
-- quantité strictement positive : la contrainte CHECK, que Prisma ne sait pas
-- décrire, l'assure en base.

-- CreateTable
CREATE TABLE "CookedMeal" (
    "id" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "mealPlanEntryId" TEXT NOT NULL,
    "cookedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CookedMeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CookedMealLine" (
    "id" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "cookedMealId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" "RecipeUnit" NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "CookedMealLine_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CookedMealLine_quantity_check" CHECK ("quantity" > 0)
);

-- CreateIndex
CREATE INDEX "CookedMeal_scopeId_idx" ON "CookedMeal"("scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "CookedMeal_mealPlanEntryId_scopeId_key" ON "CookedMeal"("mealPlanEntryId", "scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "CookedMeal_id_scopeId_key" ON "CookedMeal"("id", "scopeId");

-- CreateIndex
CREATE INDEX "CookedMealLine_scopeId_idx" ON "CookedMealLine"("scopeId");

-- CreateIndex
CREATE INDEX "CookedMealLine_ingredientId_idx" ON "CookedMealLine"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "CookedMealLine_cookedMealId_position_key" ON "CookedMealLine"("cookedMealId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "MealPlanEntry_id_scopeId_key" ON "MealPlanEntry"("id", "scopeId");

-- AddForeignKey
ALTER TABLE "CookedMeal" ADD CONSTRAINT "CookedMeal_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "Scope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CookedMeal" ADD CONSTRAINT "CookedMeal_mealPlanEntryId_scopeId_fkey" FOREIGN KEY ("mealPlanEntryId", "scopeId") REFERENCES "MealPlanEntry"("id", "scopeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CookedMealLine" ADD CONSTRAINT "CookedMealLine_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "Scope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CookedMealLine" ADD CONSTRAINT "CookedMealLine_cookedMealId_scopeId_fkey" FOREIGN KEY ("cookedMealId", "scopeId") REFERENCES "CookedMeal"("id", "scopeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CookedMealLine" ADD CONSTRAINT "CookedMealLine_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

