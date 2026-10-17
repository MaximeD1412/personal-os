---
id: INFRA-5
title: "Scan de secrets en CI"
epic: INFRA
type: chore
priority: P1
size: S
milestone: M0 Outillage agents et staging
blocked_by: []
adr: []
risques: [SEC-5]
revue_visuelle: false
---

## Contexte

Des agents commitent sans relecture humaine du code. Un secret commité par erreur doit faire échouer la PR avant le merge.

## État actuel du code

- `.github/workflows/verify.yml` : campagne de vérification ; aucun scan de secrets.
- Les modèles `*.env.example` contiennent des valeurs factices volontaires.

## À faire

- Job `secrets` dans `verify.yml` : `gitleaks` (action officielle `gitleaks/gitleaks-action`, version épinglée par SHA) sur l'historique de la PR (`fetch-depth: 0`).
- `.gitleaks.toml` : configuration par défaut étendue, avec une liste d'autorisation limitée aux fichiers `*.example` et aux fixtures de test nommées.

## Décisions déjà prises

- Aucun contournement par commentaire dans le code : une exception passe par `.gitleaks.toml`, relu en revue.

## Critères d'acceptation

- [ ] Une PR qui ajoute une clé factice au format réel (ex. `ghp_` + 36 caractères) échoue.
- [ ] La campagne actuelle reste verte.

## Vérification

- `docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:latest detect --source /repo --config /repo/.gitleaks.toml` en local.

## Pour la prod

Rien.

## Hors périmètre

Aucun.

## Dépendances

Aucune.
