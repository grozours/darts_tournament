#!/bin/sh
set -eu

escape_json() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

write_env_js() {
  cat > /usr/share/nginx/html/env.js <<EOF
window.__APP_ENV__ = {
  "VITE_AUTH0_DOMAIN": "$(escape_json "${VITE_AUTH0_DOMAIN:-}")",
  "VITE_AUTH0_CLIENT_ID": "$(escape_json "${VITE_AUTH0_CLIENT_ID:-}")",
  "VITE_AUTH0_AUDIENCE": "$(escape_json "${VITE_AUTH0_AUDIENCE:-}")",
  "VITE_AUTH0_CONNECTION_GOOGLE": "$(escape_json "${VITE_AUTH0_CONNECTION_GOOGLE:-google-oauth2}")",
  "VITE_AUTH0_CONNECTION_FACEBOOK": "$(escape_json "${VITE_AUTH0_CONNECTION_FACEBOOK:-facebook}")",
  "VITE_AUTH0_CONNECTION_DISCORD": "$(escape_json "${VITE_AUTH0_CONNECTION_DISCORD:-discord}")",
  "VITE_AUTH0_CONNECTION_INSTAGRAM": "$(escape_json "${VITE_AUTH0_CONNECTION_INSTAGRAM:-instagram}")"
};
EOF
}

write_env_js
