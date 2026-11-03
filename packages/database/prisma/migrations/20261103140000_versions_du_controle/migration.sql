-- Ce qu'un Tour de génération a contrôlé ne doit pas changer avant qu'il
-- écrive (CUISINE-16) : le planning et ses repas, les Ingrédients (leurs
-- Allergènes) et les Préférences alimentaires de chaque Compte portent une
-- version, que l'écriture du tour compare à celle qu'il a lue.
--
-- Conforme à l'ADR 0024 : trois colonnes ajoutées, avec une valeur par
-- défaut. La version précédente de l'API les ignore ; pendant le
-- déploiement, une écriture qu'elle ferait ne ferait pas grandir la version.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "foodPreferencesVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Ingredient" ADD COLUMN     "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "MealPlan" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;
