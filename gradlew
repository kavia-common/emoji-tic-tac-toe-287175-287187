#!/usr/bin/env bash
# Repository-level placeholder gradlew for CI environments that invoke ./gradlew
# from the workspace root. Delegates to the mobile container subfolder if present,
# otherwise no-ops to avoid failing unrelated backend checks.
if [ -x "./tic_tac_toe_frontend/gradlew" ]; then
  ./tic_tac_toe_frontend/gradlew "$@"
  exit $?
fi
echo "No Android Gradle project found at root. Skipping Gradle tasks."
exit 0
