-- Pose l'Objectif sportif (SPORT-2), et la clé étrangère que la Séance
-- attendait depuis SPORT-1.
--
-- Conforme à l'ADR 0024 : cette migration n'ajoute qu'une table, un index et
-- une clé étrangère. La version précédente de l'API n'écrit jamais "goalId" :
-- elle continue de fonctionner sans rien savoir de l'Objectif.
--
-- La clé de la Séance vers son Objectif compare aussi "scopeId" : une Séance
-- ne peut citer que l'Objectif de son propre Espace (ADR 0028). Supprimer un
-- Objectif retire d'abord le lien de ses Séances, jamais les Séances : l'API
-- le fait dans la même transaction, et la base refuse un Objectif encore cité.

-- CreateTable
CREATE TABLE "TrainingGoal" (
    "id" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "intent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingGoal_scopeId_idx" ON "TrainingGoal"("scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingGoal_id_scopeId_key" ON "TrainingGoal"("id", "scopeId");

-- CreateIndex
CREATE INDEX "TrainingSession_goalId_idx" ON "TrainingSession"("goalId");

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_goalId_scopeId_fkey" FOREIGN KEY ("goalId", "scopeId") REFERENCES "TrainingGoal"("id", "scopeId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingGoal" ADD CONSTRAINT "TrainingGoal_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "Scope"("id") ON DELETE CASCADE ON UPDATE CASCADE;
