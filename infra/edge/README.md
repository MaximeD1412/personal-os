# Proxy de tête

Le seul service de la machine qui écoute sur une interface publique
([ADR 0025](../../docs/adr/0025-un-proxy-de-tete-neutre-devant-les-projets.md)).
Il termine TLS et route par nom d'hôte vers le proxy interne de chaque
locataire, sur un réseau Docker partagé.

Il n'appartient à aucun projet. C'est tout son intérêt : Personal OS reçoit
**tout son domaine** derrière un certificat joker, et décide ensuite chez lui
quoi en faire. Ajouter `app.dccm.fr` ne touche rien ici.

```
Internet :80 :443
      │
      ▼
 caddy-edge ─── réseau « edge »
   ├── dccm.fr, *.dccm.fr  →  personal-os-caddy:80   (joker, DNS-01)
   └── <autres locataires> →  leur proxy interne     (conf.d/*.caddy)
```

| Fichier | Rôle |
| --- | --- |
| `Dockerfile` | Caddy compilé avec le module DNS d'OVH |
| `Caddyfile` | Le routage. Personal OS, et un `import` pour les autres |
| `docker-compose.yml` | Le service, ses volumes de certificats, le réseau partagé |
| `edge.env.example` | Modèle d'environnement. **Jamais dans Git** |
| `conf.d/mairie.caddy.exemple` | Modèle de bloc pour un autre locataire |

## Ce qu'il n'est pas

**Il n'est pas déployé par l'agent de Personal OS.** Le faire redonnerait à un
projet la propriété de l'entrée, et déplacerait le problème au lieu de le
résoudre. Il vit dans ce dépôt pour être versionné et documenté, mais
s'installe et se met à jour **à la main** — tenable précisément parce que le
routage par domaine le rend immuable.

**Il ne connaît aucune application.** Ni chemin, ni règle, ni service : des
noms d'hôtes et des destinations. Dès qu'on est tenté d'y ajouter autre chose,
c'est que ça appartient au Caddyfile d'un locataire.

## Installation

### 1. Le jeton DNS OVH

Le certificat joker s'obtient par challenge DNS-01, qui exige de poser un
enregistrement TXT dans la zone. Créer un jeton sur
<https://api.ovh.com/createToken/>, restreint à ces quatre droits :

```
GET    /domain/zone/dccm.fr/*
POST   /domain/zone/dccm.fr/record
DELETE /domain/zone/dccm.fr/record/*
POST   /domain/zone/dccm.fr/refresh
```

Ce jeton ne donne accès qu'à la zone DNS — ni au serveur, ni aux données.

> **Validité illimitée.** Un jeton qui expire ne casse rien le jour où on le
> pose : il fait échouer un renouvellement six mois plus tard, sans que rien ne
> l'ait annoncé, et le site tombe un matin sans qu'on ait rien touché.

### 2. Poser les fichiers

```bash
sudo install -d -m 755 /opt/edge /opt/edge/conf.d
sudo cp Caddyfile docker-compose.yml /opt/edge/
sudo cp conf.d/mairie.caddy.exemple /opt/edge/conf.d/
sudo install -m 600 edge.env.example /opt/edge/.env
sudo -e /opt/edge/.env      # renseigner ACME_EMAIL, le domaine, les 3 clés OVH
```

### 3. Libérer 80 et 443

**Un seul processus peut tenir 443.** Les locataires doivent cesser de les
publier avant que l'edge démarre. Pour `mairie`, dans son `docker-compose.yml` :
retirer les lignes `ports:` de son service Caddy, et lui ajouter le réseau.

```yaml
services:
  caddy:
    # ports:                 <- supprimé, l'edge les détient
    #   - '80:80'
    #   - '443:443'
    networks:
      - default
      - edge

networks:
  edge:
    external: true
    name: edge
```

