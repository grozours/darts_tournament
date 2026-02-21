#!/bin/sh
set -eu

SONAR_HOST="${SONAR_HOST:-http://sonarqube:9000}"
SONAR_ADMIN_OLD="${SONAR_ADMIN_OLD:-admin}"
SONAR_ADMIN_NEW="${SONAR_ADMIN_NEW:-}"
SONAR_TOKEN_NAME="${SONAR_TOKEN_NAME:-ci-token}"
SONAR_TOKEN_FILE="${SONAR_TOKEN_FILE:-/sonar-token}"
SONAR_PROJECT_KEY="${SONAR_PROJECT_KEY:-darts-tournament}"
SONAR_PROJECT_NAME="${SONAR_PROJECT_NAME:-Darts Tournament}"
SONAR_QUALITY_GATE_NAME="${SONAR_QUALITY_GATE_NAME:-Darts Tournament Default}"
SONAR_MIN_NEW_COVERAGE="${SONAR_MIN_NEW_COVERAGE:-60}"
SONAR_REGENERATE_TOKEN="${SONAR_REGENERATE_TOKEN:-false}"
SONAR_WAIT_SECONDS="${SONAR_WAIT_SECONDS:-180}"

log() {
  printf '%s\n' "$*"
}

wait_for_sonar() {
  log "[sonar-init] Waiting for SonarQube at ${SONAR_HOST}"
  start_time=$(date +%s)
  end_time=$((start_time + SONAR_WAIT_SECONDS))
  while [ "$(date +%s)" -lt "$end_time" ]; do
    status=$(curl -fsS "${SONAR_HOST}/api/system/status" 2>/dev/null | sed -n 's/.*"status":"\([A-Z_]*\)".*/\1/p') || true
    if [ "$status" = "UP" ]; then
      log "[sonar-init] SonarQube is UP"
      return 0
    fi
    sleep 2
  done
  log "[sonar-init] SonarQube did not become ready in time"
  return 1
}

validate_auth() {
  user="$1"
  pass="$2"
  curl -fsS -u "${user}:${pass}" "${SONAR_HOST}/api/authentication/validate" \
    | sed -n 's/.*"valid":\(true\|false\).*/\1/p'
}

change_admin_password() {
  if [ -z "$SONAR_ADMIN_NEW" ] || [ "$SONAR_ADMIN_NEW" = "$SONAR_ADMIN_OLD" ]; then
    return 0
  fi

  if [ "$(validate_auth admin "$SONAR_ADMIN_OLD")" != "true" ]; then
    log "[sonar-init] Admin password change skipped (old password invalid)"
    return 0
  fi

  log "[sonar-init] Attempting admin password change"
  if curl -fsS -u "admin:${SONAR_ADMIN_OLD}" \
    -X POST "${SONAR_HOST}/api/users/change_password" \
    -d "login=admin" \
    -d "previousPassword=${SONAR_ADMIN_OLD}" \
    -d "password=${SONAR_ADMIN_NEW}" >/dev/null; then
    log "[sonar-init] Admin password updated"
    return 0
  fi
  return 1
}

ensure_admin_auth() {
  if [ -n "$SONAR_ADMIN_NEW" ] && [ "$(validate_auth admin "$SONAR_ADMIN_NEW")" = "true" ]; then
    echo "$SONAR_ADMIN_NEW"
    return 0
  fi
  if [ "$(validate_auth admin "$SONAR_ADMIN_OLD")" = "true" ]; then
    echo "$SONAR_ADMIN_OLD"
    return 0
  fi
  return 1
}

