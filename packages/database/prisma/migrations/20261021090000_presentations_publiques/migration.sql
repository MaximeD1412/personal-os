-- Pose la Présentation publique d'un Projet, par langue, et son État de
-- publication (PORTFOLIO-2).
--
-- Conforme à l'ADR 0024 : cette migration n'ajoute que deux types et une
-- table. La version précédente de l'API, qui les ignore, continue de
-- fonctionner sans y toucher pendant la fenêtre de déploiement.
--
-- La clé étrangère porte l'Espace avec le Projet : une présentation est
-- toujours dans l'Espace de son Projet. Une langue n'a qu'une présentation par
-- Projet.

-- CreateEnum
CREATE TYPE "Lang" AS ENUM ('FR', 'EN');

-- CreateEnum
CREATE TYPE "PublicationState" AS ENUM ('UNPUBLISHED', 'READY', 'PUBLISHED');

-- CreateTable
CREATE TABLE "PublicPresentation" (
    "id" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "lang" "Lang" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "publicationState" "PublicationState" NOT NULL DEFAULT 'UNPUBLISHED',
    "publishedAt" TIMESTAMPTZ(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PublicPresentation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublicPresentation_scopeId_idx" ON "PublicPresentation"("scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "PublicPresentation_projectId_lang_key" ON "PublicPresentation"("projectId", "lang");

-- AddForeignKey
ALTER TABLE "PublicPresentation" ADD CONSTRAINT "PublicPresentation_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "Scope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicPresentation" ADD CONSTRAINT "PublicPresentation_projectId_scopeId_fkey" FOREIGN KEY ("projectId", "scopeId") REFERENCES "Project"("id", "scopeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Un instant de mise en ligne n'existe que pour une présentation publiée.
ALTER TABLE "PublicPresentation" ADD CONSTRAINT "PublicPresentation_publishedAt_check" CHECK (("publicationState" = 'PUBLISHED') = ("publishedAt" IS NOT NULL));
