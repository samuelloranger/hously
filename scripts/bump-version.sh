#!/usr/bin/env bash
set -euo pipefail

# Bump the patch version in all workspace package.json files.
# Reads the current version from the root package.json.

ROOT_PKG="package.json"
CURRENT=$(grep -oP '"version":\s*"\K[^"]+' "$ROOT_PKG" | head -1)

IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
NEW_VERSION="${MAJOR}.${MINOR}.$((PATCH + 1))"

echo "Bumping version: $CURRENT -> $NEW_VERSION"

# Update all workspace package.json files (exclude node_modules)
find . -name "package.json" -not -path "*/node_modules/*" | while read -r f; do
  if grep -q '"version"' "$f"; then
    sed -i "s/\"version\": \"$CURRENT\"/\"version\": \"$NEW_VERSION\"/" "$f"
  fi
done

echo "Done."
