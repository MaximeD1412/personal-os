# Déploiement poussé par GitHub, au moyen d'une clé SSH bridée

> **Statut :** accepté. 17 octobre 2026.
> Remplace l'[ADR 0023](0023-deploiement-automatique-tire-par-le-vps.md) sur
> **qui déclenche** le déploiement. La séquence exécutée sur le VPS
> (répétition sur restauration, migration, redémarrage, santé, retour arrière)
> ne change pas.

Avec un déploiement tiré par le VPS, son résultat n'apparaît pas dans GitHub.
Un agent qui fusionne sur `develop` ne peut donc pas savoir si le staging a
démarré, et la PR de livraison ne dit pas si la production a suivi. Pour des
agents autonomes, un déploiement dont on ne voit pas l'issue est un déploiement
qu'on ne peut pas corriger.

GitHub Actions, une fois les images poussées sur GHCR, se connecte en SSH au
VPS. Le déploiement s'exécute **pendant le job**, avec son journal et son code
de sortie. Le job est rouge si le déploiement a échoué ou a été annulé par un
retour arrière.

L'ADR 0023 avait écarté ce montage parce qu'une clé d'accès permanente à la
production aurait résidé chez GitHub. La clé est donc **bridée**, au point que
la détenir ne donne qu'un seul pouvoir : redéployer un commit dont les images
sont déjà publiées.

- **Un utilisateur dédié, sans shell**, distinct de l'administrateur.
- **Une commande forcée** (`command=` dans `authorized_keys`, avec
  `no-pty,no-port-forwarding,no-agent-forwarding,no-X11-forwarding`). Elle
  lance l'agent de déploiement existant, quoi que le client demande. Le seul
  paramètre accepté est un SHA de commit (40 caractères hexadécimaux), lu dans
  `SSH_ORIGINAL_COMMAND`. Tout le reste est refusé.
- **Une clé par environnement.** La clé du staging ne peut déployer que le
  staging. Celle de la production est rangée dans un environnement GitHub
  protégé, accessible au seul workflow de livraison sur `main`.
- **La clé Restic ne quitte jamais la machine.** La répétition de la migration
  sur restauration reste sur le VPS, dans la séquence de l'agent.

Le minuteur qui interrogeait GHCR toutes les deux minutes est retiré, pour
qu'il n'y ait qu'une seule façon de déclencher un déploiement. L'agent reste
lançable à la main sur la machine.

## Ce que cela coûte

- Un compte GitHub compromis peut redéployer un commit publié, y compris un
  ancien. Mais il pouvait déjà publier des images sur `main`, donc la clé
  n'ajoute pas de pouvoir nouveau. Elle n'ouvre ni shell, ni lecture des
  secrets, ni accès aux données.
- Le port SSH doit être joignable depuis les runners GitHub. Les plages d'adresses
  des runners étant très larges, le contrôle repose sur la clé et la commande
  forcée, pas sur le pare-feu.
