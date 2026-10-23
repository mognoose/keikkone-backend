# syntax=docker/dockerfile:1

# ---- build: install all deps, generate the Prisma client, compile TS ----
FROM node:24-slim AS build
WORKDIR /app

# Copy only what `npm ci` needs first, so this layer stays cached until
# dependencies change. postinstall runs `prisma generate`, hence the schema.
COPY package.json package-lock.json .npmrc prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build \
 && npm prune --omit=dev

# ---- runtime: production deps + compiled output only ----
FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build --chown=node:node /app/package.json /app/prisma.config.ts ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
# Migrations are applied by a Cloud Run Job running this same image with
# `npx prisma migrate deploy`, so the schema and migrations ship too.
COPY --from=build --chown=node:node /app/prisma ./prisma

USER node
# Cloud Run injects PORT (8080); this is only the local default.
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/main.js"]
