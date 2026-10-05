#!/usr/bin/env bash
set -euo pipefail

# Run on the VPS after the Docker backend and the static dist directories exist.
if [[ "$(id -u)" -ne 0 ]]; then
  echo 'Public-site setup requires the root deployment user.' >&2
  exit 1
fi

if [[ ! "${VPS_HOST:-}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo 'VPS_HOST must be the public IPv4 address of this server.' >&2
  exit 1
fi

if [[ -n "${CERTBOT_EMAIL:-}" && ! "$CERTBOT_EMAIL" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$ ]]; then
  echo 'CERTBOT_EMAIL must be a valid email address.' >&2
  exit 1
fi

if ! command -v nginx >/dev/null || [[ ! -d /etc/nginx/sites-enabled ]]; then
  echo 'A host Nginx installation with /etc/nginx/sites-enabled is required.' >&2
  echo 'The current HTTP listener may be a Docker container; inspect it before changing its routing.' >&2
  ss -H -ltnp '( sport = :80 or sport = :443 )' 2>/dev/null || true
  docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null || true
  exit 1
fi

for app in frontend admin owner data-entry villa-manager; do
  if [[ ! -s "/var/www/bookmyvilla/$app/dist/index.html" ]]; then
    echo "Missing production build: $app/dist/index.html" >&2
    exit 1
  fi
  chmod 755 "/var/www/bookmyvilla/$app"
  chmod -R a+rX "/var/www/bookmyvilla/$app/dist"
done
chmod 755 /var/www/bookmyvilla
install -d -m 755 /var/www/certbot

dns_points_here() {
  getent ahostsv4 "$1" | awk -v expected="$VPS_HOST" '$1 == expected { found = 1 } END { exit !found }'
}

domains=(bookmyvilla.online api.bookmyvilla.online admin.bookmyvilla.online)
for domain in "${domains[@]}"; do
  if ! dns_points_here "$domain"; then
    echo "$domain does not resolve to $VPS_HOST; fix its A record before requesting TLS." >&2
    exit 1
  fi
done

for portal in owner dataentry villamanage; do
  if dns_points_here "$portal.bookmyvilla.online"; then
    domains+=("$portal.bookmyvilla.online")
  else
    echo "::warning::$portal.bookmyvilla.online has no A record for this VPS. Add it and rerun deployment to enable portal TLS."
  fi
done

reload_nginx() {
  if systemctl is-active --quiet nginx; then
    systemctl reload nginx
  elif pgrep -x nginx >/dev/null; then
    nginx -s reload
  else
    systemctl start nginx
  fi
}

site=/etc/nginx/sites-available/bookmyvilla.online
link=/etc/nginx/sites-enabled/bookmyvilla.online
if [[ -e "$link" && ! -L "$link" ]] ||
  { [[ -L "$link" ]] && [[ "$(readlink -f "$link")" != "$site" ]]; }; then
  echo "$link is managed outside this deployment; inspect it before replacing the Nginx site." >&2
  exit 1
fi
backup=$(mktemp)
had_site=false
if [[ -f "$site" ]]; then
  cp -p "$site" "$backup"
  had_site=true
fi
had_link=false
if [[ -e "$link" || -L "$link" ]]; then
  had_link=true
fi
config_changed=false

restore_on_failure() {
  status=$?
  if [[ "$status" -ne 0 && "$config_changed" == true ]]; then
    if [[ "$had_site" == true ]]; then
      cp -p "$backup" "$site"
    else
      rm -f "$site"
    fi
    if [[ "$had_link" == false ]]; then
      rm -f "$link"
    fi
    nginx -t && reload_nginx || true
  fi
  rm -f "$backup"
}
trap restore_on_failure EXIT

cert_dir=/etc/letsencrypt/live/bookmyvilla.online
needs_cert=false
if [[ ! -s "$cert_dir/fullchain.pem" || ! -s "$cert_dir/privkey.pem" ]] ||
  ! openssl x509 -in "$cert_dir/fullchain.pem" -noout -checkend 604800 >/dev/null 2>&1; then
  needs_cert=true
else
  for domain in "${domains[@]}"; do
    if ! openssl x509 -in "$cert_dir/fullchain.pem" -noout -ext subjectAltName 2>/dev/null | grep -Fq "DNS:$domain"; then
      needs_cert=true
      break
    fi
  done
fi

if [[ "$needs_cert" == true ]]; then
  if ! command -v certbot >/dev/null; then
    apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq certbot
  fi

  install -m 644 /var/www/bookmyvilla/nginx/bookmyvilla.online.http.conf "$site"
  ln -sfn "$site" "$link"
  config_changed=true
  nginx -t
  reload_nginx

  certbot_args=(certonly --webroot --webroot-path /var/www/certbot
    --cert-name bookmyvilla.online --agree-tos --non-interactive)
  if [[ -n "${CERTBOT_EMAIL:-}" ]]; then
    certbot_args+=(--email "$CERTBOT_EMAIL")
  else
    echo '::warning::CERTBOT_EMAIL is unset; certificate expiry notices will not be emailed.'
    certbot_args+=(--register-unsafely-without-email)
  fi
  if [[ -s "$cert_dir/fullchain.pem" ]]; then
    certbot_args+=(--expand)
  fi
  for domain in "${domains[@]}"; do
    certbot_args+=(-d "$domain")
  done
  certbot "${certbot_args[@]}"
fi

install -m 644 /var/www/bookmyvilla/nginx/bookmyvilla.online.conf "$site"
ln -sfn "$site" "$link"
config_changed=true
nginx -t
reload_nginx

install -d -m 755 /etc/letsencrypt/renewal-hooks/deploy
printf '%s\n' '#!/usr/bin/env bash' 'nginx -s reload' \
  > /etc/letsencrypt/renewal-hooks/deploy/bookmyvilla-nginx.sh
chmod 755 /etc/letsencrypt/renewal-hooks/deploy/bookmyvilla-nginx.sh
if systemctl list-unit-files certbot.timer --no-legend 2>/dev/null | grep -q '^certbot.timer'; then
  systemctl enable --now certbot.timer
else
  echo '::warning::No certbot.timer found; verify the installed Certbot renewal schedule.'
fi

config_changed=false
echo 'BookMyVilla public Nginx routing and TLS are active.'
