// Seeds the WHO MORT_200 "Deaths per 1,000 live births" dataset into PostgreSQL.
// Source: data/Mortes infantis por 1000 nascidos vivos.xlsx
// Run with: npm run seed   (uses admin role — idempotent)

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { read as xlsxRead, utils as xlsxUtils } from 'xlsx';
import { config } from '../src/config.ts';
import { INDICATOR } from './dictionary.ts';

const { Client } = pg;

// ---------------------------------------------------------------------------
// Excel parsing
// ---------------------------------------------------------------------------
interface DataRow {
  geoCode: string;
  geoName: string;
  regionCode: string;
  regionName: string;
  year: number;
  ageName: string;       // '0-27 days' | '1-59 months' | '0-4 years'
  ageCode: string;       // AGEGROUP_DAYS0-27 | …
  causeName: string;
  causeCode: string;     // CHILDCAUSE_CH10 | …
  rate: number | null;
}

function parseExcel(filePath: string): DataRow[] {
  const buf = readFileSync(filePath);
  const wb = xlsxRead(buf);
  const ws = wb.Sheets[wb.SheetNames[0]];
  // sheet_to_json with header:1 returns array-of-arrays (all rows including headers)
  const allRows: unknown[][] = xlsxUtils.sheet_to_json(ws, { header: 1, defval: null });

  // Find header row (first row where first cell = 'IndicatorCode')
  let headerIdx = -1;
  for (let i = 0; i < allRows.length; i++) {
    if (String(allRows[i]?.[0] ?? '').trim() === 'IndicatorCode') {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) throw new Error('Header row not found in Excel file');

  const header = allRows[headerIdx] as string[];
  const col = (name: string): number => {
    const idx = header.findIndex((h) => String(h ?? '').trim() === name);
    if (idx === -1) throw new Error(`Column "${name}" not found`);
    return idx;
  };

  const cParentCode = col('ParentLocationCode');
  const cParentName = col('ParentLocation');
  const cGeoCode    = col('SpatialDimValueCode');
  const cGeoName    = col('Location');
  const cPeriod     = col('Period');
  const cAgeCode    = col('Dim1ValueCode');
  const cAgeName    = col('Dim1');
  const cCauseCode  = col('Dim2ValueCode');
  const cCauseName  = col('Dim2');
  const cRate       = col('FactValueNumeric');

  const results: DataRow[] = [];
  for (let i = headerIdx + 1; i < allRows.length; i++) {
    const r = allRows[i];
    if (!r || r.length === 0) continue;

    const geoCode   = r[cGeoCode]   != null ? String(r[cGeoCode]).trim()   : '';
    const geoName   = r[cGeoName]   != null ? String(r[cGeoName]).trim()   : '';
    const yearRaw   = r[cPeriod]    != null ? Number(r[cPeriod])           : NaN;
    const ageCode   = r[cAgeCode]   != null ? String(r[cAgeCode]).trim()   : '';
    const ageName   = r[cAgeName]   != null ? String(r[cAgeName]).trim()   : '';
    const causeCode = r[cCauseCode] != null ? String(r[cCauseCode]).trim() : '';
    const causeName = r[cCauseName] != null ? String(r[cCauseName]).trim() : '';
    const regionCode = r[cParentCode] != null ? String(r[cParentCode]).trim() : '';
    const regionName = r[cParentName] != null ? String(r[cParentName]).trim() : '';
    const rateRaw   = r[cRate] != null ? Number(r[cRate]) : null;

    if (!geoCode || isNaN(yearRaw) || !ageCode || !causeCode) continue;

    results.push({
      geoCode, geoName, regionCode, regionName,
      year: yearRaw,
      ageName, ageCode,
      causeName, causeCode,
      rate: rateRaw !== null && !isNaN(rateRaw) ? rateRaw : null,
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Role helpers (unchanged from previous seed)
// ---------------------------------------------------------------------------
function validIdentifier(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

async function createReadOnlyRole(client: pg.Client) {
  const user = config.postgresReadOnly.user;
  const password = config.postgresReadOnly.password;
  if (!validIdentifier(user)) throw new Error('Invalid read-only role name');
  const safePassword = password.replace(/'/g, "''");
  const exists = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [user]);
  if (exists.rowCount === 0) {
    await client.query(`CREATE ROLE "${user}" LOGIN PASSWORD '${safePassword}'`);
  } else {
    await client.query(`ALTER ROLE "${user}" LOGIN PASSWORD '${safePassword}'`);
  }
  console.log(`👤 Read-only role "${user}" updated.`);
  await client.query(`GRANT CONNECT ON DATABASE "${config.postgresAdmin.database}" TO "${user}"`);
  await client.query(`GRANT USAGE ON SCHEMA public TO "${user}"`);
}

async function grantReadOnly(client: pg.Client) {
  const user = config.postgresReadOnly.user;
  await client.query(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO "${user}"`);
  await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO "${user}"`);
  console.log(`🔒 Granted SELECT-only to "${user}".`);
}

async function createAppRole(client: pg.Client) {
  const user = config.postgresApp.user;
  const password = config.postgresApp.password;
  if (!validIdentifier(user)) throw new Error('Invalid app role name');
  const safePassword = password.replace(/'/g, "''");
  const exists = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [user]);
  if (exists.rowCount === 0) {
    await client.query(`CREATE ROLE "${user}" LOGIN PASSWORD '${safePassword}'`);
  } else {
    await client.query(`ALTER ROLE "${user}" LOGIN PASSWORD '${safePassword}'`);
  }
  console.log(`👤 App role "${user}" updated.`);
  await client.query(`GRANT CONNECT ON DATABASE "${config.postgresAdmin.database}" TO "${user}"`);
  await client.query(`GRANT USAGE ON SCHEMA public TO "${user}"`);
  await client.query(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON conversation, conversation_message TO "${user}"`,
  );
  await client.query(
    `GRANT USAGE, SELECT ON SEQUENCE conversation_message_id_seq TO "${user}" 2>/dev/null; SELECT 1`,
  ).catch(() => {}); // sequence may not exist yet
  console.log(`🔒 Granted SELECT/INSERT/UPDATE/DELETE on conversation tables to "${user}".`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const client = new Client(config.postgresAdmin);
  await client.connect();
  console.log('🔌 Connected as admin role.');

  // 1) Schema
  const schemaSql = readFileSync(join('data', 'schema.sql'), 'utf8');
  await client.query(schemaSql);
  console.log('🏗️  Schema created.');

  // 2) Roles
  await createReadOnlyRole(client);

  // 3) Parse Excel
  const filePath = join('data', 'Mortes infantis por 1000 nascidos vivos.xlsx');
  console.log('📂 Reading Excel…');
  const rows = parseExcel(filePath);
  console.log(`📋 ${rows.length} data rows parsed.`);

  // 4) Collect unique dimensions
  const geos    = new Map<string, { name: string; regionCode: string; regionName: string }>();
  const years   = new Set<number>();
  const ages    = new Map<string, string>(); // code → name
  const causes  = new Map<string, string>(); // code → name

  for (const r of rows) {
    if (!geos.has(r.geoCode)) geos.set(r.geoCode, { name: r.geoName, regionCode: r.regionCode, regionName: r.regionName });
    years.add(r.year);
    if (!ages.has(r.ageCode)) ages.set(r.ageCode, r.ageName);
    if (!causes.has(r.causeCode)) causes.set(r.causeCode, r.causeName);
  }

  // 5) Insert geographies
  for (const [code, g] of geos) {
    await client.query(
      `INSERT INTO dim_geography (geo_code, geo_name, region_code, region_name)
       VALUES ($1, $2, $3, $4) ON CONFLICT (geo_code) DO NOTHING`,
      [code, g.name, g.regionCode, g.regionName],
    );
  }
  console.log(`🌍 ${geos.size} país(es) carregado(s).`);

  // 6) Insert years
  for (const yr of years) {
    await client.query(
      `INSERT INTO dim_time (time_year) VALUES ($1) ON CONFLICT DO NOTHING`,
      [yr],
    );
  }
  console.log(`🗓️  ${years.size} ano(s) carregado(s). Intervalo: ${Math.min(...years)}–${Math.max(...years)}`);

  // 7) Insert age groups (with Portuguese labels)
  const AGE_LABELS: Record<string, string> = {
    'AGEGROUP_DAYS0-27':    'Neonatal (0-27 dias)',
    'AGEGROUP_MONTHS1-59':  'Pós-neonatal (1-59 meses)',
    'AGEGROUP_YEARS0-4':    'Abaixo de 5 anos (0-4 anos)',
  };
  for (const [code, name] of ages) {
    await client.query(
      `INSERT INTO dim_age_group (age_code, age_name, age_label)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [code, name, AGE_LABELS[code] ?? name],
    );
  }
  console.log(`👶 ${ages.size} faixa(s) etária(s) carregada(s).`);

  // 8) Insert causes + synthetic ALL_CAUSES
  causes.set('ALL_CAUSES', 'Total (todas as causas)');
  for (const [code, name] of causes) {
    await client.query(
      `INSERT INTO dim_cause (cause_code, cause_name)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [code, name],
    );
  }
  console.log(`🔬 ${causes.size} causa(s) de morte carregada(s) (inclui ALL_CAUSES).`);

  // 9) Insert per-cause facts in batches
  let factCount = 0;
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    for (const r of batch) {
      await client.query(
        `INSERT INTO fact_observation (geo_code, time_year, age_code, cause_code, rate_per_1000)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
        [r.geoCode, r.year, r.ageCode, r.causeCode, r.rate],
      );
      factCount++;
    }
  }
  console.log(`📊 ${factCount} observação(ões) por causa inserida(s).`);

  // 10) Compute and insert ALL_CAUSES totals per (country, year, age)
  await client.query(`
    INSERT INTO fact_observation (geo_code, time_year, age_code, cause_code, rate_per_1000)
    SELECT
      geo_code,
      time_year,
      age_code,
      'ALL_CAUSES',
      SUM(rate_per_1000)
    FROM fact_observation
    GROUP BY geo_code, time_year, age_code
    ON CONFLICT DO NOTHING
  `);
  const totalRows = await client.query(
    `SELECT COUNT(*) FROM fact_observation WHERE cause_code = 'ALL_CAUSES'`,
  );
  console.log(`✅ ${totalRows.rows[0].count} total(is) ALL_CAUSES computado(s).`);

  // 11) Grant roles
  await grantReadOnly(client);
  await createAppRole(client);

  await client.end();
  console.log('✅ Seed completo.');
}

main().catch((err) => {
  console.error('❌ Seed falhou:', err);
  process.exit(1);
});
