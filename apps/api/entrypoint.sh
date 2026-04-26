#!/bin/sh
set -e

echo "Running database migrations..."
node_modules/.bin/prisma migrate deploy --schema=apps/api/prisma/schema.prisma

echo "Starting Zentry API..."
exec node apps/api/dist/main
