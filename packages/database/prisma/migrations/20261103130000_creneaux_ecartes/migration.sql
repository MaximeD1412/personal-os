-- Garde, sur chaque Tour de génération, les créneaux que le contrôle
-- déterministe a vidés et la raison de chacun (CUISINE-16) : le tour suivant
-- les retente, et l'écran les affiche.
--
-- Conforme à l'ADR 0024 : une colonne ajoutée, avec une valeur par défaut. La
-- version précédente de l'API, qui ne la connaît pas, ne crée aucun tour.

-- AlterTable
ALTER TABLE "GenerationRound" ADD COLUMN     "rejected" JSONB NOT NULL DEFAULT '[]';
