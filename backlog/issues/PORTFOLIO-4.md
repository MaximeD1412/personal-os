---
id: PORTFOLIO-4
title: "Stockage objet OVH et CV en PDF téléversé"
epic: PORTFOLIO
type: feature
priority: P1
size: M
milestone: M6 Projets et portfolio
blocked_by: [SOCLE-3]
adr: [0019, 0020]
risques: [OPS-1]
revue_visuelle: true
reprend: 23
---

## Contexte

Le **CV** est un PDF rédigé hors de l'application et téléversé ; l'application se contente de le servir. Il faut pour cela un stockage objet compatible S3, que les sauvegardes prévoient déjà (« objets S3 », ADR 0020). Fournisseur retenu : OVH Object Storage.

## État actuel du code

- `infra/backup/` : vérifier si les objets S3 sont déjà inclus dans la sauvegarde Restic, sinon l'ajouter.

## À faire

- `packages/api/src/app/storage/` : port `StockageObjet` (`deposer`, `lire`, `supprimer`) ; adaptateur S3 (`@aws-sdk/client-s3`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`) ; adaptateur disque pour le local et les tests (`STORAGE_PROVIDER=disk|s3`).
- CV : `PUT /cv/:lang` (multipart, PDF uniquement vérifié par signature `%PDF-`, 5 Mo max, 422 `portfolio.cv_invalid`), `GET /cv/:lang` privé ; le portfolio le sert en `GET /public/cv/:lang` (PORTFOLIO-5).
- Écran `/portfolio/cv` : téléverser, remplacer, télécharger, par langue.
- Sauvegardes : le bucket est inclus dans la sauvegarde Restic.

## Décisions déjà prises

- Un CV par langue (FR, EN) ; pas d'historique des versions.

## Critères d'acceptation

- [ ] Un PDF se téléverse et se télécharge ; un fichier non PDF est refusé.
- [ ] Les tests tournent avec l'adaptateur disque, sans réseau.

## Vérification

- `pnpm exec nx test-integration api -- cv` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.
- Captures : `scripts/captures.sh /portfolio/cv`.

## Pour la prod

Ajouter à `docs/pilotage/mep.json` : créer le bucket OVH Object Storage et un utilisateur S3 limité à ce bucket, poser les variables `S3_*` et `STORAGE_PROVIDER=s3`, vérifier que la sauvegarde Restic inclut le bucket.

## Hors périmètre

- L'exposition publique : PORTFOLIO-5.

## Dépendances

- SOCLE-3.
