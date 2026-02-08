#!/bin/sh
set -e

echo "Running database migrations..."
bun src/migrate.ts
echo "Migrations complete."

echo "Starting API server..."
exec bun src/index.ts
