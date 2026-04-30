#!/bin/sh
set -e

echo "Running database migrations..."
/app/node_modules/.bin/prisma migrate deploy --schema=/app/apps/api/prisma/schema.prisma

echo "Starting ZenDocx API..."
exec node /app/apps/api/dist/main
