import { PostgresService } from '../../services/postgresService.ts';
import type { GraphState } from '../graph.ts';
import { assertReadOnly, applyRowLimit } from '../../guards/sqlGuard.ts';
import { logAudit } from '../../guards/audit.ts';
import { sanitizeError, safeBlockedMessage } from '../../guards/errorSanitizer.ts';
import { config } from '../../config.ts';

/**
 * Guards, validates and executes the generated SQL against the read-only DB.
 * Order: read-only guard (block DML/DDL) → default LIMIT → EXPLAIN validate →
 * execute. Failures within the correction budget are routed to self-correction.
 * (FR-008, FR-009, FR-014; Edge: very large query)
 */
export function createSqlExecutorNode(db: PostgresService) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    const question = state.question;
    const rawSql = state.query;

    // 1) Application-layer read-only guard (defense in depth) — BEFORE touching the DB.
    const guard = assertReadOnly(rawSql ?? '');
    if (!guard.ok) {
      logAudit({ question, generatedSql: rawSql, decision: 'rejected', reason: guard.reason });
      // Redact the query and do NOT attempt correction for blocked statements.
      return { error: safeBlockedMessage(), query: undefined, needsCorrection: false };
    }

    const safeSql = guard.sql!;
    const cappedSql = applyRowLimit(safeSql, config.defaultRowLimit);

    try {
      // 2) Validate without executing (no rows touched).
      const validation = await db.validateQuery(cappedSql);
      if (!validation.ok) {
        if ((state.correctionAttempts ?? 0) < config.maxCorrectionAttempts) {
          console.log('🔍 Query invalid — will attempt one self-correction.');
          return {
            needsCorrection: true,
            validationError: validation.error ?? 'Query failed validation.',
            originalQuery: state.originalQuery ?? safeSql,
            query: safeSql,
          };
        }
        logAudit({
          question,
          generatedSql: safeSql,
          decision: 'rejected',
          reason: 'validation failed',
        });
        return { error: sanitizeError(validation.error), needsCorrection: false };
      }

      // 3) Execute (read-only).
      const results = await db.query(cappedSql);
      logAudit({ question, generatedSql: safeSql, decision: 'allowed' });
      console.log(`📊 Retrieved ${results.length} row(s).`);
      return { dbResults: results, query: safeSql, needsCorrection: false };
    } catch (error) {
      if ((state.correctionAttempts ?? 0) < config.maxCorrectionAttempts) {
        return {
          needsCorrection: true,
          validationError: error instanceof Error ? error.message : String(error),
          originalQuery: state.originalQuery ?? safeSql,
          query: safeSql,
        };
      }
      logAudit({
        question,
        generatedSql: safeSql,
        decision: 'rejected',
        reason: 'execution error',
      });
      return { error: sanitizeError(error), needsCorrection: false };
    }
  };
}
