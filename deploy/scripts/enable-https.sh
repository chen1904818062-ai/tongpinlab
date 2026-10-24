#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/../.."
test -f .env.production || { echo "Missing .env.production" >&2; exit 1; }
set -a
. ./.env.production
set +a
test -n "${DOMAIN:-}" || { echo "DOMAIN is required" >&2; exit 1; }
test -n "${CERTBOT_EMAIL:-}" || { echo "CERTBOT_EMAIL is required" >&2; exit 1; }

docker compose --env-file .env.production up -d --build app nginx
docker compose --env-file .env.production run --rm --entrypoint certbot certbot certonly --webroot -w /var/www/certbot --email "$CERTBOT_EMAIL" --agree-tos --no-eff-email -d "$DOMAIN"
cp deploy/nginx/https.conf.template deploy/nginx/templates/default.conf.template
docker compose --env-file .env.production up -d --force-recreate nginx certbot
docker compose --env-file .env.production exec -T nginx nginx -t
echo "HTTPS enabled: https://$DOMAIN"