> `default` doit être répété : dès qu'un service nomme ses réseaux, il ne
> rejoint plus celui par défaut tout seul, et perdrait l'accès à ses propres
> services.

### 4. Démarrer, dans cet ordre

Deux contraintes se croisent ici : l'edge **crée** le réseau que les locataires
rejoignent en réseau externe, mais il ne peut prendre 80 et 443 que si le
locataire qui les détient les a **libérés d'abord**.

> **Avant de couper quoi que ce soit**, vérifier que l'image existe. Une image
> absente laisse les locataires à terre pendant qu'on cherche pourquoi — c'est
> arrivé.
>
> ```bash
> docker pull ghcr.io/maximed1412/personal-os/edge:main
> ```
>
> Elle n'est publiée qu'après une fusion sur la branche principale. Tant qu'elle
> manque, GHCR répond `denied` et non « introuvable ».

Toutes les éditions de l'étape 3 sont faites **avant** de commencer : c'est ce
qui garde l'interruption courte.

```bash
# 1. Libérer 80 et 443
cd <projet mairie> && sudo docker compose stop caddy

# 2. L'edge prend les ports et crée le réseau
cd /opt/edge && sudo docker compose up -d
docker logs caddy-edge --tail 20

# 3. Le locataire revient, sans ports, sur le réseau partagé
cd <projet mairie> && sudo docker compose up -d
docker network inspect edge --format '{{len .Containers}} conteneur(s)'

# 4. Personal OS rejoint à son tour
sudo /opt/personal-os/deploy/bin/deploy.sh --force
```

Entre 1 et 5, le locataire est injoignable : l'edge tient 443 mais ne sait pas
encore où router son domaine. Compte deux à trois minutes en tout, dont la
première émission de son certificat.

### 5. Le bloc du locataire

```bash
sudo cp /opt/edge/conf.d/mairie.caddy.exemple /opt/edge/conf.d/mairie.caddy
sudo -e /opt/edge/conf.d/mairie.caddy          # son vrai nom d'hôte
docker exec caddy-edge caddy reload --config /etc/caddy/Caddyfile
```

Recharger plutôt que redémarrer : un redémarrage coupe tous les locataires à la
fois.

## Vérifier

```bash
docker logs caddy-edge --tail 50               # l'émission du certificat
curl -I https://portfolio.dccm.fr
curl -I https://<hôte de mairie>
```

La première émission du joker prend une à deux minutes : Caddy pose
l'enregistrement TXT, attend sa propagation, puis demande le certificat. Les
suivantes sont invisibles.

Un échec se lit dans le journal, et parle presque toujours du jeton OVH — droits
insuffisants, ou zone mal orthographiée.

## Ajouter un sous-domaine, ensuite

C'est la propriété que tout ce montage existe pour offrir :

1. un enregistrement `A` chez OVH vers l'IP de la machine ;
2. un bloc dans le `Caddyfile` de **Personal OS**, dans son dépôt ;
3. une fusion sur la branche principale.

L'edge n'est pas touché. Le certificat joker couvre déjà le nom.

> Un joker ne couvre **qu'un seul niveau**. `app.dccm.fr` est couvert,
> `a.b.dccm.fr` ne l'est pas et demanderait son propre bloc.

## Sauvegarde

`/opt/edge` porte le Caddyfile, les blocs des locataires et le jeton OVH : il
est dans `BACKUP_PATHS` du modèle de sauvegarde.

Les certificats, eux, vivent dans un volume Docker et n'y sont pas. C'est
assumé — ils se réémettent. Mais les réémettre en masse se heurte aux quotas de
l'autorité de certification, alors ne supprimez pas `edge-data` par acquit de
conscience.

## Mise à jour

```bash
cd /opt/edge && sudo docker compose pull && sudo docker compose up -d
```

L'image est publiée par la livraison de Personal OS — le dépôt où elle vit —
mais tirée à la main. Elle ne bouge qu'avec une version de Caddy ou du module
DNS.
