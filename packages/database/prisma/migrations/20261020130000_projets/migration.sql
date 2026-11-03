-- Pose le Projet et ses dépenses (PORTFOLIO-1).
--
-- Conforme à l'ADR 0024 : cette migration n'ajoute que deux tables. La version
-- précédente de l'API, qui ignore tout des Projets, continue de fonctionner
-- sans y toucher pendant la fenêtre de déploiement.
--
-- La clé étrangère d'une dépense porte l'Espace avec le Projet : une dépense
-- est toujours dans l'Espace de son Projet. Le montant est en centimes, jamais
-- négatif.

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "links" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectExpense" (
    "id" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "spentOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Project_scopeId_idx" ON "Project"("scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_id_scopeId_key" ON "Project"("id", "scopeId");

-- CreateIndex
CREATE INDEX "ProjectExpense_scopeId_idx" ON "ProjectExpense"("scopeId");

-- CreateIndex
CREATE INDEX "ProjectExpense_projectId_idx" ON "ProjectExpense"("projectId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "Scope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectExpense" ADD CONSTRAINT "ProjectExpense_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "Scope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectExpense" ADD CONSTRAINT "ProjectExpense_projectId_scopeId_fkey" FOREIGN KEY ("projectId", "scopeId") REFERENCES "Project"("id", "scopeId") ON DELETE CASCADE ON UPDATE CASCADE;


-- Un montant n'est jamais négatif : le contrat le refuse, la base aussi.
ALTER TABLE "ProjectExpense" ADD CONSTRAINT "ProjectExpense_amountCents_check" CHECK ("amountCents" >= 0);
