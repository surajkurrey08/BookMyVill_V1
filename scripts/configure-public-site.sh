#!/usr/bin/env bash
set -euo pipefail

# Run on the VPS after the Docker backend and the static dist directories exist.
#
# Ports 80/443 on this VPS belong to a shared gateway container (another
# project's Nginx). This script never edits that project's files: it only adds
# conf.d/bookmyvilla.conf and the BookMyVilla certificate inside the gateway
# container, validates with `nginx -t`, and removes its file again on failure.
# Host Nginx serves BookMyVilla on a private port behind that gateway.
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

# ------------------------------------------------------------------
# Locate the gateway container that owns port 80.
# ------------------------------------------------------------------
gateway=${GATEWAY_CONTAINER:-$(docker ps --filter publish=80 --format '{{.Names}}' | awk 'NR == 1')}
if [[ -z "$gateway" ]]; then
  echo 'No running container publishes port 80; expected the shared gateway Nginx container.' >&2
  ss -H -ltnp '( sport = :80 or sport = :443 )' >&2 || true
  exit 1
fi
# grep without -q reads all input, so pipefail never sees a SIGPIPE from nginx.
if ! docker exec "$gateway" nginx -T 2>/dev/null | grep -F 'include /etc/nginx/conf.d/*.conf' >/dev/null; then
  echo "Gateway container $gateway is not an Nginx that includes /etc/nginx/conf.d/*.conf." >&2
  exit 1
