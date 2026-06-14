// Query audit log (FR-008). Records every execution attempt, especially guard
// rejections. Kept simple (structured stderr/stdout line); never logs secrets.

export interface QueryAuditRecord {
  timestamp: string;
  question?: string;
  generatedSql?: string;
  decision: 'allowed' | 'rejected';
  reason?: string;
}

export function logAudit(record: Omit<QueryAuditRecord, 'timestamp'>): void {
  const entry: QueryAuditRecord = { timestamp: new Date().toISOString(), ...record };
  const tag = entry.decision === 'rejected' ? '⛔ AUDIT REJECT' : '✅ AUDIT ALLOW';
  console.log(`${tag} ${JSON.stringify(entry)}`);
}

// Safeguard audit log (FR-008). Never includes raw message text — classification only.
export interface SafeguardAuditRecord {
  timestamp: string;
  decision: 'allowed' | 'rejected';
  classification: string;
  reason: string;
}

export function logSafeguardAudit(record: Omit<SafeguardAuditRecord, 'timestamp'>): void {
  const entry: SafeguardAuditRecord = { timestamp: new Date().toISOString(), ...record };
  const tag = entry.decision === 'rejected' ? '⛔ SAFEGUARD REJECT' : '✅ SAFEGUARD ALLOW';
  console.log(`${tag} ${JSON.stringify(entry)}`);
}
