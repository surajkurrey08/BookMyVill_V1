#!/usr/bin/env bash
set -euo pipefail

# Run as root on a Debian/Ubuntu VPS after DNS points at this host.
if [[ "$(id -u)" -ne 0 ]]; then
  echo 'Deployment user must be root.' >&2
  exit 1
fi
if [[ ! "${CERTBOT_EMAIL:-}" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$ ]]; then
  echo 'CERTBOT_EMAIL must be a valid email address.' >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx certbot rsync curl ca-certificates

if ! command -v node >/dev/null || [[ "$(node -p 'parseInt(process.versions.node)')" -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi
command -v pm2 >/dev/null || npm install -g pm2

install -d /var/www/bookmyvilla/frontend /var/www/bookmyvilla/admin \
  /var/www/bookmyvilla/owner /var/www/bookmyvilla/backend /var/www/certbot
rm -f /etc/nginx/sites-enabled/default

cert_dir=/etc/letsencrypt/live/bookmyvilla.online
if [[ ! -f "$cert_dir/fullchain.pem" || ! -f "$cert_dir/privkey.pem" ]]; then
  install -m 644 /tmp/bookmyvilla-deploy/bookmyvilla.online.http.conf \
    /etc/nginx/sites-available/bookmyvilla.online
  ln -sfn /etc/nginx/sites-available/bookmyvilla.online \
    /etc/nginx/sites-enabled/bookmyvilla.online
  nginx -t
  systemctl enable --now nginx
  systemctl reload nginx

  certbot certonly --webroot --webroot-path /var/www/certbot \
    --cert-name bookmyvilla.online \
    -d bookmyvilla.online -d api.bookmyvilla.online \
    -d admin.bookmyvilla.online -d owner.bookmyvilla.online \
    --email "$CERTBOT_EMAIL" --agree-tos --non-interactive
fi

install -m 644 /tmp/bookmyvilla-deploy/bookmyvilla.online.conf \
  /etc/nginx/sites-available/bookmyvilla.online
ln -sfn /etc/nginx/sites-available/bookmyvilla.online \
  /etc/nginx/sites-enabled/bookmyvilla.online
nginx -t
systemctl reload nginx

install -d /etc/letsencrypt/renewal-hooks/deploy
printf '%s\n' '#!/usr/bin/env bash' 'systemctl reload nginx' \
  > /etc/letsencrypt/renewal-hooks/deploy/bookmyvilla-nginx.sh
chmod 755 /etc/letsencrypt/renewal-hooks/deploy/bookmyvilla-nginx.sh
systemctl enable --now certbot.timer
