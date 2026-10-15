#!/usr/bin/env bash
# Prépare la base modèle du banc (bench_seed) : schéma de production, index créés
# par le premier démarrage de Node, puis données du banc (seed.ts).
# Prérequis : PostgreSQL local, serveur Node construit (dist/index.js).
# Usage : scripts/bench/setup.sh [postgres://utilisateur:motdepasse@hôte:port]
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
pg="${1:-${BENCH_PG_URL:-postgres://logiflow_admin:bench@localhost:5432}}"
port=3299

psql -q "$pg/postgres" -c "DROP DATABASE IF EXISTS logiflow_schema WITH (FORCE)" -c "CREATE DATABASE logiflow_schema"
"$root/scripts/bench/schema.sh" "$pg/logiflow_schema" 2>&1 | grep -v NOTICE || true

# Premier démarrage de Node : migrations de server/migrations.production.ts
(cd "$root" && NODE_ENV=production PORT=$port DATABASE_URL="$pg/logiflow_schema" SESSION_SECRET=setup \
  node dist/index.js > /dev/null 2>&1) &
node_pid=$!
trap 'kill $node_pid 2>/dev/null || true' EXIT
for _ in $(seq 1 120); do
  curl -sf "http://127.0.0.1:$port/api/health" > /dev/null && break
  sleep 0.5
done
# Les index sont créés en arrière-plan : attendre la fin des CREATE INDEX
sleep 2
while [ "$(psql -At "$pg/logiflow_schema" -c "SELECT count(*) FROM pg_stat_activity WHERE query ILIKE 'CREATE INDEX%' OR query ILIKE 'ANALYZE%'")" != "0" ]; do
  sleep 1
done
kill $node_pid; wait $node_pid 2>/dev/null || true
trap - EXIT

# Le modèle ne garde que le schéma : Node a pu créer l'administrateur par défaut
tables=$(psql -At "$pg/logiflow_schema" -c "SELECT string_agg(format('%I', tablename), ', ') FROM pg_tables WHERE schemaname = 'public'")
psql -q "$pg/logiflow_schema" -c "TRUNCATE $tables RESTART IDENTITY CASCADE"

psql -q "$pg/postgres" -c "DROP DATABASE IF EXISTS bench_seed WITH (FORCE)" -c "CREATE DATABASE bench_seed TEMPLATE logiflow_schema"
(cd "$root" && DATABASE_URL="$pg/bench_seed" SESSION_SECRET=banc-secret-de-session ENCRYPTION_KEY=banc-cle-de-chiffrement \
  npx tsx scripts/bench/seed.ts)
echo "Base modèle bench_seed prête ($(psql -At "$pg/bench_seed" -c "SELECT count(*) FROM pg_indexes WHERE schemaname = 'public'") index)."
