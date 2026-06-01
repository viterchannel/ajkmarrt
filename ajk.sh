#!/bin/bash
# ════════════════════════════════════════════════════════════════════
#   AJKMart — Universal Smart Launcher
#   Usage:
#     bash ajk.sh replit      → Replit par full setup + start
#     bash ajk.sh codespace   → GitHub Codespace par full setup + start
#     bash ajk.sh vps         → VPS/Server par full setup + start (PM2)
#     bash ajk.sh localhost   → Local machine par full setup + start
#     bash ajk.sh stop        → Sab services band karo
#     bash ajk.sh api         → Sirf API Server start karo
#     bash ajk.sh admin       → Sirf Admin Panel start karo
#     bash ajk.sh vendor      → Sirf Vendor App start karo
#     bash ajk.sh rider       → Sirf Rider App start karo
#     bash ajk.sh ajkmart     → Sirf Customer/Expo App start karo
#     bash ajk.sh status      → Services ka live status dekho
# ════════════════════════════════════════════════════════════════════

# ── Paths ────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$SCRIPT_DIR/extracted/12345678"
PID_FILE="/tmp/ajkmart.pids"
LOG_DIR="/tmp/ajkmart-logs"

# ── Colors ───────────────────────────────────────────────────────────
G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'
B='\033[0;34m'; C='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()      { echo -e "${G}  ✓ $1${NC}"; }
fail()    { echo -e "${R}  ✗ $1${NC}"; exit 1; }
warn()    { echo -e "${Y}  ⚠ $1${NC}"; }
info()    { echo -e "${B}  → $1${NC}"; }
section() { echo -e "\n${BOLD}${C}━━━  $1  ━━━${NC}"; }
banner() {
  echo -e "${BOLD}"
  echo "  ╔══════════════════════════════════════════╗"
  echo "  ║        AJKMart Super-App Launcher        ║"
  echo "  ╚══════════════════════════════════════════╝"
  echo -e "${NC}"
}

# ── Check APP_DIR ────────────────────────────────────────────────────
check_app_dir() {
  if [ ! -d "$APP_DIR" ]; then
    fail "App directory not found: $APP_DIR"
  fi
  mkdir -p "$LOG_DIR"
}

# ── Check pnpm ───────────────────────────────────────────────────────
check_pnpm() {
  if ! command -v pnpm &>/dev/null; then
    warn "pnpm nahi mila — install ho raha hai..."
    npm install -g pnpm@10 || fail "Node.js install nahi hai. Pehle Node.js 20 install karo."
  fi
  ok "pnpm $(pnpm --version)"
}

# ── Install deps ─────────────────────────────────────────────────────
install_deps() {
  section "Dependencies Install"
  cd "$APP_DIR"
  if [ -d "node_modules" ] && [ -f "node_modules/.modules.yaml" ]; then
    ok "node_modules already exist — skip"
  else
    info "pnpm install chal raha hai (~2-5 min)..."
    HUSKY=0 pnpm install --no-frozen-lockfile || fail "pnpm install fail hua"
    ok "Dependencies install ho gayi"
  fi
}

# ── Generate secrets ─────────────────────────────────────────────────
gen_secrets() {
  section "Secrets Generate"
  cd "$APP_DIR"
  if [ -f ".env" ]; then
    ok ".env already hai — existing secrets safe hain"
  else
    node scripts/setup-replit.mjs || fail "Secrets generate nahi hue"
    ok "Secrets .env mein likh diye"
  fi
  # Load .env
  set -a; source "$APP_DIR/.env" 2>/dev/null || true; set +a
}

# ── Push DB schema ───────────────────────────────────────────────────
push_db() {
  section "Database Schema"
  cd "$APP_DIR"
  if [ -z "$DATABASE_URL" ]; then
    warn "DATABASE_URL set nahi hai — schema push skip"
    warn "Baad mein chalao: cd extracted/12345678 && pnpm --filter @workspace/db run push-force"
  else
    pnpm --filter @workspace/db run push-force || warn "Schema push fail — manually check karo"
    ok "Database schema sync ho gaya"
  fi
}