fi
upstream=$(docker inspect --format '{{range .NetworkSettings.Networks}}{{.Gateway}} {{end}}' "$gateway" | awk '{print $1}')
if [[ ! "$upstream" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Could not determine the Docker bridge address of $gateway." >&2
  exit 1
fi
echo "Gateway container: $gateway (reaches host Nginx at $upstream:8090)"

gateway_conf=/etc/nginx/conf.d/bookmyvilla.conf
gateway_tls=/etc/nginx/bookmyvilla
cert_dir=/etc/letsencrypt/live/bookmyvilla.online

site=/etc/nginx/sites-available/bookmyvilla.online
link=/etc/nginx/sites-enabled/bookmyvilla.online
if [[ -e "$link" && ! -L "$link" ]] ||
  { [[ -L "$link" ]] && [[ "$(readlink -f "$link")" != "$site" ]]; }; then
  echo "$link is managed outside this deployment; inspect it before replacing the Nginx site." >&2
  exit 1
fi

# ------------------------------------------------------------------
# Backups so any failure restores the previous state.
# ------------------------------------------------------------------
host_backup=$(mktemp)
gateway_backup=$(mktemp)
rendered=$(mktemp)
had_site=false
if [[ -f "$site" ]]; then
  cp -p "$site" "$host_backup"
  had_site=true
fi
had_link=false
if [[ -e "$link" || -L "$link" ]]; then
  had_link=true
fi
had_gateway_conf=false
if docker exec "$gateway" test -f "$gateway_conf"; then
  docker exec "$gateway" cat "$gateway_conf" > "$gateway_backup"
  had_gateway_conf=true
fi
host_changed=false
gateway_changed=false

reload_host_nginx() {
  if systemctl is-active --quiet nginx; then
    systemctl reload nginx
  else
    systemctl reset-failed nginx 2>/dev/null || true
    if ! systemctl enable --now nginx; then
      echo 'Host Nginx could not start. Its listeners must not use ports 80/443:' >&2
      nginx -T 2>/dev/null | grep -nE '^\s*listen' >&2 || true
      journalctl -u nginx -n 20 --no-pager -o cat >&2 || true
      return 1
    fi
  fi
}

reload_gateway() {
  docker exec "$gateway" nginx -t
  docker exec "$gateway" nginx -s reload
}

# Never leave a file in the gateway that fails `nginx -t`: a later restart of
# that container would then take the other project's sites down.
restore_gateway() {
  if [[ "$had_gateway_conf" == true ]]; then
    docker cp "$gateway_backup" "$gateway:$gateway_conf" || true
  else
    docker exec "$gateway" rm -f "$gateway_conf" || true
  fi
  if ! docker exec "$gateway" nginx -t >/dev/null 2>&1; then
    docker exec "$gateway" rm -f "$gateway_conf" || true
  fi
  docker exec "$gateway" nginx -t >/dev/null 2>&1 && docker exec "$gateway" nginx -s reload || true
}

restore_on_failure() {
  status=$?
  if [[ "$status" -ne 0 ]]; then
    if [[ "$gateway_changed" == true ]]; then
      echo "Restoring the previous BookMyVilla config in $gateway." >&2
      restore_gateway
    fi
    if [[ "$host_changed" == true ]]; then
      if [[ "$had_site" == true ]]; then
        cp -p "$host_backup" "$site"
      else
        rm -f "$site"
      fi
      if [[ "$had_link" == false ]]; then
        rm -f "$link"
      fi
      nginx -t && reload_host_nginx || true
    fi
  fi
  rm -f "$host_backup" "$gateway_backup" "$rendered"
}
trap restore_on_failure EXIT

install_gateway_conf() {
  sed "s/__UPSTREAM__/$upstream/g" "$1" > "$rendered"
  chmod 644 "$rendered"
  gateway_changed=true
  docker cp "$rendered" "$gateway:$gateway_conf"
  reload_gateway
}

sync_gateway_certs() {
  docker exec "$gateway" mkdir -p "$gateway_tls"
  for pem in fullchain privkey; do
    docker cp -L "$cert_dir/$pem.pem" "$gateway:$gateway_tls/$pem.pem"
  done
}

# ------------------------------------------------------------------
# 1. Host Nginx on the private port 8090.
# ------------------------------------------------------------------
install -m 644 /var/www/bookmyvilla/nginx/bookmyvilla.online.conf "$site"
ln -sfn "$site" "$link"
host_changed=true
nginx -t
reload_host_nginx

if ! docker exec "$gateway" wget -q -O /dev/null --header 'Host: bookmyvilla.online' "http://$upstream:8090/"; then
  echo "$gateway cannot reach host Nginx at $upstream:8090; check host firewall rules for Docker bridges." >&2
  exit 1
fi

# ------------------------------------------------------------------
# 2. Certificate (issued on the host, served by the gateway).
# ------------------------------------------------------------------
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

  # The HTTPS config needs certificate files, so route plain HTTP first.
  if ! docker exec "$gateway" test -s "$gateway_tls/fullchain.pem"; then
    install_gateway_conf /var/www/bookmyvilla/nginx/gateway.http.conf
  fi

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

# ------------------------------------------------------------------
# 3. HTTPS routing in the gateway.
# ------------------------------------------------------------------
sync_gateway_certs
install_gateway_conf /var/www/bookmyvilla/nginx/gateway.conf

install -d -m 755 /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/bookmyvilla-nginx.sh <<HOOK
#!/usr/bin/env bash
# Copies the renewed BookMyVilla certificate into the gateway container.
set -euo pipefail
gateway=$gateway
docker exec "\$gateway" test -f $gateway_conf || exit 0
for pem in fullchain privkey; do
  docker cp -L "$cert_dir/\$pem.pem" "\$gateway:$gateway_tls/\$pem.pem"
done
docker exec "\$gateway" nginx -t
docker exec "\$gateway" nginx -s reload
HOOK
chmod 755 /etc/letsencrypt/renewal-hooks/deploy/bookmyvilla-nginx.sh
if systemctl list-unit-files certbot.timer --no-legend 2>/dev/null | grep -q '^certbot.timer'; then
  systemctl enable --now certbot.timer
else
  echo '::warning::No certbot.timer found; verify the installed Certbot renewal schedule.'
fi

gateway_changed=false
host_changed=false
echo "BookMyVilla is routed through $gateway; host Nginx serves it on port 8090."
