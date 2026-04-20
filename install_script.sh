#!/bin/bash
set -e

clear
echo "======================================"
echo "   Frappe Private App Production Setup"
echo "======================================"
echo ""

# ===== USER INPUT =====
read -p "📦 Enter full path of APP ZIP file: " APP_ZIP
read -p "📁 Enter App Folder Name: " APP_NAME
read -p "🏗 Enter New Bench Name: " BENCH_NAME
read -p "🌐 Enter Site Name (example.com): " SITE_NAME
read -p "🔑 Enter MariaDB Root Password: " DB_ROOT_PASS
read -p "👤 Enter Administrator Password: " ADMIN_PASS

echo ""
echo "SSL Setup Mode:"
echo "1) Let's Encrypt (Free SSL)"
echo "2) Custom SSL (Certificate files)"
echo "3) Skip SSL"
read -p "Choose option (1/2/3): " SSL_MODE

if [ "$SSL_MODE" == "1" ]; then
    read -p "📧 Enter Email for SSL alerts: " SSL_EMAIL
fi

if [ "$SSL_MODE" == "2" ]; then
    read -p "📄 Enter full path to SSL Certificate (.crt): " SSL_CRT
    read -p "🔐 Enter full path to SSL Private Key (.key): " SSL_KEY
fi

FRAPPE_BRANCH="version-15"

echo ""
echo "🚀 Starting Production Deployment..."
sleep 2

# ===== INSTALL SYSTEM DEPENDENCIES =====
echo "📦 Installing system dependencies..."
sudo apt update -y
sudo apt install -y git python3-dev python3-setuptools python3-pip python3-distutils \
redis-server xvfb libfontconfig wkhtmltopdf \
mariadb-server mariadb-client libmariadb-dev libffi-dev build-essential \
libssl-dev nginx curl unzip software-properties-common

# ===== INSTALL NODE =====
if ! command -v node >/dev/null 2>&1; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# ===== INSTALL YARN =====
if ! command -v yarn >/dev/null 2>&1; then
    sudo npm install -g yarn
fi

# ===== INSTALL BENCH =====
if ! command -v bench >/dev/null 2>&1; then
    echo "📦 Installing Frappe Bench..."
    pip3 install frappe-bench
fi

# ===== CREATE NEW BENCH =====
echo "🏗 Creating bench: $BENCH_NAME"
bench init $BENCH_NAME --frappe-branch $FRAPPE_BRANCH
cd $BENCH_NAME

# ===== ADD APP FROM ZIP =====
echo "📦 Extracting app..."
mkdir -p apps
unzip -q $APP_ZIP -d apps/
mv apps/$APP_NAME-* apps/$APP_NAME 2>/dev/null || true

# ===== INSTALL PYTHON REQUIREMENTS =====
if [ -f "apps/$APP_NAME/requirements.txt" ]; then
    echo "📦 Installing Python dependencies..."
    pip3 install -r apps/$APP_NAME/requirements.txt
fi

# ===== BENCH REQUIREMENTS =====
bench setup requirements
bench build

# ===== CREATE SITE =====
echo "🌐 Creating site..."
bench new-site $SITE_NAME --admin-password $ADMIN_PASS --mariadb-root-password $DB_ROOT_PASS

# ===== INSTALL APP =====
echo "🔧 Installing app..."
bench --site $SITE_NAME install-app $APP_NAME
bench use $SITE_NAME

# ===== PRODUCTION SETUP =====
echo "🚀 Enabling production mode..."
sudo bench setup production $USER

# ===== SSL SETUP =====
if [ "$SSL_MODE" == "1" ]; then
    echo "🔐 Installing Let's Encrypt SSL..."
    sudo bench setup lets-encrypt $SITE_NAME --email $SSL_EMAIL
fi

if [ "$SSL_MODE" == "2" ]; then
    echo "🔐 Configuring Custom SSL..."

    SSL_DIR="/etc/nginx/ssl/$SITE_NAME"
    sudo mkdir -p $SSL_DIR
    sudo cp $SSL_CRT $SSL_DIR/site.crt
    sudo cp $SSL_KEY $SSL_DIR/site.key

    NGINX_CONF="/etc/nginx/conf.d/$SITE_NAME.conf"

    sudo bash -c "cat > $NGINX_CONF" <<EOL
server {
    listen 443 ssl;
    server_name $SITE_NAME;

    ssl_certificate $SSL_DIR/site.crt;
    ssl_certificate_key $SSL_DIR/site.key;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOL

    sudo nginx -t && sudo systemctl reload nginx
fi

if [ "$SSL_MODE" == "3" ]; then
    echo "⚠️ SSL skipped. You can configure later."
fi

echo ""
echo "======================================"
echo " 🎉 DEPLOYMENT COMPLETED SUCCESSFULLY"
echo "======================================"
echo ""
echo "🌍 Site URL: http://$SITE_NAME"
[ "$SSL_MODE" != "3" ] && echo "🔐 HTTPS URL: https://$SITE_NAME"
echo "📁 Bench Path: $(pwd)"
echo ""