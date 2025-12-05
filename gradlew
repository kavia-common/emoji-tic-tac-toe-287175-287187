#!/usr/bin/env bash
# Repository-level gradlew for CI environments that invoke ./gradlew from the workspace root.
# Delegates to the mobile container subfolder if present, otherwise no-ops to avoid failing unrelated checks.

set -e

FRONTEND_DIR="./tic_tac_toe_frontend"

if [ -x "${FRONTEND_DIR}/gradlew" ]; then
  (cd "${FRONTEND_DIR}" && ./gradlew "$@")
  exit $?
fi

echo "No Android Gradle project found at root. Skipping Gradle tasks."
exit 0
