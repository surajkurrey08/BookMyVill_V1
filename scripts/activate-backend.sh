#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo 'Deployment user must be root.' >&2
  exit 1
fi

if [[ ! -s /var/www/bookmyvilla/backend/.env ]]; then
  echo 'Set /var/www/bookmyvilla/backend/.env on the VPS before deploying.' >&2
  exit 1
fi
for key in MONGODB_URI JWT_SECRET; do
  if ! grep -Eq "^${key}=.+" /var/www/bookmyvilla/backend/.env; then
    echo "$key is missing from the VPS backend .env file." >&2
    exit 1
  fi
done
chmod 600 /var/www/bookmyvilla/backend/.env
cd /var/www/bookmyvilla/backend
npm ci --omit=dev

export NODE_ENV=production
if pm2 describe bookmyvilla-backend >/dev/null 2>&1; then
  pm2 restart bookmyvilla-backend --update-env
else
  pm2 start index.js --name bookmyvilla-backend
fi
pm2 save
