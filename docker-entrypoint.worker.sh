#!/bin/bash
set -e

echo "Waiting for database to be ready..."
until pg_isready -h db -U ${POSTGRES_USER:-hously} -p 5432; do
  echo 'Database not ready, waiting...';
  sleep 2;
done

echo "Starting Celery worker..."
exec uv run --directory apps/api celery -A worker worker --loglevel=info

