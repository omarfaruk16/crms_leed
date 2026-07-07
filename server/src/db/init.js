// Creates the database (if missing) and applies schema.sql.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbName = process.env.PGDATABASE || 'sky_root_crm';

const adminConfig = {
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || undefined,
  database: 'postgres', // connect to default db to create ours
};

async function ensureDatabase() {
  const client = new pg.Client(adminConfig);
  await client.connect();
  const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (!rowCount) {
    await client.query(`CREATE DATABASE ${pg.Client.prototype.escapeIdentifier?.(dbName) || `"${dbName}"`}`);
    console.log(`✓ created database "${dbName}"`);
  } else {
    console.log(`• database "${dbName}" already exists`);
  }
  await client.end();
}

async function applySchema() {
  const client = new pg.Client({ ...adminConfig, database: dbName });
  await client.connect();
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await client.query(sql);
  console.log('✓ schema applied');
  await client.end();
}

try {
  await ensureDatabase();
  await applySchema();
  console.log('Database ready.');
  process.exit(0);
} catch (err) {
  console.error('DB init failed:', err.message);
  process.exit(1);
}
