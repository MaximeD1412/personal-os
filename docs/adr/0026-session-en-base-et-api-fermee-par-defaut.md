# La session est une rangée en base, et l'API est fermée par défaut

> **Statut :** accepté — 26 août 2026
> Précise l'[ADR 0015](0015-authentik-des-le-vps-avec-session-serveur.md), qui
> pose la session serveur sans dire de quoi elle est faite.

La session émise par l'API est une **rangée en base**. Le navigateur reçoit un
jeton opaque de 256 bits d'aléa dans un cookie `HttpOnly`, `Secure`,
`SameSite=Lax` ; la base n'en garde que l'empreinte SHA-256. Chaque requête la
relit.

Trois choses en découlent, et ce sont elles qu'on achète :

- **La révocation est immédiate.** La déconnexion marque la rangée, et la
  requête suivante est refusée. C'est le critère « la déconnexion invalide la
  session côté serveur », et aucun jeton auto-porteur ne le tient.
- **Une sauvegarde restaurée n'ouvre aucune session.** Seule l'empreinte est
  stockée, et un dump se promène — il part chez un autre fournisseur
  ([ADR 0020](0020-sauvegardes-restic-chez-un-autre-fournisseur.md)).
- **Le jeton d'Authentik meurt dans l'API.** Il n'est ni transmis au
  navigateur, ni conservé en base. Ce qui circule est à nous, et ne vaut que
  chez nous.

La protection CSRF repose sur `SameSite=Lax`, et sur rien d'autre : le cookie
n'accompagne aucune requête inter-site qui ne soit une navigation de premier
niveau en `GET`. Tout ce qui écrit passe par `POST`, `PUT` ou `DELETE`, et
n'emporte donc jamais la session depuis un autre site. `Strict` aurait été
tentant, mais il retiendrait le cookie exactement au moment où il sert — au
retour d'Authentik, qui est une navigation venue d'ailleurs. Le jour où un
formulaire inter-site deviendra nécessaire, il faudra un jeton dédié ; il n'y en
a aucun aujourd'hui.

La session est neuve à chaque connexion : le jeton est tiré au retour du flux,
et rien ne préexiste à l'authentification. Il n'y a donc pas de fixation de
session à craindre, ni de rotation à organiser.

L'API est **fermée par défaut**. La garde est posée en `APP_GUARD` et un
endpoint s'ouvre en portant `@Public()`, en toutes lettres. C'est le corollaire
des modules plats ([ADR 0016](0016-modules-plats-et-filtrage-espace-centralise.md))
et le même raisonnement que pour le filtrage par **Espace** : plus les modules
sont simples, moins la garantie peut dépendre de leur vigilance. Un module qui
oublierait de se protéger n'existe pas, puisqu'il n'a rien à faire pour l'être.

Trois routes sont publiques, et la liste tient en trois lignes : le départ du
flux, son retour, et la déconnexion — plus la sonde de santé, que l'agent de
déploiement interroge pour décider s'il garde une version.

L'**admission**, enfin, est une liste d'adresses dans la configuration de
production. Une identité valide chez Authentik mais absente de la liste se voit
refuser et **ne crée aucune rangée**. Au premier retour réussi d'une adresse
admise, le compte local est créé et apparié au sujet Authentik. L'appariement
est automatique ; l'admission ne l'est pas.

## Options écartées

- **Un JWT signé, sans état.** Aucune lecture en base par requête, mais la
  révocation devient impossible avant expiration : se déconnecter ne
  déconnecterait pas. Le §11.3 de la note produit demande l'inverse.
- **Un magasin de sessions en mémoire ou dans Redis.** Un redémarrage — donc
  chaque déploiement, et ils sont automatiques
  ([ADR 0023](0023-deploiement-automatique-tire-par-le-vps.md)) — déconnecterait
  tout le monde. Et ce serait une pièce d'infrastructure de plus à sauvegarder
  sur un VPS partagé.
- **Le jeton en clair en base.** Rien à gagner : le jeton fait 256 bits d'aléa,
  il n'y a rien à deviner. L'empreinte ne coûte qu'un appel de hachage et
  protège la lecture de la base.
- **Une liste de routes à protéger.** L'oubli s'y traduit par une fuite
  silencieuse, au lieu d'un 401 qu'on remarque à la première requête.
- **Des rangées `User` créées à la main en base.** Admission strictement
  pré-déclarée, mais une étape manuelle de plus dans le runbook — à rejouer à
  chaque restauration sur base vierge, c'est-à-dire au pire moment.

## Conséquences

- Chaque requête authentifiée coûte une lecture en base. C'est le prix de la
  révocation immédiate, et il est payé sciemment.
- Un endpoint nouveau est protégé sans que personne n'y pense. En contrepartie,
  un endpoint qui doit être public et qu'on oublie d'ouvrir répond 401 — ça se
  voit tout de suite, et c'est le bon sens de l'erreur.
- La liste d'admission vit dans `/opt/personal-os/.env`, en mode 600. Elle ne
  contient pas de secret, mais elle contient deux adresses personnelles : elle
  n'entre pas dans Git.
- Une liste d'admission vide fait **refuser le démarrage** de l'API. Démarrer
  quand même donnerait une application dont plus aucun compte n'ouvre — panne
  d'autant plus longue à comprendre qu'elle ressemble à un problème d'Authentik.
- Les sessions expirées sont purgées à l'ouverture d'une nouvelle. Il n'y a pas
  de tâche de fond : à deux utilisateurs, il n'y a rien à ramasser.
