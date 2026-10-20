-- Pose les Pages de contenu du portfolio, par langue (PORTFOLIO-3).
--
-- Conforme à l'ADR 0024 : cette migration n'ajoute qu'un type et une table.
-- La version précédente de l'API, qui les ignore, continue de fonctionner sans
-- y toucher pendant la fenêtre de déploiement.
--
-- Les Pages de contenu sont globales, hors Espace. Une page n'a qu'un texte
-- par langue.

-- CreateEnum
CREATE TYPE "PageSlug" AS ENUM ('about', 'experience', 'skills');

-- CreateTable
CREATE TABLE "PageContent" (
    "id" TEXT NOT NULL,
    "slug" "PageSlug" NOT NULL,
    "lang" "Lang" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "publicationState" "PublicationState" NOT NULL DEFAULT 'UNPUBLISHED',
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PageContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PageContent_slug_lang_key" ON "PageContent"("slug", "lang");
