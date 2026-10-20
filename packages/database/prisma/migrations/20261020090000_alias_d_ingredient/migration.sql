-- Pose les Alias d'ingrédient (CUISINE-3).
--
-- Conforme à l'ADR 0024 : cette migration n'ajoute qu'une table. La version
-- précédente de l'API, qui ne connaît pas les Alias, continue de fonctionner
-- sans y toucher pendant la fenêtre de déploiement.
--
-- Comme le catalogue, la table est hors Espace : pas de `scopeId`. L'unicité
-- du libellé normalisé garantit qu'un libellé ne désigne qu'un Ingrédient,
-- même entre deux rattachements simultanés. La date de création est un
-- instant : elle est en `timestamptz` (ADR 0030).

-- CreateTable
CREATE TABLE "IngredientAlias" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngredientAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IngredientAlias_label_key" ON "IngredientAlias"("label");

-- CreateIndex
CREATE INDEX "IngredientAlias_ingredientId_idx" ON "IngredientAlias"("ingredientId");

-- AddForeignKey
ALTER TABLE "IngredientAlias" ADD CONSTRAINT "IngredientAlias_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
