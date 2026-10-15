#!/usr/bin/env bash
# Construit, dans une base vide, le schéma que le serveur Node attend :
# init.sql, puis les migrations appliquées à la main en production, puis celles
# de server/migrations.ts (jamais appelé au démarrage). Le reste (index, colonnes
# des magasins, tables récentes) est ajouté par server/migrations.production.ts
# au premier démarrage de Node.
# Usage : scripts/bench/schema.sh postgres://utilisateur:motdepasse@hôte/base
set -euo pipefail
url="$1"
root="$(cd "$(dirname "$0")/../.." && pwd)"
run() { psql -q -v ON_ERROR_STOP=1 "$url" "$@"; }

run -f "$root/init.sql"
run -f "$root/migrations/20260515_add_contacts_and_supplier_email.sql"
run -f "$root/migrations/002_add_dlc_stock_epuise.sql"
run <<'SQL'
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS notified_at TIMESTAMP;
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS notified_comment TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS codefou VARCHAR;
SQL
