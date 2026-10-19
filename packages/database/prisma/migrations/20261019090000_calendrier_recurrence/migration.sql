-- La récurrence des Événements : une règle sur l'Événement, et des exceptions
-- qui suppriment ou modifient une occurrence. Les occurrences elles-mêmes ne
-- sont jamais stockées : elles se calculent à la lecture.
--
-- Conforme à l'ADR 0024 : la migration n'ajoute qu'une colonne facultative,
-- une table, son type et un index unique sur un couple déjà unique (l'`id`
-- l'est seul). La version précédente de l'API ignore tout cela et continue de
-- fonctionner pendant la fenêtre de déploiement.
--
-- La clé étrangère d'une exception porte l'Espace avec l'Événement : une
-- exception est toujours dans l'Espace de sa série, et la suit (`ON UPDATE
-- CASCADE`) quand la série change d'Espace.

-- CreateEnum
CREATE TYPE "EventExceptionKind" AS ENUM ('CANCELLED', 'MODIFIED');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "recurrence" JSONB;

-- CreateTable
CREATE TABLE "EventException" (
    "id" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "originalStart" TIMESTAMP(3) NOT NULL,
    "kind" "EventExceptionKind" NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventException_scopeId_idx" ON "EventException"("scopeId");

-- CreateIndex
CREATE INDEX "EventException_startsAt_idx" ON "EventException"("startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventException_eventId_originalStart_key" ON "EventException"("eventId", "originalStart");

-- CreateIndex
CREATE UNIQUE INDEX "Event_id_scopeId_key" ON "Event"("id", "scopeId");

-- AddForeignKey
ALTER TABLE "EventException" ADD CONSTRAINT "EventException_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "Scope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventException" ADD CONSTRAINT "EventException_eventId_scopeId_fkey" FOREIGN KEY ("eventId", "scopeId") REFERENCES "Event"("id", "scopeId") ON DELETE CASCADE ON UPDATE CASCADE;

