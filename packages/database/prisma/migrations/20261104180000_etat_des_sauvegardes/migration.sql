-- Pose l'état des sauvegardes (DASH-3) : le dernier résultat transmis par
-- l'agent de sauvegarde, en une seule rangée hors Espace.
--
-- Conforme à l'ADR 0024 : cette migration n'ajoute qu'une table. La version
-- précédente de l'API ne la connaît pas et continue de fonctionner sans elle.

-- CreateTable
CREATE TABLE "BackupStatus" (
    "id" TEXT NOT NULL DEFAULT 'backup',
    "lastSuccessAt" TIMESTAMPTZ(3),
    "lastRunAt" TIMESTAMPTZ(3) NOT NULL,
    "lastError" TEXT,

    CONSTRAINT "BackupStatus_pkey" PRIMARY KEY ("id")
);