# ── Save PID ─────────────────────────────────────────────────────────
save_pid() {
  echo "$1:$2" >> "$PID_FILE"
}

# ── Start single service ──────────────────────────────────────────────
start_service() {
  local name="$1"
  local cmd="$2"
  local port="$3"
  local log="$LOG_DIR/${name}.log"

  info "Starting $name (port $port)..."
  export PATH="$APP_DIR/node_modules/.bin:$PATH"
  eval "$cmd" > "$log" 2>&1 &
  local pid=$!
  save_pid "$name" "$pid"
  ok "$name started (PID $pid) — logs: $log"
}

# ── Wait for port ────────────────────────────────────────────────────
wait_port() {
  local port="$1"
  local name="$2"
  local max=30
  local i=0
  while ! nc -z localhost "$port" 2>/dev/null; do
    sleep 1
    i=$((i+1))
    if [ "$i" -ge "$max" ]; then
      warn "$name port $port par nahi aya — logs check karo: $LOG_DIR/${name}.log"
      return 1
    fi
  done
  return 0
}

# ── Start ALL services ────────────────────────────────────────────────
start_all_services() {
  section "Services Start"
  rm -f "$PID_FILE"
  mkdir -p "$LOG_DIR"
  cd "$APP_DIR"

  # API first (others depend on it)
  start_service "api" \
    "cd $APP_DIR/artifacts/api-server && PORT=5000 PORT_FALLBACK_ENABLE=false NODE_ENV=development node ./scripts/start-with-restart.mjs" \
    5000

  info "API ke ready hone ka wait..."
  wait_port 5000 "api"

  # Then frontends
  start_service "admin" \
    "cd $APP_DIR && PORT=3000 BASE_PATH=/admin pnpm --filter @workspace/admin run dev" \
    3000

  start_service "vendor" \
    "cd $APP_DIR && PORT=3001 BASE_PATH=/vendor pnpm --filter @workspace/vendor-app run dev" \
    3001

  start_service "rider" \
    "cd $APP_DIR && PORT=3002 BASE_PATH=/rider pnpm --filter @workspace/rider-app run dev" \
    3002
}

# ── Stop ALL services ────────────────────────────────────────────────
cmd_stop() {
  section "Services Band"
  if [ ! -f "$PID_FILE" ]; then
    warn "Koi running services nahi mili (PID file nahi hai)"

    # Port kill bhi try karo
    for port in 5000 3000 3001 3002; do
      pid=$(lsof -ti ":$port" 2>/dev/null) || true
      if [ -n "$pid" ]; then
        kill "$pid" 2>/dev/null && ok "Port $port band kar diya (PID $pid)"
      fi
    done
    return
  fi

  while IFS=: read -r name pid; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null
      ok "$name band kar diya (PID $pid)"
    else
      info "$name already band tha"
    fi
  done < "$PID_FILE"

  rm -f "$PID_FILE"
  ok "Sab services band ho gayi"
}

# ── Print access URLs ─────────────────────────────────────────────────
print_urls() {
  local base_url="$1"
  echo ""
  echo -e "${BOLD}${G}  ════════════════════════════════════════════${NC}"
  echo -e "${BOLD}${G}    ✅  AJKMart chal raha hai!${NC}"
  echo -e "${BOLD}${G}  ════════════════════════════════════════════${NC}"
  echo ""
  echo -e "  ${BOLD}Service       URL${NC}"
  echo -e "  Hub Page    → ${C}${base_url}/${NC}"
  echo -e "  Admin Panel → ${C}${base_url}/admin/${NC}"
  echo -e "  Vendor App  → ${C}${base_url}/vendor/${NC}"
  echo -e "  Rider App   → ${C}${base_url}/rider/${NC}"
  echo -e "  API Health  → ${C}${base_url}/api/health${NC}"
  echo -e "  API Docs    → ${C}${base_url}/api/docs${NC}"
  echo ""
  echo -e "  ${BOLD}Admin Login:${NC} superadmin / Admin@123"
  echo ""
  echo -e "  ${Y}Logs:${NC} $LOG_DIR/"
  echo -e "  ${Y}Band karne ke liye:${NC} bash ajk.sh stop"
  echo ""
}

