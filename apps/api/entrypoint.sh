#!/bin/sh
set -e

echo "Waiting for database to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0
until bunx prisma db execute --stdin <<< "SELECT 1" 2>/dev/null; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ "$RETRY_COUNT" -ge "$MAX_RETRIES" ]; then
    echo "ERROR: Database not ready after ${MAX_RETRIES} attempts. Exiting."
    exit 1
  fi
  echo "Database not ready, retrying in 2s... (attempt ${RETRY_COUNT}/${MAX_RETRIES})"
  sleep 2
done
echo "Database is ready."

echo "Generating Prisma client..."
bunx prisma generate

echo "Running database migrations..."
bunx prisma migrate deploy
echo "Migrations complete."

echo "Starting API server..."
exec bun src/index.ts
