#!/bin/sh
set -e

echo "Generating Prisma client..."
bunx prisma generate

echo "Running database migrations..."
bunx prisma migrate deploy
echo "Migrations complete."

echo "Starting API server..."
exec bun src/index.ts
