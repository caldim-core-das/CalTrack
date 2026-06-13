#!/bin/bash
# =============================================================================
# CALTRACK — VPS Deployment Script
# Run this on the VPS after cloning/uploading the code.
# URL: caldimproducts.com/Caltrack
#
# USAGE:
#   chmod +x deploy.sh
#   sudo bash deploy.sh
#
# ⚠ SAFE: Does NOT touch any existing apps in /var/www/
# =============================================================================

set -e  # exit on any error

APP_DIR="/var/www/Caltrack"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIST="$APP_DIR/frontend_dist"
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"   # directory where deploy.sh lives

echo "========================================"
echo " CALTRACK VPS Deployment"
echo " Target: $APP_DIR"
echo "========================================"

# ─── 1. Create directory structure ───────────────────────────────────────────
echo "[1/9] Creating directory structure..."
mkdir -p "$APP_DIR"/{backend,frontend_dist,media,staticfiles,logs}

# ─── 2. Check Docker is installed ────────────────────────────────────────────
echo "[2/9] Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo "  Docker not found — installing..."
    curl -fsSL https://get.docker.com | bash
    systemctl enable docker
    systemctl start docker
else
    echo "  Docker already installed: $(docker --version)"
fi

# ─── 3. Start Docker services (PostgreSQL + Redis) ───────────────────────────
echo "[3/9] Starting PostgreSQL + Redis containers..."
if [ "$REPO_DIR" != "$APP_DIR" ]; then
    cp "$REPO_DIR/docker-compose.prod.yml" "$APP_DIR/"
    cp "$REPO_DIR/backend/.env.production" "$APP_DIR/backend/.env"
else
    if [ ! -f "$APP_DIR/backend/.env" ]; then
        cp "$APP_DIR/backend/.env.production" "$APP_DIR/backend/.env"
    fi
fi

cd "$APP_DIR"
docker compose -f docker-compose.prod.yml up -d

echo "  Waiting 15 seconds for PostgreSQL to be ready..."
sleep 15

# ─── 4. Setup Python virtualenv + install dependencies ───────────────────────
echo "[4/9] Setting up Python environment..."
if [ "$REPO_DIR" != "$APP_DIR" ]; then
    cp -r "$REPO_DIR/backend/." "$BACKEND_DIR/"
fi
cd "$BACKEND_DIR"

if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# ─── 5. Run Django migrations ─────────────────────────────────────────────────
echo "[5/9] Running Django migrations..."
python manage.py migrate --noinput

# ─── 6. Collect static files ─────────────────────────────────────────────────
echo "[6/9] Collecting static files..."
python manage.py collectstatic --noinput

# ─── 7. Build and Copy React frontend build ──────────────────────────────────
echo "[7/9] Setting up React frontend..."
if [ "$REPO_DIR" != "$APP_DIR" ]; then
    mkdir -p "$APP_DIR/frontend"
    cp -r "$REPO_DIR/frontend/." "$APP_DIR/frontend/"
fi

# Build on VPS if dist doesn't exist or --build-frontend is specified
if [ ! -d "$APP_DIR/frontend/dist" ] || [ "$1" == "--build-frontend" ]; then
    echo "  Building frontend on VPS..."
    if ! command -v node &> /dev/null; then
        echo "  Node.js not found — installing Node.js 20 LTS..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    else
        echo "  Node.js already installed: $(node -v)"
    fi

    cd "$APP_DIR/frontend"
    echo "  Installing npm dependencies..."
    npm ci --no-audit --no-fund --quiet || npm install --no-audit --no-fund --quiet
    echo "  Running npm run build..."
    npm run build
    cd "$APP_DIR"
fi

if [ -d "$APP_DIR/frontend/dist" ]; then
    cp -r "$APP_DIR/frontend/dist/." "$FRONTEND_DIST/"
    echo "  Frontend copied to $FRONTEND_DIST"
elif [ -d "$REPO_DIR/frontend/dist" ]; then
    cp -r "$REPO_DIR/frontend/dist/." "$FRONTEND_DIST/"
    echo "  Frontend copied from local build in repo"
else
    echo "  ERROR: frontend/dist not found and could not be built."
    exit 1
fi


# ─── 8. Create systemd services ───────────────────────────────────────────────
echo "[8/9] Creating systemd services..."

# caltrack-backend (Daphne ASGI)
cat > /etc/systemd/system/caltrack-backend.service << 'EOF'
[Unit]
Description=Caltrack Django Daphne ASGI Server
After=network.target docker.service
Requires=docker.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/Caltrack/backend
EnvironmentFile=/var/www/Caltrack/backend/.env
ExecStart=/var/www/Caltrack/backend/.venv/bin/daphne \
          -b 127.0.0.1 \
          -p 8001 \
          quicktims.asgi:application
Restart=always
RestartSec=5
StandardOutput=append:/var/www/Caltrack/logs/backend.log
StandardError=append:/var/www/Caltrack/logs/backend-error.log

[Install]
WantedBy=multi-user.target
EOF

# caltrack-celery (worker)
cat > /etc/systemd/system/caltrack-celery.service << 'EOF'
[Unit]
Description=Caltrack Celery Worker
After=network.target docker.service
Requires=docker.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/Caltrack/backend
EnvironmentFile=/var/www/Caltrack/backend/.env
ExecStart=/var/www/Caltrack/backend/.venv/bin/celery \
          -A quicktims worker \
          -l info \
          --logfile=/var/www/Caltrack/logs/celery.log \
          --pidfile=/var/www/Caltrack/logs/celery.pid
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# caltrack-beat (scheduler)
cat > /etc/systemd/system/caltrack-beat.service << 'EOF'
[Unit]
Description=Caltrack Celery Beat Scheduler
After=network.target docker.service
Requires=docker.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/Caltrack/backend
EnvironmentFile=/var/www/Caltrack/backend/.env
ExecStart=/var/www/Caltrack/backend/.venv/bin/celery \
          -A quicktims beat \
          -l info \
          --logfile=/var/www/Caltrack/logs/beat.log \
          --pidfile=/var/www/Caltrack/logs/beat.pid
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Fix permissions
chown -R www-data:www-data "$APP_DIR"

systemctl daemon-reload
systemctl enable caltrack-backend caltrack-celery caltrack-beat
systemctl restart caltrack-backend caltrack-celery caltrack-beat

echo "  Systemd services enabled and started."

# ─── 9. Reload Nginx ──────────────────────────────────────────────────────────
echo "[9/9] Testing Nginx config..."
nginx -t && echo "  Nginx config OK — run 'sudo systemctl reload nginx' to apply changes."
echo ""
echo "========================================"
echo " DEPLOYMENT COMPLETE"
echo " Visit: https://caldimproducts.com/Caltrack"
echo ""
echo " Service status:"
systemctl status caltrack-backend --no-pager -l | head -5
echo ""
echo " Next steps:"
echo "   1. Add the Nginx config block (see caltrack-nginx.conf)"
echo "   2. sudo systemctl reload nginx"
echo "   3. Create superuser: cd /var/www/Caltrack/backend && source .venv/bin/activate && python manage.py createsuperuser"
echo "========================================"