ensure_token() {
  admin_pass="$1"

  if [ -f "$SONAR_TOKEN_FILE" ] && [ -s "$SONAR_TOKEN_FILE" ] && [ "$SONAR_REGENERATE_TOKEN" != "true" ]; then
    log "[sonar-init] Token file already present at ${SONAR_TOKEN_FILE}"
    return 0
  fi

  token_exists=$(curl -fsS -u "admin:${admin_pass}" \
    "${SONAR_HOST}/api/user_tokens/search" \
    | grep -c "\"name\":\"${SONAR_TOKEN_NAME}\"" || true)

  if [ "$token_exists" -gt 0 ] && [ "$SONAR_REGENERATE_TOKEN" != "true" ]; then
    log "[sonar-init] Token '${SONAR_TOKEN_NAME}' exists; keeping existing token"
    return 0
  fi

  if [ "$token_exists" -gt 0 ]; then
    log "[sonar-init] Revoking existing token '${SONAR_TOKEN_NAME}'"
    curl -fsS -u "admin:${admin_pass}" \
      -X POST "${SONAR_HOST}/api/user_tokens/revoke" \
      -d "name=${SONAR_TOKEN_NAME}" >/dev/null
  fi

  log "[sonar-init] Generating token '${SONAR_TOKEN_NAME}'"
  token=$(curl -fsS -u "admin:${admin_pass}" \
    -X POST "${SONAR_HOST}/api/user_tokens/generate" \
    -d "name=${SONAR_TOKEN_NAME}" \
    | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

  if [ -z "$token" ]; then
    log "[sonar-init] Failed to generate token"
    return 1
  fi

  printf '%s' "$token" > "$SONAR_TOKEN_FILE"
  chmod 600 "$SONAR_TOKEN_FILE"
  log "[sonar-init] Token saved to ${SONAR_TOKEN_FILE}"
}

ensure_project() {
  admin_pass="$1"

  project_exists=$(curl -fsS -u "admin:${admin_pass}" \
    "${SONAR_HOST}/api/projects/search?projects=${SONAR_PROJECT_KEY}" \
    | grep -c "\"key\":\"${SONAR_PROJECT_KEY}\"" || true)

  if [ "$project_exists" -gt 0 ]; then
    log "[sonar-init] Project '${SONAR_PROJECT_KEY}' already exists"
    return 0
  fi

  log "[sonar-init] Creating project '${SONAR_PROJECT_KEY}'"
  curl -fsS -u "admin:${admin_pass}" \
    -X POST "${SONAR_HOST}/api/projects/create" \
    -d "name=${SONAR_PROJECT_NAME}" \
    -d "project=${SONAR_PROJECT_KEY}" >/dev/null
}

ensure_quality_gate() {
  admin_pass="$1"
  gate_name_encoded=$(printf '%s' "$SONAR_QUALITY_GATE_NAME" | sed 's/ /%20/g')

  gate_id=""

  list_response=$(curl -fsS -u "admin:${admin_pass}" \
    "${SONAR_HOST}/api/qualitygates/list" || true)
  gate_id=$(printf '%s' "$list_response" \
    | sed -n 's/.*"id":"\([^"\"]*\)".*"name":"'"$SONAR_QUALITY_GATE_NAME"'".*/\1/p' | head -n 1)

  if [ -z "$gate_id" ]; then
    gate_id=$(printf '%s' "$list_response" \
      | sed -n 's/.*"name":"'"$SONAR_QUALITY_GATE_NAME"'".*"id":"\([^"\"]*\)".*/\1/p' | head -n 1)
  fi

  if [ -z "$gate_id" ]; then
    gate_id=$(curl -fsS -u "admin:${admin_pass}" \
      "${SONAR_HOST}/api/qualitygates/show?name=${gate_name_encoded}" \
      | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
  fi

  if [ -z "$gate_id" ]; then
    log "[sonar-init] Creating quality gate '${SONAR_QUALITY_GATE_NAME}'"
    create_response=$(curl -fsS -u "admin:${admin_pass}" \
      -X POST "${SONAR_HOST}/api/qualitygates/create" \
      -d "name=${SONAR_QUALITY_GATE_NAME}" 2>/dev/null || true)
    gate_id=$(printf '%s' "$create_response" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')

    if [ -z "$gate_id" ]; then
      gate_id=$(curl -fsS -u "admin:${admin_pass}" \
        "${SONAR_HOST}/api/qualitygates/show?name=${gate_name_encoded}" 2>/dev/null \
        | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
    fi
  else
    log "[sonar-init] Quality gate '${SONAR_QUALITY_GATE_NAME}' already exists"
  fi

    if [ -z "$gate_id" ]; then
      log "[sonar-init] Unable to resolve quality gate id"
      return 1
    fi

  log "[sonar-init] Setting default quality gate"
  set_default_success=false
  for param in id gateId qualityGate; do
    set_default_response=$(curl -s -u "admin:${admin_pass}" \
      -X POST "${SONAR_HOST}/api/qualitygates/set_default" \
      -d "${param}=${gate_id}" \
      -w "\n%{http_code}")
    set_default_code=$(printf '%s' "$set_default_response" | tail -n 1)
    if [ "$set_default_code" = "204" ] || [ "$set_default_code" = "200" ]; then
      set_default_success=true
      break
    fi
  done

  if [ "$set_default_success" != "true" ]; then
    log "[sonar-init] Failed to set default gate, applying to project instead"
    curl -fsS -u "admin:${admin_pass}" \
      -X POST "${SONAR_HOST}/api/qualitygates/select" \
      -d "gateId=${gate_id}" \
      -d "projectKey=${SONAR_PROJECT_KEY}" >/dev/null
  fi

  conditions_json=$(curl -fsS -u "admin:${admin_pass}" \
    "${SONAR_HOST}/api/qualitygates/show?id=${gate_id}" || true)
  condition_id=$(printf '%s' "$conditions_json" \
    | sed -n 's/.*"metric":"new_coverage".*"id":\([0-9]*\).*/\1/p' | head -n 1)
  condition_error=$(printf '%s' "$conditions_json" \
    | sed -n 's/.*"metric":"new_coverage".*"error":"\([^"]*\)".*/\1/p' | head -n 1)
  if [ -z "$condition_id" ]; then
    condition_block=$(printf '%s' "$conditions_json" | tr '{' '\n' | grep 'new_coverage' | head -n 1)
    condition_id=$(printf '%s' "$condition_block" | sed -n 's/.*"id":\([0-9]*\).*/\1/p')
    if [ -z "$condition_error" ]; then
      condition_error=$(printf '%s' "$condition_block" | sed -n 's/.*"error":"\([^"]*\)".*/\1/p')
    fi
  fi

  if [ -z "$condition_id" ]; then
    log "[sonar-init] Adding new code coverage condition (${SONAR_MIN_NEW_COVERAGE}%)"
    create_condition_response=$(curl -s -u "admin:${admin_pass}" \
      -X POST "${SONAR_HOST}/api/qualitygates/create_condition" \
      -d "gateId=${gate_id}" \
      -d "metric=new_coverage" \
      -d "op=LT" \
      -d "error=${SONAR_MIN_NEW_COVERAGE}" \
      -w "\n%{http_code}")
    create_condition_code=$(printf '%s' "$create_condition_response" | tail -n 1)
    if [ "$create_condition_code" != "204" ] && [ "$create_condition_code" != "200" ]; then
      if ! printf '%s' "$create_condition_response" | grep -q "already exists"; then
        log "[sonar-init] Failed to create coverage condition (HTTP ${create_condition_code})"
        return 1
      fi
    fi
  fi

  if [ -z "$condition_id" ]; then
    conditions_json=$(curl -fsS -u "admin:${admin_pass}" \
      "${SONAR_HOST}/api/qualitygates/show?id=${gate_id}" || true)
    condition_id=$(printf '%s' "$conditions_json" \
      | tr '{' '\n' \
      | grep 'new_coverage' \
      | head -n 1 \
      | sed -n 's/.*"id":"\?\([0-9A-Za-z_-]*\)"\?.*/\1/p')
  fi

  if [ -n "$condition_id" ]; then
    log "[sonar-init] Forcing new code coverage to ${SONAR_MIN_NEW_COVERAGE}%"
    update_condition_response=$(curl -s -u "admin:${admin_pass}" \
      -X POST "${SONAR_HOST}/api/qualitygates/update_condition" \
      -d "id=${condition_id}" \
      -d "metric=new_coverage" \
      -d "op=LT" \
      -d "error=${SONAR_MIN_NEW_COVERAGE}" \
      -w "\n%{http_code}")
    update_condition_code=$(printf '%s' "$update_condition_response" | tail -n 1)
    if [ "$update_condition_code" != "204" ] && [ "$update_condition_code" != "200" ]; then
      log "[sonar-init] Failed to update coverage condition (HTTP ${update_condition_code})"
      return 1
    fi
  else
    log "[sonar-init] Unable to resolve coverage condition id"
    return 1
  fi
}

wait_for_sonar

if ! change_admin_password; then
  log "[sonar-init] Admin password change skipped or failed, will attempt auth"
fi

admin_pass=$(ensure_admin_auth || true)
if [ -z "$admin_pass" ]; then
  log "[sonar-init] Unable to authenticate as admin"
  exit 1
fi

ensure_project "$admin_pass"
ensure_token "$admin_pass"
ensure_quality_gate "$admin_pass"

log "[sonar-init] Done"
