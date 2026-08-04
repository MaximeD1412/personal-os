# syntax=docker/dockerfile:1

FROM node:24-alpine AS build
WORKDIR /workspace

# corepack installe la version de pnpm épinglée par `packageManager`.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

# Le schéma Prisma est copié avant l'installation : le postinstall génère le
# client, et la couche reste en cache tant que les dépendances ne bougent pas.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY packages/database/prisma ./packages/database/prisma
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm exec nx build api


FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /workspace/dist/packages/api ./
COPY --from=build /workspace/node_modules ./node_modules

# Le schéma et les migrations gardent leur chemin d'origine : prisma.config.ts
# les y cherche.
COPY --from=build /workspace/prisma.config.ts ./prisma.config.ts
COPY --from=build /workspace/packages/database/prisma ./packages/database/prisma

EXPOSE 3000

# Les migrations restent compatibles avec la version précédente (ADR 0024) :
# les appliquer au démarrage est sans risque pour l'instance encore en place.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node main.js"]
