-- Pose l'Événement, l'entrée du Calendrier.
--
-- Conforme à l'ADR 0024 : cette migration n'ajoute qu'une table et son type.
-- La version précédente de l'API, qui ignore tout de l'Événement, continue de
-- fonctionner sans y toucher pendant la fenêtre de déploiement.
--
-- « DEADLINE » est la catégorie dédiée qui fait d'un Événement une Échéance.
-- Aucune table ne matérialise ni l'Échéance ni le rappel (ADR 0017) : le
-- rappel est la colonne "reminderLeadMinutes", un délai et non un objet.

-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('APPOINTMENT', 'BIRTHDAY', 'DEADLINE', 'OTHER');

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "category" "EventCategory" NOT NULL,
    "reminderLeadMinutes" INTEGER,
    "scopeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_scopeId_idx" ON "Event"("scopeId");

-- CreateIndex
CREATE INDEX "Event_startsAt_idx" ON "Event"("startsAt");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "Scope"("id") ON DELETE CASCADE ON UPDATE CASCADE;
