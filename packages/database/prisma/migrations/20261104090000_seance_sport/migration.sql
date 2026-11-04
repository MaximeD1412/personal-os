-- Pose la Séance du module Sport (SPORT-1).
--
-- Conforme à l'ADR 0024 : cette migration n'ajoute que deux types et une
-- table. La version précédente de l'API, qui n'a pas de module Sport, continue
-- de fonctionner sans y toucher pendant la fenêtre de déploiement.
--
-- "goalId" n'a pas encore de clé étrangère : l'Objectif arrive avec SPORT-2,
-- qui la posera.

-- CreateEnum
CREATE TYPE "TrainingSport" AS ENUM ('RUN', 'BIKE', 'SWIM', 'STRENGTH', 'OTHER');

-- CreateEnum
CREATE TYPE "TrainingSessionStatus" AS ENUM ('PLANNED', 'DONE', 'MISSED');

-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "sport" "TrainingSport" NOT NULL,
    "status" "TrainingSessionStatus" NOT NULL,
    "plannedDistanceM" INTEGER,
    "plannedDurationS" INTEGER,
    "plannedIntent" TEXT,
    "actualDistanceM" INTEGER,
    "actualDurationS" INTEGER,
    "actualNotes" TEXT,
    "goalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingSession_scopeId_idx" ON "TrainingSession"("scopeId");

-- CreateIndex
CREATE INDEX "TrainingSession_startsAt_idx" ON "TrainingSession"("startsAt");

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "Scope"("id") ON DELETE CASCADE ON UPDATE CASCADE;
