-- Pose les Préférences alimentaires du Foyer (FOYER-2).
--
-- Conforme à l'ADR 0024 : cette migration n'ajoute qu'un type et une table.
-- La version précédente de l'API, qui ne les connaît pas, continue de
-- fonctionner sans y toucher pendant la fenêtre de déploiement.
--
-- Une Préférence vise soit un Allergène, soit un Ingrédient : la contrainte
-- CHECK refuse les deux comme aucun, que le schéma d'entrée refuse déjà en
-- 400. Prisma ne sait décrire ni elle, ni un index unique qui tient deux vides
-- pour égaux : ils ne vivent qu'ici. Sans `NULLS NOT DISTINCT`, la même
-- allergie d'un même Compte s'enregistrerait deux fois, son `ingredientId`
-- vide n'étant égal à aucun autre ; le service traduit la violation en
-- `food.preference_duplicate`.

-- CreateEnum
CREATE TYPE "FoodPreferenceKind" AS ENUM ('ALLERGY', 'EXCLUDED', 'DISLIKED');

-- CreateTable
CREATE TABLE "FoodPreference" (
    "id" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "FoodPreferenceKind" NOT NULL,
    "allergen" "Allergen",
    "ingredientId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoodPreference_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FoodPreference_target_check" CHECK (("allergen" IS NULL) <> ("ingredientId" IS NULL))
);

-- CreateIndex
CREATE INDEX "FoodPreference_scopeId_idx" ON "FoodPreference"("scopeId");

-- CreateIndex
CREATE INDEX "FoodPreference_ingredientId_idx" ON "FoodPreference"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "FoodPreference_userId_kind_allergen_ingredientId_key" ON "FoodPreference"("userId", "kind", "allergen", "ingredientId") NULLS NOT DISTINCT;

-- AddForeignKey
ALTER TABLE "FoodPreference" ADD CONSTRAINT "FoodPreference_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "Scope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodPreference" ADD CONSTRAINT "FoodPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodPreference" ADD CONSTRAINT "FoodPreference_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
