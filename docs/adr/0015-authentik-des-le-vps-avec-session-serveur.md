# Authentik dès le VPS, l'API reste cliente OIDC avec session serveur

> **Statut :** accepté — 3 août 2026
> Prend le contre-pied du §11.1 de la note produit initiale, qui recommandait de démarrer avec une authentification NestJS maison.

Authentik est déployé dès le VPS et devient le fournisseur d'identité central, sans attendre le homelab. La raison est qu'il n'y a qu'une seule migration d'authentification à faire, et qu'il vaut mieux la faire avant qu'il n'existe des comptes, des sessions et des données rattachées. Authentik servira ensuite les autres services personnels (Grafana, outils d'administration).

L'API est un **client OIDC ordinaire** : elle échange le code d'autorisation, récupère l'identité, puis émet **sa propre session serveur** avec cookie `HttpOnly` — conforme au §11.3. Elle conserve une table `User` locale reliée au sujet Authentik.

La frontière est nette : **Authentik répond à « qui es-tu », l'application répond à « que peux-tu voir »**. Les **Espaces** et la propriété des données sont des notions applicatives et ne sont jamais déléguées à l'IdP.

## Options écartées

- **Authentification maison dans NestJS** (recommandation initiale de la note). Phase 0 plus courte, mais une migration OIDC à faire plus tard sur un système déjà peuplé.
- **Forward auth au niveau de Caddy** (outpost Authentik injectant des en-têtes). Presque aucun code d'authentification côté application, mais toute la sécurité repose sur l'impossibilité de joindre l'API autrement que par le proxy, et il n'y a plus ni session ni révocation applicative.
- **Jetons d'accès vérifiés à chaque requête.** Contredit le §11.3 : il faudrait conserver un jeton dans le navigateur, et la révocation immédiate devient impossible.

## Conséquences

- La phase 0 est plus longue : Authentik et sa base doivent tourner avant la première page utile.
- Authentik est un point de défaillance unique pour la connexion. Une indisponibilité ponctuelle est acceptable (§14.4), mais sa base fait partie du périmètre de sauvegarde au même titre que celle de l'application.
- L'API reste sûre même si elle est jointe directement sur le réseau interne : elle ne fait confiance à aucun en-tête d'identité.
- Les comptes sont créés à la main dans Authentik. Il n'y a pas d'inscription ouverte.
