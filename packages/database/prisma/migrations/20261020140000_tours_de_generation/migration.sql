-- Pose les Tours de génération d'un Planning de repas, et le tour qui a
-- proposé chaque repas (CUISINE-15).
--
-- Conforme à l'ADR 0024 : cette migration n'ajoute qu'une table et une colonne
-- facultative. La version précédente de l'API, qui ne les connaît pas,
-- continue d'écrire des repas sans tour pendant la fenêtre de déploiement.
--
-- Un tour se numérote à partir de 1, une fois par planning. Prisma ne sachant
-- pas décrire la contrainte CHECK, elle ne vit qu'ici.
--
-- Les clés étrangères d'un repas vers son tour, et d'un tour vers sa Trace
-- IA, portent l'Espace avec elles (ADR 0028) : la cible gagne pour cela un
-- index unique sur `(id, scopeId)`, toujours satisfait puisque `id` est sa
-- clé primaire. Elles sont en `NO ACTION` : un tour ne se supprime qu'avec son
-- planning, qui emporte ses repas dans la même instruction, et une Trace IA,
-- d'un journal en ajout seul, ne se supprime pas.

-- AlterTable
ALTER TABLE "MealPlanEntry" ADD COLUMN     "generationRoundId" TEXT;

-- CreateTable
CREATE TABLE "GenerationRound" (
    "id" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "mealPlanId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "traceId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationRound_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GenerationRound_number_check" CHECK ("number" >= 1)
);

-- CreateIndex
CREATE INDEX "GenerationRound_scopeId_idx" ON "GenerationRound"("scopeId");

-- CreateIndex
CREATE INDEX "GenerationRound_traceId_idx" ON "GenerationRound"("traceId");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationRound_mealPlanId_number_key" ON "GenerationRound"("mealPlanId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationRound_id_scopeId_key" ON "GenerationRound"("id", "scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "AiTrace_id_scopeId_key" ON "AiTrace"("id", "scopeId");

-- CreateIndex
CREATE INDEX "MealPlanEntry_generationRoundId_idx" ON "MealPlanEntry"("generationRoundId");

-- AddForeignKey
ALTER TABLE "MealPlanEntry" ADD CONSTRAINT "MealPlanEntry_generationRoundId_scopeId_fkey" FOREIGN KEY ("generationRoundId", "scopeId") REFERENCES "GenerationRound"("id", "scopeId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationRound" ADD CONSTRAINT "GenerationRound_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "Scope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationRound" ADD CONSTRAINT "GenerationRound_mealPlanId_scopeId_fkey" FOREIGN KEY ("mealPlanId", "scopeId") REFERENCES "MealPlan"("id", "scopeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationRound" ADD CONSTRAINT "GenerationRound_traceId_scopeId_fkey" FOREIGN KEY ("traceId", "scopeId") REFERENCES "AiTrace"("id", "scopeId") ON DELETE NO ACTION ON UPDATE CASCADE;
