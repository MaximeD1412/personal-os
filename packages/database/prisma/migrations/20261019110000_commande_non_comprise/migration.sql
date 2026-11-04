-- Pose le journal des commandes non comprises par la barre (CMD-2).
--
-- Conforme à l'ADR 0024 : cette migration n'ajoute qu'une table. La version
-- précédente de l'API, qui n'a pas de barre de commande, continue de
-- fonctionner sans y toucher pendant la fenêtre de déploiement.
--
-- Le journal est en ajout seul, dans l'Espace personnel de l'auteur, et se
-- lit par curseur des plus récentes aux plus anciennes, d'où l'index.

-- CreateTable
CREATE TABLE "UnresolvedCommand" (
    "id" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnresolvedCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UnresolvedCommand_scopeId_createdAt_idx" ON "UnresolvedCommand"("scopeId", "createdAt");

-- AddForeignKey
ALTER TABLE "UnresolvedCommand" ADD CONSTRAINT "UnresolvedCommand_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "Scope"("id") ON DELETE CASCADE ON UPDATE CASCADE;
