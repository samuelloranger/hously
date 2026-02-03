#!/bin/bash
set -e

echo "Waiting for database to be ready..."
until pg_isready -h db -U ${POSTGRES_USER:-hously} -p 5432; do
  echo 'Database not ready, waiting...';
  sleep 2;
done

echo "Running database migrations..."

# Check for multiple heads and handle gracefully
HEADS=$(uv run --directory apps/api alembic heads 2>&1 | grep -E "^[a-f0-9]+|^[a-zA-Z_]+" | wc -l)

if [ "$HEADS" -gt 1 ]; then
    echo "Warning: Multiple migration heads detected. Attempting to merge..."
    echo "Current heads:"
    uv run --directory apps/api alembic heads
    echo ""
    echo "Attempting to upgrade to head (merge migration should handle this)..."
fi

# Run migrations - this will fail if there are multiple heads without a merge migration
if ! uv run --directory apps/api alembic upgrade head; then
    echo "ERROR: Migration failed. This usually means there are multiple heads without a merge migration."
    echo "Please create a merge migration or fix the migration chain."
    echo ""
    echo "Current heads:"
    uv run --directory apps/api alembic heads
    exit 1
fi

echo "Migrations completed successfully."
echo "Starting application..."
exec uv run --directory apps/api python app.py

