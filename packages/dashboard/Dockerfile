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
RUN pnpm exec nx build dashboard


FROM nginx:1.29-alpine AS runtime

COPY packages/dashboard/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/dist/packages/dashboard/browser /usr/share/nginx/html

EXPOSE 80
