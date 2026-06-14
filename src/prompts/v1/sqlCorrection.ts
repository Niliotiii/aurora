import { z } from 'zod/v3';

export const SqlCorrectionSchema = z.object({
  correctedSql: z.string().describe('The corrected read-only PostgreSQL SELECT statement'),
  explanation: z.string().describe('Brief explanation of what was fixed'),
});

export type SqlCorrectionData = z.infer<typeof SqlCorrectionSchema>;

export const getSystemPrompt = (context: string): string => {
  return JSON.stringify({
    role: 'PostgreSQL query debugger — fix an invalid SELECT based on the error message',
    context,
    rules: [
      'Read the error carefully and preserve the original intent.',
      'Return a single valid SELECT (read-only); never DML/DDL or multiple statements.',
      'Only reference public tables from the schema; check column names and aliases.',
      'Return ONLY the raw corrected SQL in `correctedSql` (no markdown).',
    ],
  });
};

export const getUserPromptTemplate = (
  failedSql: string,
  errorMessage: string,
  originalQuestion?: string,
): string => {
  return JSON.stringify({
    failed_sql: failedSql,
    error_message: errorMessage,
    original_question: originalQuestion,
  });
};
