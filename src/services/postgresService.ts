import pg from 'pg';
import { config } from '../config.ts';

const { Pool } = pg;

/**
 * Read-only access to the WHO dataset. Uses the SELECT-only role (Principle IV).
 * This service NEVER runs DDL/DML; seeding is done separately by data/seed.ts with
 * the privileged role.
 */
export class PostgresService {
  private pool: pg.Pool;
  private schemaCache: string | null = null;

  constructor() {
    this.pool = new Pool({
      host: config.postgresReadOnly.host,
      port: config.postgresReadOnly.port,
      database: config.postgresReadOnly.database,
      user: config.postgresReadOnly.user,
      password: config.postgresReadOnly.password,
      max: 5,
    });
  }

  /**
   * Returns a compact, human/LLM-readable description of the public tables and
   * columns. Read from information_schema (no system catalogs exposed to users).
   */
  async getSchema(): Promise<string> {
    if (this.schemaCache) return this.schemaCache;
    try {
      const result = await this.pool.query<{
        table_name: string;
        column_name: string;
        data_type: string;
      }>(
        `SELECT table_name, column_name, data_type
         FROM information_schema.columns
         WHERE table_schema = 'public'
         ORDER BY table_name, ordinal_position`,
      );

      const byTable = new Map<string, string[]>();
      for (const row of result.rows) {
        const cols = byTable.get(row.table_name) ?? [];
        cols.push(`${row.column_name} ${row.data_type}`);
        byTable.set(row.table_name, cols);
      }

      const lines: string[] = [];
      for (const [table, cols] of byTable) {
        lines.push(`${table}(${cols.join(', ')})`);
      }
      this.schemaCache = lines.join('\n');
      return this.schemaCache;
    } catch (error) {
      console.error('❌ Error reading schema:', error);
      return '';
    }
  }

  /**
   * Validate a query WITHOUT executing it (no rows touched), using EXPLAIN.
   * Returns { ok } and, on failure, the planner error (used by the self-correction
   * node — this error is NEVER surfaced raw to end users).
   */
  async validateQuery(sql: string): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.pool.query(`EXPLAIN ${sql}`);
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('❌ Query validation failed:', message);
      return { ok: false, error: message };
    }
  }

  /** Execute a (already-guarded, read-only) SELECT and return the rows. */
  async query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
    const result = await this.pool.query(sql);
    return result.rows as T[];
  }

  async close(): Promise<void> {
    try {
      await this.pool.end();
    } catch (error) {
      console.error('Error closing Postgres pool:', error);
    }
  }
}
