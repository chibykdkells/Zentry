# ── Stage 1: Base ────────────────────────────────────────────────
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ── Stage 2: Builder ─────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

# Copy workspace manifests and lockfile
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY .npmrc ./
COPY package.json ./
COPY turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/validators/package.json ./packages/validators/

# Copy Prisma schema BEFORE install so the postinstall hook can run prisma generate
COPY apps/api/prisma ./apps/api/prisma

# Install all deps (dev + prod — prisma CLI needed for generate + migrate)
RUN pnpm install --frozen-lockfile

# Explicitly generate Prisma client to ensure types exist before TypeScript compile
RUN pnpm --filter=@zentry/api exec prisma generate

# Copy application source
COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig.json ./apps/api/tsconfig.json
COPY apps/api/nest-cli.json ./apps/api/nest-cli.json
COPY packages/types/src ./packages/types/src
COPY packages/utils/src ./packages/utils/src
COPY packages/validators/src ./packages/validators/src

# Build NestJS app (webpack bundles workspace packages into dist/main.js)
RUN pnpm --filter=@zentry/api build

# ── Stage 3: Production Runner ───────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy hoisted node_modules from builder (includes prisma CLI + generated client)
COPY --from=builder /app/node_modules ./node_modules

# Copy Prisma schema + migrations (needed for prisma migrate deploy at startup)
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

# Copy compiled application
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Copy startup script
COPY apps/api/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 4000
ENTRYPOINT ["/entrypoint.sh"]
