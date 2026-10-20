-- Pose les Souhaits : une Recette ou une envie déposée avant la génération
-- d'une semaine (CUISINE-18).
--
-- Conforme à l'ADR 0024 : cette migration n'ajoute qu'une table. La version
-- précédente de l'API, qui ne la connaît pas, continue de fonctionner sans y
-- toucher pendant la fenêtre de déploiement.
--
-- Un Souhait porte une Recette ou un texte, jamais les deux ni aucun. Le
-- schéma d'entrée les refuse déjà (400) : Prisma ne sachant pas décrire la
-- contrainte CHECK, elle ne vit qu'ici.
--
-- La clé étrangère vers la Recette porte l'Espace avec elle (ADR 0028). Elle
-- est en `NO ACTION`, mais un déclencheur remplace d'abord, avant la
-- suppression d'une recette, la recette de ses Souhaits par son titre. La
-- règle vit dans la base, et non dans l'API : la version précédente, qui
-- supprime une recette sans connaître les Souhaits, continue de le faire
-- (ADR 0024).

-- CreateTable
CREATE TABLE "MealWish" (
    "id" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "week" DATE NOT NULL,
    "recipeId" TEXT,
    "text" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealWish_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MealWish_wish_check" CHECK (("recipeId" IS NULL) <> ("text" IS NULL))
);

-- CreateIndex
CREATE INDEX "MealWish_scopeId_week_idx" ON "MealWish"("scopeId", "week");

-- CreateIndex
CREATE INDEX "MealWish_recipeId_idx" ON "MealWish"("recipeId");

-- CreateIndex
CREATE INDEX "MealWish_authorId_idx" ON "MealWish"("authorId");

-- AddForeignKey
ALTER TABLE "MealWish" ADD CONSTRAINT "MealWish_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "Scope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealWish" ADD CONSTRAINT "MealWish_recipeId_scopeId_fkey" FOREIGN KEY ("recipeId", "scopeId") REFERENCES "Recipe"("id", "scopeId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealWish" ADD CONSTRAINT "MealWish_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Une recette supprimée laisse son titre à ses Souhaits.
CREATE FUNCTION "meal_wish_garde_le_titre"() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE "MealWish"
    SET "recipeId" = NULL, "text" = OLD."title"
    WHERE "recipeId" = OLD."id";
    RETURN OLD;
END;
$$;

CREATE TRIGGER "Recipe_meal_wish_garde_le_titre"
BEFORE DELETE ON "Recipe"
FOR EACH ROW EXECUTE FUNCTION "meal_wish_garde_le_titre"();
