#!/bin/sh
set -e

echo "Running database migrations..."
bun run db:migrate
echo "Migrations applied successfully."

echo "Starting API server..."
exec bun src/index.ts
