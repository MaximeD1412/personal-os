-- Pose le Stock domestique (CUISINE-8).
--
-- Conforme à l'ADR 0024 : cette migration n'ajoute qu'une table. La version
-- précédente de l'API, qui ne la connaît pas, continue de fonctionner sans y
-- toucher pendant la fenêtre de déploiement.
--
-- Une seule ligne par Ingrédient dans un Espace (ADR 0013). La quantité est
-- positive ou nulle, et une ligne à zéro ne garde pas de péremption : le
-- recaleur s'en charge, ces deux contraintes CHECK, que Prisma ne sait pas
-- décrire, l'assurent en base.

-- CreateTable
CREATE TABLE "PantryItem" (
    "id" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "expiresOn" DATE,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PantryItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PantryItem_quantity_check" CHECK ("quantity" >= 0),
    CONSTRAINT "PantryItem_expiresOn_check" CHECK ("quantity" > 0 OR "expiresOn" IS NULL)
);

-- CreateIndex
CREATE INDEX "PantryItem_ingredientId_idx" ON "PantryItem"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "PantryItem_scopeId_ingredientId_key" ON "PantryItem"("scopeId", "ingredientId");

-- AddForeignKey
ALTER TABLE "PantryItem" ADD CONSTRAINT "PantryItem_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "Scope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PantryItem" ADD CONSTRAINT "PantryItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
