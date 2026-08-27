-- Remplace progressivement la relation singulière User.householdId par une
-- appartenance explicite. La colonne existante reste en place pendant la
-- fenêtre de compatibilité avec l'ancienne version de l'API.

-- CreateEnum
CREATE TYPE "HouseholdRole" AS ENUM ('MEMBER', 'ADMIN');

-- Un Espace personnel appartient à son Compte, pas à l'un de ses foyers.
-- Les espaces foyer conservent leur clé étrangère vers Household.
ALTER TABLE "Scope" ALTER COLUMN "householdId" DROP NOT NULL;
UPDATE "Scope" SET "householdId" = NULL WHERE "kind" = 'PERSONAL';

-- CreateTable
CREATE TABLE "HouseholdMember" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "HouseholdRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HouseholdMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HouseholdMember_householdId_userId_key" ON "HouseholdMember"("householdId", "userId");

-- CreateIndex
CREATE INDEX "HouseholdMember_userId_idx" ON "HouseholdMember"("userId");

-- AddForeignKey
ALTER TABLE "HouseholdMember" ADD CONSTRAINT "HouseholdMember_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdMember" ADD CONSTRAINT "HouseholdMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill the explicit membership from the compatibility column. It is
-- idempotent so a restored database can replay deployment safely.
INSERT INTO "HouseholdMember" ("id", "householdId", "userId", "role", "createdAt")
SELECT gen_random_uuid(), "householdId", "id", 'MEMBER', CURRENT_TIMESTAMP
FROM "User"
ON CONFLICT ("householdId", "userId") DO NOTHING;
