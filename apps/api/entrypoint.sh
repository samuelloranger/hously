#!/bin/sh
set -eu

echo "Waiting for database to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0

until echo "SELECT 1;" | bunx prisma db execute --stdin >/dev/null 2>&1; do
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

run_migrate_deploy() {
  # Capture output so we can decide what to do on failure
  set +e
  OUT="$(bunx prisma migrate deploy 2>&1)"
  CODE=$?
  set -e

  echo "$OUT"
  return "$CODE"
}

echo "Running database migrations..."
if run_migrate_deploy; then
  echo "Migrations complete."
else
  echo "Migrate deploy failed. Checking if this looks like an existing-schema baseline case..."

  # Heuristics: Prisma/DB errors commonly seen when tables/constraints already exist
  if echo "$OUT" | grep -qiE \
    "already exists|relation .* exists|Duplicate (key|column)|schema is not empty|P3005|P3018|P3019"; then
    echo "Looks like existing schema. Baseline '0_init' then retrying migrate deploy..."

    # This marks the migration as applied so Prisma doesn't try to recreate stuff.
    # If 0_init doesn't exist locally, this SHOULD fail (and we want it to fail).
    bunx prisma migrate resolve --applied 0_init

    run_migrate_deploy
    echo "Migrations complete after baseline."
  else
    echo "ERROR: migrate deploy failed for a reason unrelated to baseline. Exiting."
    exit 1
  fi
fi

echo "Starting API server..."
exec bun src/index.ts