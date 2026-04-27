# ── Stage 1: Base (builder only) ─────────────────────────────────
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ── Stage 2: Builder ─────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY .npmrc ./
COPY package.json ./
COPY turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/validators/package.json ./packages/validators/

COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/prisma.config.ts ./apps/api/prisma.config.ts

RUN pnpm install --frozen-lockfile

RUN node_modules/.bin/prisma generate --schema=apps/api/prisma/schema.prisma

COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig.json ./apps/api/tsconfig.json
COPY apps/api/nest-cli.json ./apps/api/nest-cli.json
COPY packages/types/src ./packages/types/src
COPY packages/utils/src ./packages/utils/src
COPY packages/validators/src ./packages/validators/src

# Build from the api directory explicitly so nest outputs to apps/api/dist
RUN cd apps/api && ../../node_modules/.bin/nest build

# Verify the build output exists
RUN ls -la apps/api/dist/

# ── Stage 3: Production Runner (plain node — no corepack, no pnpm) ──
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Verify dist was copied into runner
RUN ls -la apps/api/dist/

COPY apps/api/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 4000
CMD ["/entrypoint.sh"]
