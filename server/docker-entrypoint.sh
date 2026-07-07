#!/bin/sh
set -e

echo "⏳ Waiting for PostgreSQL at ${PGHOST:-db}:${PGPORT:-5432}…"
until node -e "const net=require('net');const s=net.connect(${PGPORT:-5432},'${PGHOST:-db}',()=>{s.end();process.exit(0)});s.on('error',()=>process.exit(1))" 2>/dev/null; do
  sleep 1
done
echo "✓ PostgreSQL is reachable"

# Apply schema (idempotent) and seed once (guarded by a marker the seed leaves).
echo "→ Applying schema…"
node src/db/init.js

# Seed only if there are no accounts yet (fresh DB)
NEED_SEED=$(node -e "import('./src/db/pool.js').then(async m=>{try{const r=await m.query('SELECT count(*) c FROM accounts');console.log(r.rows[0].c==='0'||r.rows[0].c===0?'yes':'no')}catch(e){console.log('yes')}finally{process.exit(0)}})")
if [ "$NEED_SEED" = "yes" ]; then
  echo "→ Seeding demo data…"
  node src/db/seed.js || echo "(seed skipped/failed — continuing)"
else
  echo "• Data already present — skipping seed"
fi

echo "🚀 Starting API"
exec "$@"
