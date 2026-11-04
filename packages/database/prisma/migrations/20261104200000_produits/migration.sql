-- Pose les Produits, le Produit préféré d'un Ingrédient et le conditionnement
-- d'un Article de courses (CUISINE-12).
--
-- Conforme à l'ADR 0024 : cette migration n'ajoute qu'un type, une table et
-- des colonnes facultatives. La version précédente de l'API ne les connaît
-- pas et continue de fonctionner sans elles pendant la fenêtre de déploiement.
--
-- Un conditionnement contient une quantité strictement positive, et porte un
-- nom. Un Article porte son conditionnement entier ou pas du tout : le nombre,
-- la quantité d'un conditionnement et son nom, figés à la production
-- (ADR 0012), sur un article d'Ingrédient qui a une quantité. Le Produit qui
-- l'a donné peut avoir été retiré depuis, jamais l'inverse. Ces contraintes
-- CHECK, que Prisma ne sait pas décrire, le gardent en base.

-- CreateEnum
CREATE TYPE "ProductForm" AS ENUM ('FRESH', 'FROZEN', 'CANNED', 'DRY', 'OTHER');

-- AlterTable
ALTER TABLE "Ingredient" ADD COLUMN     "preferredProductId" TEXT;

-- AlterTable
ALTER TABLE "ShoppingListItem" ADD COLUMN     "packageLabel" TEXT,
ADD COLUMN     "packageQuantity" DECIMAL(12,3),
ADD COLUMN     "packages" INTEGER,
ADD COLUMN     "productId" TEXT,
ADD CONSTRAINT "ShoppingListItem_package_check" CHECK (
    ("packages" IS NULL) = ("packageQuantity" IS NULL)
    AND ("packages" IS NULL) = ("packageLabel" IS NULL)
    AND ("packages" IS NULL OR ("ingredientId" IS NOT NULL AND "quantity" IS NOT NULL))
    AND ("productId" IS NULL OR "packages" IS NOT NULL)
),
ADD CONSTRAINT "ShoppingListItem_packages_check" CHECK ("packages" > 0 AND "packageQuantity" > 0);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "brand" TEXT,
    "form" "ProductForm" NOT NULL,
    "packageQuantity" DECIMAL(12,3) NOT NULL,
    "packageLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Product_packageQuantity_check" CHECK ("packageQuantity" > 0)
);

-- CreateIndex
CREATE INDEX "Product_ingredientId_idx" ON "Product"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_preferredProductId_key" ON "Ingredient"("preferredProductId");

-- CreateIndex
CREATE INDEX "ShoppingListItem_productId_idx" ON "ShoppingListItem"("productId");

-- AddForeignKey
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_preferredProductId_fkey" FOREIGN KEY ("preferredProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingListItem" ADD CONSTRAINT "ShoppingListItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
