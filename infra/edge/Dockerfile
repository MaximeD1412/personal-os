# syntax=docker/dockerfile:1

# Caddy compilé avec le module DNS d'OVH.
#
# Le challenge DNS-01 est le seul qui délivre un certificat **joker** : c'est ce
# qui permet d'ajouter un sous-domaine sans jamais retoucher l'edge
# (ADR 0025). Il exige de poser un enregistrement TXT dans la zone, donc un
# module qui sache parler au registrar — absent de l'image standard.
FROM caddy:2-builder AS build

RUN xcaddy build \
  --with github.com/caddy-dns/ovh


FROM caddy:2-alpine AS runtime

COPY --from=build /usr/bin/caddy /usr/bin/caddy

# Les certificats vivent dans /data. Le volume qui le porte est la seule chose
# de cette image qu'on ne peut pas reconstruire à la demande : les réémettre
# est gratuit, mais les quotas de l'autorité de certification transforment une
# bêtise en indisponibilité de plusieurs heures.
