-- Pose la trace d'un appel au modèle d'IA (CUISINE-14).
--
-- Conforme à l'ADR 0024 : cette migration n'ajoute qu'une table. La version
-- précédente de l'API, qui n'appelle aucun modèle, continue de fonctionner
-- sans y toucher pendant la fenêtre de déploiement.
--
-- La table est un journal en ajout seul, dans l'Espace foyer. Le plafond de
-- coût du mois se calcule sur "costCents" et "createdAt", d'où l'index.

-- CreateTable
CREATE TABLE "AiTrace" (
    "id" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "output" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "costCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiTrace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiTrace_scopeId_idx" ON "AiTrace"("scopeId");

-- CreateIndex
CREATE INDEX "AiTrace_createdAt_idx" ON "AiTrace"("createdAt");

-- AddForeignKey
ALTER TABLE "AiTrace" ADD CONSTRAINT "AiTrace_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "Scope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

