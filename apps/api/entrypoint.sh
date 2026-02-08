#!/bin/sh
set -e

echo "Applying database schema changes..."
bun run db:push
echo "Database schema up to date."

echo "Starting API server..."
exec bun src/index.ts
