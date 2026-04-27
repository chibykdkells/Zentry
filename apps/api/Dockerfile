FROM node:20-alpine
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_ENV=production
WORKDIR /app

RUN corepack enable

# Copy workspace manifests
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY .npmrc ./
COPY package.json ./
COPY turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/validators/package.json ./packages/validators/

# Copy Prisma before install so postinstall can generate client
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/prisma.config.ts ./apps/api/prisma.config.ts

RUN pnpm install --frozen-lockfile

RUN node_modules/.bin/prisma generate --schema=apps/api/prisma/schema.prisma

# Copy source
COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig.json ./apps/api/tsconfig.json
COPY apps/api/nest-cli.json ./apps/api/nest-cli.json
COPY packages/types/src ./packages/types/src
COPY packages/utils/src ./packages/utils/src
COPY packages/validators/src ./packages/validators/src

# Build from the api directory
RUN cd apps/api && ../../node_modules/.bin/nest build

# Confirm main.js exists — build fails here if it doesn't
RUN test -f apps/api/dist/main.js && echo "dist/main.js OK" || (echo "MISSING dist/main.js" && exit 1)

COPY apps/api/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 4000
CMD ["/entrypoint.sh"]
