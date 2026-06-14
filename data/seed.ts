// Seeds the WHO neonatal mortality dataset into PostgreSQL (FR-016).
// Run with the privileged role: `npm run seed`. Idempotent (schema.sql drops/recreates).
// Also (re)creates the SELECT-only role used by the app at runtime (FR-009, Principle IV).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { config } from '../src/config.ts';
import { INDICATOR } from './dictionary.ts';

const { Client } = pg;

// ---------------------------------------------------------------------------
// Minimal RFC-4180-ish CSV parser (handles quotes, escaped quotes, newlines in fields)
// ---------------------------------------------------------------------------
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ''));
}

function num(v: string | undefined): number | null {
  if (v === undefined || v.trim() === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function validIdentifier(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

const SOURCE_DIR = config.whoSourceDir;
const DATASET = '076_A4C49D3_Dataset_2024-05-16.csv';
const CODELIST = '076_A4C49D3_Code list_2024-05-16.csv';
const METADATA = '076_A4C49D3_Metadata_2024-05-16.csv';

async function main() {
  const client = new Client(config.postgresAdmin);
  await client.connect();
  console.log('🔌 Connected as admin role.');

  // 1) Schema (drops + recreates tables).
  const schemaSql = readFileSync(join('data', 'schema.sql'), 'utf8');
  await client.query(schemaSql);
  console.log('🏗️  Schema created.');

  // 2) Read-only role (FR-009) — idempotent.
  await createReadOnlyRole(client);

  // 3) Metadata → indicator.
  const metaRows = parseCsv(readFileSync(join(SOURCE_DIR, METADATA), 'utf8'));
  const meta = new Map<string, string>();
  for (const [prop, value] of metaRows) if (prop) meta.set(prop.trim(), (value ?? '').trim());

  const indName = meta.get('Name') ?? INDICATOR.name;
  const indShort = meta.get('Short name') ?? indName;
  const indUnit = meta.get('Value display label') ?? INDICATOR.unit;
  await client.query(
    `INSERT INTO indicator (ind_uuid, ind_code, name, short_name, unit)
     VALUES ($1, $2, $3, $4, $5)`,
    [INDICATOR.uuid, INDICATOR.code, indName, indShort, indUnit],
  );
  console.log('📈 Indicator loaded.');

  // 4) Code list → dim_term.
  const codeRows = parseCsv(readFileSync(join(SOURCE_DIR, CODELIST), 'utf8'));
  const codeHeader = codeRows.shift(); // TERM_SET,TERM_KEY,TERM_NAME_MAIN,TERM_DESC_MAIN
  void codeHeader;
  let termCount = 0;
  for (const [termSet, termKey, nameMain, descMain] of codeRows) {
    if (!termSet || !termKey) continue;
    await client.query(
      `INSERT INTO dim_term (term_set, term_key, term_name_main, term_desc_main)
       VALUES ($1, $2, $3, $4) ON CONFLICT (term_set, term_key) DO NOTHING`,
      [termSet, termKey, nameMain ?? termKey, descMain ?? null],
    );
    termCount++;
  }
  console.log(`🔤 ${termCount} code-list terms loaded.`);

  // 5) Dataset → geography, time, facts.
  const dataRows = parseCsv(readFileSync(join(SOURCE_DIR, DATASET), 'utf8'));
  dataRows.shift(); // header

  // Distinct geographies + times.
  const geos = new Map<string, { name: string; type: string }>();
  const times = new Map<string, { year: number; type: string }>();
  for (const r of dataRows) {
    const geoType = r[2],
      geoCode = r[3],
      geoName = r[4],
      timeType = r[5],
      timeYear = r[6];
    if (geoCode && !geos.has(geoCode)) geos.set(geoCode, { name: geoName, type: geoType });
    const tKey = `${timeYear}|${timeType}`;
    if (timeYear && !times.has(tKey)) times.set(tKey, { year: Number(timeYear), type: timeType });
  }

  for (const [code, g] of geos) {
    await client.query(
      `INSERT INTO dim_geography (geo_code_m49, geo_name_short, geo_code_type)
       VALUES ($1, $2, $3) ON CONFLICT (geo_code_m49) DO NOTHING`,
      [code, g.name, g.type],
    );
  }
  console.log(`🌍 ${geos.size} geograph(ies) loaded.`);

  const timeIdByKey = new Map<string, number>();
  for (const [key, t] of times) {
    const res = await client.query<{ time_id: number }>(
      `INSERT INTO dim_time (time_year, time_type) VALUES ($1, $2)
       ON CONFLICT (time_year, time_type) DO UPDATE SET time_year = EXCLUDED.time_year
       RETURNING time_id`,
      [t.year, t.type],
    );
    timeIdByKey.set(key, res.rows[0].time_id);
  }
  console.log(`🗓️  ${times.size} time point(s) loaded.`);

  let factCount = 0;
  for (const r of dataRows) {
    const geoCode = r[3],
      timeType = r[5],
      timeYear = r[6],
      sex = r[7],
      age = r[8];
    const timeId = timeIdByKey.get(`${timeYear}|${timeType}`);
    if (!geoCode || timeId === undefined) continue;
    await client.query(
      `INSERT INTO fact_observation
         (ind_uuid, geo_code_m49, time_id, sex, age, rate_per_1000, rate_low, rate_high)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [INDICATOR.uuid, geoCode, timeId, sex, age, num(r[9]), num(r[10]), num(r[11])],
    );
    factCount++;
  }
  console.log(`📊 ${factCount} observation(s) loaded.`);

  // Grant SELECT on the freshly created tables to the read-only role.
  await grantReadOnly(client);

  await client.end();
  console.log('✅ Seed complete.');
}

async function createReadOnlyRole(client: pg.Client) {
  const user = config.postgresReadOnly.user;
  const password = config.postgresReadOnly.password;
  if (!validIdentifier(user)) throw new Error('Invalid read-only role name');
  const safePassword = password.replace(/'/g, "''");

  const exists = await client.query(`SELECT 1 FROM pg_roles WHERE rolname = $1`, [user]);
  if (exists.rowCount === 0) {
    await client.query(`CREATE ROLE "${user}" LOGIN PASSWORD '${safePassword}'`);
    console.log(`👤 Read-only role "${user}" created.`);
  } else {
    await client.query(`ALTER ROLE "${user}" LOGIN PASSWORD '${safePassword}'`);
    console.log(`👤 Read-only role "${user}" updated.`);
  }
  // Ensure no write privileges; grant connect + usage now (table grants after load).
  await client.query(`GRANT CONNECT ON DATABASE "${config.postgresAdmin.database}" TO "${user}"`);
  await client.query(`GRANT USAGE ON SCHEMA public TO "${user}"`);
}

async function grantReadOnly(client: pg.Client) {
  const user = config.postgresReadOnly.user;
  await client.query(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO "${user}"`);
  await client.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO "${user}"`,
  );
  console.log(`🔒 Granted SELECT-only to "${user}".`);
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
