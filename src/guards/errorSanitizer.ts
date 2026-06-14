// Maps internal errors to safe, user-facing messages. Never leaks schema, stack
// traces, table/column names, or connection details (Principle V, FR-011).

const SAFE_DEFAULT = 'Desculpe, não consegui processar essa solicitação.';

export function sanitizeError(error: unknown): string {
  // We intentionally do NOT echo the raw error text to the user.
  // Log the real error server-side for debugging.
  if (error instanceof Error) {
    console.error('[internal error]', error.message);
  } else if (error) {
    console.error('[internal error]', String(error));
  }
  return SAFE_DEFAULT;
}

/** A safe message for blocked/guarded queries (no schema or SQL echoed). */
export function safeBlockedMessage(): string {
  return 'Esta solicitação foi bloqueada porque apenas consultas de dados somente leitura são permitidas.';
}
