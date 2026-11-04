-- Pose la Recette gardée (CUISINE-19).
--
-- Conforme à l'ADR 0024 : cette migration ajoute une colonne, sans rien
-- retirer. Son défaut, `true`, est celui d'une recette saisie : la version
-- précédente de l'API, qui ne connaît pas la colonne, continue d'écrire des
-- recettes saisies gardées. La nouvelle version pose `false` sur chaque
-- recette qu'un Tour de génération crée.
--
-- Les recettes générées avant cette migration ne sont pas gardées : elles
-- quittent « Mes recettes » et restent lisibles depuis le planning.

-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN "kept" BOOLEAN NOT NULL DEFAULT true;

-- Les recettes générées existantes
UPDATE "Recipe" SET "kept" = false WHERE "source" = 'GENERATED';
