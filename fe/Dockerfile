FROM node:22-alpine AS base
WORKDIR /app
EXPOSE 8080

FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# VITE_ env vars must be provided at build time
ARG VITE_MAIN_API_BASE_URL
ARG VITE_AUTH_API_BASE_URL

RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 saspnet

COPY --from=build --chown=saspnet:nodejs /app/dist ./dist

USER saspnet

EXPOSE 8080

CMD ["npx", "serve", "dist", "-s", "-l", "8080"]
