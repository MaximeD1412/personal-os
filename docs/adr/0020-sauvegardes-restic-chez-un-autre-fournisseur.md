# Sauvegardes Restic, chez un autre fournisseur qu'OVH

> **Statut :** accepté — 3 août 2026

Les sauvegardes partent vers un stockage objet appartenant à un **autre fournisseur** que celui du VPS (Backblaze B2 ou équivalent), au moyen de Restic : chiffrement côté client, déduplication, instantanés, restauration partielle. Le périmètre couvre la base PostgreSQL, les objets S3, la base Authentik et la configuration (Compose, Caddy).

Un second espace de stockage chez OVH aurait été plus rapide à mettre en place, mais deux copies sur trois chez le même fournisseur ne protègent ni d'une suspension de compte, ni d'un incident de facturation, ni d'un problème global du fournisseur. Ce n'est pas la règle 3-2-1 du §15.4.

Restic est déjà l'outil prévu pour le homelab (§14.2) : il est appris une fois et conservé après la migration.

## Options écartées

- **Sauvegarde tirée vers une machine personnelle.** Coût nul et préfiguration du homelab, mais ne s'exécute que si la machine est allumée — donc une régularité qui dépend des habitudes, avec un trou silencieux pendant les vacances.
- **Second espace de stockage OVH.** Le plus simple, mais protège seulement de la panne matérielle et de l'erreur humaine.
