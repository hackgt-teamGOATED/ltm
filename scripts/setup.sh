#!/usr/bin/env bash
# One-time local setup for Heritage Chat.
# Run it yourself in a terminal, NOT through a coding agent: it asks for API keys.
#   npm run setup            first-time setup (or re-check)
#   npm run setup -- --reset re-enter your keys
set -euo pipefail
cd "$(dirname "$0")/.."

CONFIG_DIR="$HOME/.config/heritage-chat"
ENV_FILE="$CONFIG_DIR/server.env"
RESET=0
[[ "${1:-}" == "--reset" ]] && RESET=1

step() { printf '\n\033[1m%s\033[0m\n' "$1"; }

step "1/5  Checking Node"
node -e '
  const [a, b] = process.versions.node.split(".").map(Number);
  if (!(a > 22 || (a === 22 && b >= 12) || (a === 20 && b >= 19))) {
    console.error("Node " + process.versions.node + " is too old. Install Node 22: brew install node@22 (or nvm install 22)");
    process.exit(1);
  }'
echo "Node $(node -v)"

step "2/5  Secrets (kept outside the repo at $ENV_FILE)"
mkdir -p "$CONFIG_DIR"
chmod 700 "$CONFIG_DIR"
if [[ -f server/.env && ! -f "$ENV_FILE" ]]; then
  mv server/.env "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "Moved server/.env out of the repo."
fi

if [[ -f "$ENV_FILE" && $RESET -eq 0 ]]; then
  echo "Secrets file already exists. To re-enter keys: npm run setup -- --reset"
else
  echo "Get the Supabase URL and secret key from Victor (shared privately, never in Discord channels)."
  echo "Typing is hidden for the keys. Paste, then press Enter."
  read -r -p "Supabase Project URL (https://xxxx.supabase.co): " SB_URL
  read -r -s -p "Supabase secret key: " SB_KEY; echo
  read -r -s -p "OpenAI API key: " OA_KEY; echo

  # Clean up the usual paste mistakes.
  strip() { local v="${1//[[:space:]]/}"; v="${v//\"/}"; v="${v//\'/}"; printf '%s' "$v"; }
  SB_URL="$(strip "$SB_URL")"; SB_URL="${SB_URL%/}"; SB_URL="${SB_URL%/rest/v1}"; SB_URL="${SB_URL%/}"
  SB_KEY="$(strip "$SB_KEY")"
  OA_KEY="$(strip "$OA_KEY")"
  [[ "$OA_KEY" == sk-sk-* ]] && OA_KEY="sk-${OA_KEY#sk-sk-}"

  (
    umask 077
    cat > "$ENV_FILE" <<ENV
# Heritage Chat local secrets. Never commit, paste, or share this file.
SUPABASE_URL=$SB_URL
SUPABASE_SERVICE_ROLE_KEY=$SB_KEY
OPENAI_API_KEY=$OA_KEY
ENV
  )
  chmod 600 "$ENV_FILE"
  unset SB_KEY OA_KEY
  echo "Saved."
fi

step "3/5  Installing dependencies"
npm install
# npm 11+ blocks package install scripts until approved; these two are the bundler and macOS file watching.
if npm install-scripts approve esbuild fsevents >/dev/null 2>&1; then
  npm install >/dev/null
fi

step "4/5  Git safety hook (blocks committing .env files or API keys)"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  chmod +x scripts/hooks/pre-commit
  git config core.hooksPath scripts/hooks
  echo "Installed."
else
  echo "Not a git checkout; skipped."
fi

step "5/5  Checking everything"
if npm run doctor --silent; then
  echo "Start the app with: npm run dev"
  echo "Then open: http://localhost:5173/split.html"
else
  echo "Fix the items above, then run: npm run doctor"
  exit 1
fi
