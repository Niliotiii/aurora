// Application-layer read-only guard (defense in depth on top of the SELECT-only role).
// Rejects any non-SELECT, multi-statement, or mutating SQL before it reaches the DB.

const FORBIDDEN = [
  'DROP',
  'DELETE',
  'UPDATE',
  'INSERT',
  'ALTER',
  'TRUNCATE',
  'GRANT',
  'REVOKE',
  'CREATE',
  'MERGE',
  'CALL',
  'COPY',
  'EXECUTE',
  'COMMENT',
  'VACUUM',
  'REINDEX',
  'REFRESH',
];

export interface GuardResult {
  ok: boolean;
  reason?: string;
  sql?: string; // normalized sql (when ok)
}

/** Strip SQL comments so they cannot hide forbidden keywords. */
function stripComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // /* block */
    .replace(/--[^\n]*/g, ' '); // -- line
}

/**
 * Assert that `rawSql` is a single, read-only SELECT statement.
 * Returns { ok: false, reason } instead of throwing so callers can log + sanitize.
 */
export function assertReadOnly(rawSql: string): GuardResult {
  if (!rawSql || !rawSql.trim()) {
    return { ok: false, reason: 'Empty query' };
  }

  let sql = stripComments(rawSql).trim();
  // Drop a trailing semicolon plus any residual whitespace/punctuation some models
  // append (e.g. "...;." or "...; "). Only the very end is normalized, so any
  // semicolon that actually separates statements is still detected below.
  sql = sql.replace(/;[\s.]*$/, '').trim();

  // Reject multiple statements (any remaining semicolon separates statements).
  if (sql.includes(';')) {
    return { ok: false, reason: 'Multiple statements are not allowed' };
  }

  // Must start with SELECT or a WITH ... (CTE) that feeds a SELECT.
  const head = sql.slice(0, 6).toUpperCase();
  if (head !== 'SELECT' && !/^WITH\b/i.test(sql)) {
    return { ok: false, reason: 'Only read-only SELECT statements are allowed' };
  }

  // Token-level deny-list (word boundaries, case-insensitive).
  const upper = sql.toUpperCase();
  for (const word of FORBIDDEN) {
    const re = new RegExp(`\\b${word}\\b`);
    if (re.test(upper)) {
      return { ok: false, reason: `Forbidden operation: ${word}` };
    }
  }

  return { ok: true, sql };
}

/** Wrap a query with a default LIMIT when it does not already specify one. */
export function applyRowLimit(sql: string, limit: number): string {
  if (/\bLIMIT\b/i.test(sql)) return sql;
  return `SELECT * FROM (${sql}) AS aurora_capped LIMIT ${limit}`;
}
