---
id: SOCLE-2
title: "Enveloppe d'erreur unique : filtre global pour les erreurs métier, zod et la garde d'Espace"
epic: SOCLE
type: chore
priority: P0
size: S
milestone: M0 Outillage agents et staging
blocked_by: [SOCLE-1]
adr: [0030, 0028]
risques: [AG-2]
revue_visuelle: false
---

## Contexte

L'ADR 0030 fixe une enveloppe unique `{ status, code, message, fields? }` et les statuts : 400 schéma, 401 session, 403 Espace refusé, 404 absent ou hors Espace, 422 règle métier, 500 défaut.

## État actuel du code

- Erreurs Nest par défaut (`BadRequestException('...')`) dans les services.
- `packages/api/src/app/espace/erreur-d-espace.filter.ts` : traduit `ErreurDEspace` (raisons `hors-portee`, `type-refuse` → 403 ; `absent` → 422 ; `sans-portee` → 500).
- `packages/api/src/app/auth/auth.guard.ts` : 401 sans session.

## À faire

- `packages/contracts/src/lib/erreur.ts` : schéma `zApiError` (`status`, `code`, `message`, `fields?: { path, code, message }[]`) et son type `ApiError`.
- `packages/api/src/app/erreurs/` :
  - `ErreurMetier` (classe) : `new ErreurMetier(code, message, status = 422)` ; `Introuvable(code, message)` pour les 404 ;
  - `ErreursFilter` global (`APP_FILTER`) qui produit l'enveloppe à partir de : `ErreurMetier`, `ZodValidationException` (400, `code: 'request.invalid'`, `fields` depuis les issues zod, `path` joint par des points), `ErreurDEspace` (reprend la table de `erreur-d-espace.filter.ts`, codes `scope.out_of_reach`, `scope.kind_refused`, `scope.missing`, `scope.undeclared`), `HttpException` restantes (code `http.<status>`, message de l'exception), et toute autre erreur (500, `code: 'internal'`, message générique, erreur journalisée).
- Supprimer `erreur-d-espace.filter.ts`, absorbé par le filtre global.
- La garde de session renvoie l'enveloppe en 401 (`code: 'auth.required'`).

## Décisions déjà prises

- `message` est toujours en français et affichable tel quel ; une 500 ne divulgue jamais le détail.
- Codes : anglais, `snake_case` après le point, préfixe du module.

## Critères d'acceptation

- [ ] Chacune des cinq sources d'erreur produit l'enveloppe avec le bon statut et un `code`.
- [ ] Une erreur zod sur un champ imbriqué donne `fields[0].path` sous la forme `a.b.0.c`.
- [ ] Une 500 ne contient ni pile ni message interne.

## Vérification

- Tests unitaires du filtre (`pnpm exec nx test api -- erreurs`) ; les tests d'intégration existants mis à jour à la nouvelle forme (`pnpm exec nx test-integration api`).

## Pour la prod

Rien.

## Hors périmètre

- La migration des services existants vers `ErreurMetier` : SOCLE-3.

## Dépendances

- SOCLE-1.
