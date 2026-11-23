#!/usr/bin/env bash
# Check the lab is up, start it if not, then run the collection with Newman.
# Usage: ./postman/run-collection.sh [LAB_BASE]   (default http://127.0.0.1:7834)
# Pass/fail: parsed from the JUnit XML export, never the CLI tail.
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
LAB_BASE="${1:-http://127.0.0.1:7834}"
# The durable checkout (the shelf standalone clone), not a /tmp build checkout: .env lives there.
COMPOSE_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
if [ ! -f "$COMPOSE_DIR/docker-compose.yml" ]; then
  ALT="$HOME/Development/AI-DEMO-Standalone/standalone/ciba-approval-sequence-LAB"
  [ -f "$ALT/docker-compose.yml" ] && COMPOSE_DIR="$ALT"
fi
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

start_lab() {
  echo "== lab not answering at $LAB_BASE — starting docker compose"
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    # OrbStack first (this machine's docker is OrbStack, never Docker Desktop).
    pgrep -xq OrbStack || open -a OrbStack 2>/dev/null || true
    ( cd "$COMPOSE_DIR" && docker compose up -d --build ) >&2 || { echo "   docker compose failed"; return 1; }
  else
    echo "   no docker compose; trying a host run (PORT=7834 npm start)"
    ( cd "$COMPOSE_DIR/server" && PORT=7834 nohup npm start </dev/null >/tmp/ciba-lab.log 2>&1 & disown ) || return 1
  fi
  for _ in $(seq 1 30); do
    curl -s -m 2 "$LAB_BASE/api/health" >/dev/null 2>&1 && return 0
    sleep 1
  done
  return 1
}

echo "== checking $LAB_BASE/api/health"
curl -s -m 2 "$LAB_BASE/api/health" >/dev/null 2>&1 || start_lab || { echo "== lab did not come up; aborting"; exit 1; }
echo "   up"

XML="$OUT/junit.xml"
npx --yes newman@6 run "$ROOT/postman/ciba-approval-sequence-lab.postman_collection.json" \
  --env-var "LAB_BASE=$LAB_BASE" \
  --reporters cli,junit --reporter-junit-export "$XML"

python3 - "$XML" <<'PY'
import sys, xml.etree.ElementTree as ET
try:
    t = ET.parse(sys.argv[1]); total = fail = err = 0
    for s in t.getroot().findall('testsuite'):
        total += int(s.get('tests') or 0); fail += int(s.get('failures') or 0); err += int(s.get('errors') or 0)
    if total == 0: print("VERDICT: NOASSERTIONS"); sys.exit(2)
    print(f"VERDICT: {'PASS' if fail == err == 0 else 'FAIL'} ({total} assertions, {fail + err} failed)")
    sys.exit(0 if fail == err == 0 else 1)
except Exception:
    print("VERDICT: NORUN"); sys.exit(2)
PY
