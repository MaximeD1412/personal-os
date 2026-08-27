-- Pose le Foyer, l'Espace et l'entité jouet du fil traceur.
--
-- Conforme à l'ADR 0024 : cette migration n'enlève rien. La colonne
-- "User"."householdId" porte une valeur par défaut, de sorte que la version
-- précédente de l'API — qui ignore tout du Foyer — continue de créer des
-- Comptes sans échouer pendant la fenêtre de déploiement.

-- CreateEnum
CREATE TYPE "ScopeKind" AS ENUM ('PERSONAL', 'HOUSEHOLD');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "householdId" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111';

-- CreateTable
CREATE TABLE "Household" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Household_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scope" (
    "id" TEXT NOT NULL,
    "kind" "ScopeKind" NOT NULL,
    "label" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "holderId" TEXT,

    CONSTRAINT "Scope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trace" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Scope_holderId_key" ON "Scope"("holderId");

-- CreateIndex
CREATE INDEX "Scope_householdId_idx" ON "Scope"("householdId");

-- CreateIndex
CREATE INDEX "Trace_scopeId_idx" ON "Trace"("scopeId");

-- AddForeignKey
ALTER TABLE "Scope" ADD CONSTRAINT "Scope_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scope" ADD CONSTRAINT "Scope_holderId_fkey" FOREIGN KEY ("holderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Le Foyer est unique et son identifiant est fixe : c'est lui que porte la
-- valeur par défaut de "User"."householdId". Il doit exister avant que la clé
-- étrangère ne soit posée, sinon les Comptes déjà en base la violeraient.
INSERT INTO "Household" ("id", "name", "createdAt")
VALUES ('11111111-1111-4111-8111-111111111111', 'Foyer', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- L'Espace du Foyer, lui aussi posé une fois pour toutes. Les Espaces
-- personnels, eux, naissent avec leur Compte.
INSERT INTO "Scope" ("id", "kind", "label", "householdId", "holderId")
VALUES (
    '22222222-2222-4222-8222-222222222222',
    'HOUSEHOLD',
    'Foyer',
    '11111111-1111-4111-8111-111111111111',
    NULL
)
ON CONFLICT ("id") DO NOTHING;

-- Un Compte créé avant cette migration n'a pas d'Espace personnel : on le lui
-- donne ici, plutôt que d'attendre sa prochaine connexion.
INSERT INTO "Scope" ("id", "kind", "label", "householdId", "holderId")
SELECT
    gen_random_uuid(),
    'PERSONAL',
    COALESCE("User"."displayName", "User"."email"),
    "User"."householdId",
    "User"."id"
FROM "User"
WHERE NOT EXISTS (
    SELECT 1 FROM "Scope" WHERE "Scope"."holderId" = "User"."id"
);

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trace" ADD CONSTRAINT "Trace_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "Scope"("id") ON DELETE CASCADE ON UPDATE CASCADE;