# ── Status command ───────────────────────────────────────────────────
cmd_status() {
  source "$APP_DIR/.env" 2>/dev/null || true

  local SERVICES=("api:5000:API Server" "admin:3000:Admin Panel" "vendor:3001:Vendor App" "rider:3002:Rider App")

  echo ""
  echo -e "  ${BOLD}${C}╔══════════════════════════════════════════════════════╗${NC}"
  echo -e "  ${BOLD}${C}║           AJKMart — Live Status                      ║${NC}"
  echo -e "  ${BOLD}${C}╚══════════════════════════════════════════════════════╝${NC}"
  echo -e "  $(date '+%Y-%m-%d %H:%M:%S')\n"

  # ── Services & Ports ──────────────────────────────────────────────
  echo -e "  ${BOLD}Services:${NC}"
  echo -e "  ┌─────────────────┬──────┬──────────┬───────────────────────────┐"
  echo -e "  │ Service         │ Port │ Status   │ PID                       │"
  echo -e "  ├─────────────────┼──────┼──────────┼───────────────────────────┤"

  for entry in "${SERVICES[@]}"; do
    IFS=: read -r svc port label <<< "$entry"

    # curl is reliable across all environments including Replit workflows
    http_probe=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 "http://localhost:${port}/" 2>/dev/null)
    if [[ "$http_probe" =~ ^[1-9] ]]; then
      port_pid=$(lsof -ti ":$port" 2>/dev/null | tr '\n' ',' | sed 's/,$//')
      [ -z "$port_pid" ] && port_pid="workflow"
      svc_status="${G}RUNNING${NC}"
      pid_info="$port_pid"
    else
      svc_status="${R}STOPPED${NC}"
      pid_info="—"
    fi

    printf "  │ %-15s │ %-4s │ " "$label" "$port"
    echo -ne "$svc_status"
    printf "  │ %-25s │\n" "$pid_info"
  done

  echo -e "  └─────────────────┴──────┴──────────┴───────────────────────────┘"

  # ── HTTP Health checks ────────────────────────────────────────────
  echo -e "\n  ${BOLD}HTTP Health:${NC}"
  echo -e "  ┌──────────────────────────────┬─────────────────┐"
  echo -e "  │ Endpoint                     │ Response        │"
  echo -e "  ├──────────────────────────────┼─────────────────┤"

  declare -A ENDPOINTS=(
    ["/api/health"]="API Health"
    ["/admin/"]="Admin Panel"
    ["/vendor/"]="Vendor App"
    ["/rider/"]="Rider App"
  )

  for path in "/api/health" "/admin/" "/vendor/" "/rider/"; do
    label="${ENDPOINTS[$path]}"
    http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "http://localhost:5000${path}" 2>/dev/null)
    if [ "$http_code" = "200" ] || [ "$http_code" = "304" ]; then
      resp_str="${G}HTTP $http_code  ✓${NC}"
    elif [ -z "$http_code" ] || [ "$http_code" = "000" ]; then
      resp_str="${R}No response${NC}"
    else
      resp_str="${Y}HTTP $http_code${NC}"
    fi
    printf "  │ %-28s │ " "$path"
    echo -ne "$resp_str"
    printf "        │\n"
  done

  echo -e "  └──────────────────────────────┴─────────────────┘"

  # ── Database connectivity ─────────────────────────────────────────
  echo -e "\n  ${BOLD}Database:${NC}"
  if [ -z "$DATABASE_URL" ]; then
    echo -e "  ${R}  ✗ DATABASE_URL set nahi hai${NC}"
  else
    # Mask credentials for display
    SAFE_URL=$(echo "$DATABASE_URL" | sed 's|://[^:]*:[^@]*@|://****:****@|')
    echo -e "  ${B}  URL: $SAFE_URL${NC}"
    # Try a quick psql ping
    if command -v psql &>/dev/null; then
      if psql "$DATABASE_URL" -c "SELECT 1" -t -q &>/dev/null; then
        echo -e "  ${G}  ✓ Database connected (psql ping OK)${NC}"
      else
        echo -e "  ${R}  ✗ Database connect fail (psql ping failed)${NC}"
      fi
    elif command -v node &>/dev/null; then
      # Use node as fallback DB check via pg module
      DB_CHECK=$(node -e "
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 });
c.connect().then(() => { console.log('ok'); c.end(); }).catch(e => { console.log('fail:' + e.message); });
" 2>/dev/null)
      if [[ "$DB_CHECK" == "ok" ]]; then
        echo -e "  ${G}  ✓ Database connected${NC}"
      elif [[ -z "$DB_CHECK" ]]; then
        echo -e "  ${Y}  ⚠ Database check skipped (pg module not available)${NC}"
      else
        echo -e "  ${R}  ✗ Database error: $DB_CHECK${NC}"
      fi
    else
      echo -e "  ${Y}  ⚠ psql/node not available — database ping skip${NC}"
    fi
  fi

  # ── .env & Secrets check ──────────────────────────────────────────
  echo -e "\n  ${BOLD}Secrets:${NC}"
  if [ -f "$APP_DIR/.env" ]; then
    secret_count=$(grep -c "^[A-Z]" "$APP_DIR/.env" 2>/dev/null || echo 0)
    jwt_set=$(grep -c "^JWT_SECRET=" "$APP_DIR/.env" 2>/dev/null || echo 0)
    if [ "$jwt_set" -gt 0 ]; then
      echo -e "  ${G}  ✓ .env exists ($secret_count vars) — JWT_SECRET set${NC}"
    else
      echo -e "  ${Y}  ⚠ .env exists but JWT_SECRET missing — run: node extracted/12345678/scripts/setup-replit.mjs${NC}"
    fi
  else
    echo -e "  ${R}  ✗ .env nahi hai — run: node extracted/12345678/scripts/setup-replit.mjs${NC}"
  fi

  # ── node_modules check ────────────────────────────────────────────
  echo -e "\n  ${BOLD}Dependencies:${NC}"
  if [ -d "$APP_DIR/node_modules" ] && [ -f "$APP_DIR/node_modules/.modules.yaml" ]; then
    echo -e "  ${G}  ✓ node_modules installed${NC}"
  else
    echo -e "  ${R}  ✗ node_modules missing — run: bash ajk.sh replit${NC}"
  fi

  # ── Log files ─────────────────────────────────────────────────────
  echo -e "\n  ${BOLD}Logs:${NC}"
  if [ -d "$LOG_DIR" ] && ls "$LOG_DIR"/*.log &>/dev/null; then
    for log in "$LOG_DIR"/*.log; do
      size=$(wc -l < "$log" 2>/dev/null || echo 0)
      name=$(basename "$log" .log)
      last=$(tail -1 "$log" 2>/dev/null | cut -c1-55 || echo "—")
      echo -e "  ${B}  $name${NC} ($size lines) — $last"
    done
  else
    echo -e "  ${Y}  ⚠ Koi log files nahi — ajk.sh se start karne par logs yahaan aayenge${NC}"
  fi

  echo ""
  echo -e "  ${Y}Refresh ke liye:${NC} bash ajk.sh status"
  echo -e "  ${Y}Band karne ke liye:${NC} bash ajk.sh stop"
  echo ""
}

# ════════════════════════════════════════════════════════════════════
#   COMMANDS
# ════════════════════════════════════════════════════════════════════

CMD="${1:-help}"

# ── STATUS ───────────────────────────────────────────────────────────
if [ "$CMD" = "status" ]; then
  check_app_dir
  cmd_status
  exit 0
fi

# ── STOP ─────────────────────────────────────────────────────────────
if [ "$CMD" = "stop" ]; then
  banner
  cmd_stop
  exit 0
fi

# ── INDIVIDUAL SERVICES ───────────────────────────────────────────────
if [ "$CMD" = "api" ]; then
  banner
  check_app_dir
  cd "$APP_DIR/artifacts/api-server"
  echo -e "${BOLD}API Server start ho raha hai — port 5000${NC}"
  echo -e "${Y}Band karne ke liye: Ctrl+C${NC}\n"
  PORT=5000 PORT_FALLBACK_ENABLE=false NODE_ENV=development node ./scripts/start-with-restart.mjs
  exit 0
fi

if [ "$CMD" = "admin" ]; then
  banner
  check_app_dir
  cd "$APP_DIR"
  echo -e "${BOLD}Admin Panel start ho raha hai — port 3000${NC}"
  echo -e "${Y}Band karne ke liye: Ctrl+C${NC}\n"
  PORT=3000 BASE_PATH=/admin pnpm --filter @workspace/admin run dev
  exit 0
fi

if [ "$CMD" = "vendor" ]; then
  banner
  check_app_dir
  cd "$APP_DIR"
  echo -e "${BOLD}Vendor App start ho raha hai — port 3001${NC}"
  echo -e "${Y}Band karne ke liye: Ctrl+C${NC}\n"
  PORT=3001 BASE_PATH=/vendor pnpm --filter @workspace/vendor-app run dev
  exit 0
fi

if [ "$CMD" = "rider" ]; then
  banner
  check_app_dir
  cd "$APP_DIR"
  echo -e "${BOLD}Rider App start ho raha hai — port 3002${NC}"
  echo -e "${Y}Band karne ke liye: Ctrl+C${NC}\n"
  PORT=3002 BASE_PATH=/rider pnpm --filter @workspace/rider-app run dev
  exit 0
fi

if [ "$CMD" = "ajkmart" ]; then
  banner
  check_app_dir
  cd "$APP_DIR/artifacts/ajkmart"
  echo -e "${BOLD}AJKMart Customer App (Expo) start ho raha hai${NC}"
  echo -e "${Y}Band karne ke liye: Ctrl+C${NC}\n"
  npx expo start
  exit 0
fi

# ════════════════════════════════════════════════════════════════════
#   ENVIRONMENT SETUPS
# ════════════════════════════════════════════════════════════════════

# ── REPLIT ───────────────────────────────────────────────────────────
if [ "$CMD" = "replit" ]; then
  banner
  echo -e "  ${BOLD}Environment: Replit${NC}\n"
  check_app_dir
  check_pnpm

  # ── Step 1: Install deps ────────────────────────────────────────────
  install_deps

  # ── Step 2: Binary symlinks ─────────────────────────────────────────
  section "Binary Symlinks"
  WS="$APP_DIR"
  VITE_PKG=$(ls -d "$WS/node_modules/.pnpm/vite@7."* 2>/dev/null | head -1)
  if [ -n "$VITE_PKG" ]; then
    VITE_BIN="$VITE_PKG/node_modules/vite/bin/vite.js"
    for dir in "$WS" "$WS/artifacts/admin" "$WS/artifacts/rider-app" "$WS/artifacts/vendor-app"; do
      mkdir -p "$dir/node_modules/.bin"
      ln -sf "$VITE_BIN" "$dir/node_modules/.bin/vite" 2>/dev/null || true
    done
    ok "Vite symlinks set"
  fi
  DRIZZLE_PKG=$(ls -d "$WS/node_modules/.pnpm/drizzle-kit@"* 2>/dev/null | head -1)
  if [ -n "$DRIZZLE_PKG" ]; then
    DRIZZLE_BIN="$DRIZZLE_PKG/node_modules/drizzle-kit/bin.cjs"
    mkdir -p "$WS/node_modules/.bin"
    ln -sf "$DRIZZLE_BIN" "$WS/node_modules/.bin/drizzle-kit" 2>/dev/null || true
    ok "Drizzle-kit symlink set"
  fi

  # ── Step 3: Secrets ─────────────────────────────────────────────────
  gen_secrets

  # ── Step 4: DB schema ───────────────────────────────────────────────
  push_db

  # ── Step 5: Services — Replit workflows handle this ─────────────────
  section "Services"
  ok "Setup mukammal — Replit workflows services handle karti hain"
  info "Run button ya workflow tabs se sab 4 services auto-start hoti hain"
  info "API :5000  |  Admin :3000  |  Vendor :3001  |  Rider :3002"

  # Show current port status
  echo ""
  for svc_info in "API Server:5000" "Admin Panel:3000" "Vendor App:3001" "Rider App:3002"; do
    IFS=: read -r svc_name svc_port <<< "$svc_info"
    http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 "http://localhost:${svc_port}/" 2>/dev/null)
    if [[ "$http_code" =~ ^[1-9] ]]; then
      ok "$svc_name (port $svc_port) — RUNNING"
    else
      warn "$svc_name (port $svc_port) — not yet started (workflow start karo)"
    fi
  done

  REPLIT_URL="https://${REPLIT_DEV_DOMAIN:-localhost:5000}"
  print_urls "$REPLIT_URL"
  exit 0
fi

# ── CODESPACE ────────────────────────────────────────────────────────
if [ "$CMD" = "codespace" ]; then
  if [ -n "$REPL_ID" ]; then
    banner
    echo -e "  ${R}✗ Yeh Replit environment hai!${NC}"
    echo -e "  ${Y}  'codespace' command sirf GitHub Codespace ke liye hai.${NC}"
    echo -e "  ${Y}  Replit par ye chalao:${NC}  ${BOLD}bash ajk.sh replit${NC}\n"
    exit 1
  fi
  banner
  echo -e "  ${BOLD}Environment: GitHub Codespace${NC}\n"
  check_app_dir
  check_pnpm
  install_deps
  gen_secrets
  push_db
  start_all_services

  # Codespace URL
  if [ -n "$CODESPACE_NAME" ]; then
    BASE="https://${CODESPACE_NAME}-5000.app.github.dev"
  else
    BASE="http://localhost:5000"
  fi
  print_urls "$BASE"

  wait
  exit 0
fi

# ── VPS ──────────────────────────────────────────────────────────────
if [ "$CMD" = "vps" ]; then
  if [ -n "$REPL_ID" ]; then
    banner
    echo -e "  ${R}✗ Yeh Replit environment hai!${NC}"
    echo -e "  ${Y}  'vps' command sirf VPS/Server ke liye hai.${NC}"
    echo -e "  ${Y}  Replit par ye chalao:${NC}  ${BOLD}bash ajk.sh replit${NC}\n"
    exit 1
  fi
  banner
  echo -e "  ${BOLD}Environment: VPS / Server${NC}\n"
  check_app_dir
  check_pnpm
  install_deps

  # DATABASE_URL check
  source "$APP_DIR/.env" 2>/dev/null || true
  if [ -z "$DATABASE_URL" ]; then
    echo -e "${Y}DATABASE_URL set nahi hai.${NC}"
    echo -n "  PostgreSQL URL enter karo (ya Enter skip karo): "
    read -r DB_URL
    if [ -n "$DB_URL" ]; then
      echo "DATABASE_URL=$DB_URL" >> "$APP_DIR/.env"
      export DATABASE_URL="$DB_URL"
      ok "DATABASE_URL set kar diya"
    fi
  fi

  gen_secrets
  push_db

  # PM2 use karo VPS par
  if command -v pm2 &>/dev/null; then
    section "PM2 se Services Start"
    cd "$APP_DIR"
    pm2 delete ajkmart-api ajkmart-admin ajkmart-vendor ajkmart-rider 2>/dev/null || true
    pm2 start "cd $APP_DIR/artifacts/api-server && PORT=5000 NODE_ENV=production node ./scripts/start-with-restart.mjs" --name ajkmart-api
    pm2 start "cd $APP_DIR && PORT=3000 BASE_PATH=/admin pnpm --filter @workspace/admin run dev" --name ajkmart-admin
    pm2 start "cd $APP_DIR && PORT=3001 BASE_PATH=/vendor pnpm --filter @workspace/vendor-app run dev" --name ajkmart-vendor
    pm2 start "cd $APP_DIR && PORT=3002 BASE_PATH=/rider pnpm --filter @workspace/rider-app run dev" --name ajkmart-rider
    pm2 save
    ok "Sab services PM2 se start ho gayi"
    pm2 status
    echo -e "\n  ${Y}Logs:${NC} pm2 logs"
    echo -e "  ${Y}Status:${NC} pm2 status"
    echo -e "  ${Y}Band karne ke liye:${NC} pm2 delete all\n"
  else
    warn "PM2 nahi mila — background processes se start kar raha hai"
    info "PM2 install karne ke liye: npm install -g pm2"
    start_all_services
    print_urls "http://localhost:5000"
    wait
  fi
  exit 0
fi

# ── LOCALHOST ────────────────────────────────────────────────────────
if [ "$CMD" = "localhost" ]; then
  if [ -n "$REPL_ID" ]; then
    banner
    echo -e "  ${R}✗ Yeh Replit environment hai!${NC}"
    echo -e "  ${Y}  'localhost' command sirf local machine ke liye hai.${NC}"
    echo -e "  ${Y}  Replit par ye chalao:${NC}  ${BOLD}bash ajk.sh replit${NC}\n"
    exit 1
  fi
  banner
  echo -e "  ${BOLD}Environment: Local Machine${NC}\n"
  check_app_dir
  check_pnpm
  install_deps

  # DATABASE_URL check
  source "$APP_DIR/.env" 2>/dev/null || true
  if [ -z "$DATABASE_URL" ]; then
    echo -e "${Y}DATABASE_URL set nahi hai.${NC}"
    echo "  Default: postgresql://postgres:password@localhost:5432/ajkmart"
    echo -n "  Custom URL enter karo (ya Enter default ke liye): "
    read -r DB_URL
    if [ -n "$DB_URL" ]; then
      echo "DATABASE_URL=$DB_URL" >> "$APP_DIR/.env"
    else
      echo "DATABASE_URL=postgresql://postgres:password@localhost:5432/ajkmart" >> "$APP_DIR/.env"
    fi
    source "$APP_DIR/.env"
    ok "DATABASE_URL set"
  fi

  gen_secrets
  push_db
  start_all_services
  print_urls "http://localhost:5000"

  wait
  exit 0
fi

# ── HELP ─────────────────────────────────────────────────────────────
banner
echo -e "  ${BOLD}Commands:${NC}"
echo ""
echo -e "  ${G}Environment Setup & Start:${NC}"
echo -e "    ${BOLD}bash ajk.sh replit${NC}     → Replit par full setup + sab services start"
echo -e "    ${BOLD}bash ajk.sh codespace${NC}  → GitHub Codespace par setup + start"
echo -e "    ${BOLD}bash ajk.sh vps${NC}        → VPS/Server par setup + PM2 se start"
echo -e "    ${BOLD}bash ajk.sh localhost${NC}  → Local machine par setup + start"
echo ""
echo -e "  ${G}Individual Services:${NC}"
echo -e "    ${BOLD}bash ajk.sh api${NC}        → Sirf API Server (port 5000)"
echo -e "    ${BOLD}bash ajk.sh admin${NC}      → Sirf Admin Panel (port 3000)"
echo -e "    ${BOLD}bash ajk.sh vendor${NC}     → Sirf Vendor App (port 3001)"
echo -e "    ${BOLD}bash ajk.sh rider${NC}      → Sirf Rider App (port 3002)"
echo -e "    ${BOLD}bash ajk.sh ajkmart${NC}    → Sirf Customer/Expo App"
echo ""
echo -e "  ${G}Control:${NC}"
echo -e "    ${BOLD}bash ajk.sh status${NC}     → Services ka live status, ports, DB check"
echo -e "    ${BOLD}bash ajk.sh stop${NC}       → Sab services band karo"
echo ""
echo -e "  ${Y}Example:${NC}"
echo -e "    bash ajk.sh replit"
echo -e "    bash ajk.sh status"
echo ""
