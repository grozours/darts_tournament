#!/usr/bin/env bash
set -euo pipefail

SONAR_HOST_URL=${SONAR_HOST_URL:-http://localhost:9000}
SONAR_TOKEN=${SONAR_TOKEN:-}

if [[ -z "$SONAR_TOKEN" ]]; then
  echo "SONAR_TOKEN is required (generate one in SonarQube: User > My Account > Security)"
  exit 1
fi

docker run --rm \
  --network host \
  -e SONAR_HOST_URL="$SONAR_HOST_URL" \
  -v "$PWD:/usr/src" \
  sonarsource/sonar-scanner-cli \
  -Dsonar.login="$SONAR_TOKEN"
