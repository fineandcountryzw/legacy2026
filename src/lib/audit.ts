// =====================================================
// Audit Logging Service
// Lakecity Accounting Suite
// =====================================================

import { getDb, generateId } from './db';
import { AuditLogEntry, AuditLogFilters } from './auth/types';

export interface AuditLogInput {
  action: string;
  entityType: string;
  entityId?: string;
  developmentId?: string;
  standId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  performedBy?: string;
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
  sessionId?: string;
}

/**
 * Log an action to the audit log
 */
export async function logAudit(input: AuditLogInput): Promise<AuditLogEntry> {
  const sql = getDb();
  
  const result = await sql`
    INSERT INTO audit_log (
      id,
      action,
      entity_type,
      entity_id,
      development_id,
      stand_id,
      old_values,
      new_values,
      performed_by,
      ip_address,
      user_agent,
      reason,
      session_id
    ) VALUES (
      ${generateId()},
      ${input.action},
      ${input.entityType},
      ${input.entityId || null},
      ${input.developmentId || null},
      ${input.standId || null},
      ${input.oldValues ? JSON.stringify(input.oldValues) : null},
      ${input.newValues ? JSON.stringify(input.newValues) : null},
      ${input.performedBy || null},
      ${input.ipAddress || null},
      ${input.userAgent || null},
      ${input.reason || null},
      ${input.sessionId || null}
    )
    RETURNING *
  `;
  
  return mapAuditLogRow(result[0]);
}

/**
 * Get audit log entries with filters
 */
export async function getAuditLog(
  filters: AuditLogFilters,
  options: { limit?: number; offset?: number } = {}
): Promise<{ entries: AuditLogEntry[]; total: number }> {
  const sql = getDb();
  const { limit = 50, offset = 0 } = options;
  
  // Build WHERE clause
  const conditions: string[] = [];
  const params: unknown[] = [];
  
  if (filters.action) {
    conditions.push(`al.action = $${params.length + 1}`);
    params.push(filters.action);
  }
  
  if (filters.entityType) {
    conditions.push(`al.entity_type = $${params.length + 1}`);
    params.push(filters.entityType);
  }
  
  if (filters.entityId) {
    conditions.push(`al.entity_id = $${params.length + 1}`);
    params.push(filters.entityId);
  }
  
  if (filters.developmentId) {
    conditions.push(`al.development_id = $${params.length + 1}`);
    params.push(filters.developmentId);
  }
  
  if (filters.standId) {
    conditions.push(`al.stand_id = $${params.length + 1}`);
    params.push(filters.standId);
  }
  
  if (filters.performedBy) {
    conditions.push(`al.performed_by = $${params.length + 1}`);
    params.push(filters.performedBy);
  }
  
  if (filters.dateFrom) {
    conditions.push(`al.performed_at >= $${params.length + 1}`);
    params.push(filters.dateFrom);
  }
  
  if (filters.dateTo) {
    conditions.push(`al.performed_at <= $${params.length + 1}`);
    params.push(filters.dateTo);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  // Get total count
  const countResult = await (sql as any).unsafe(`
    SELECT COUNT(*) as total 
    FROM audit_log al
    ${whereClause}
  `, params);
  
  const total = parseInt(countResult[0].total, 10);
  
  // Get entries
  const entriesResult = await (sql as any).unsafe(`
    SELECT 
      al.*,
      u.first_name || ' ' || u.last_name as performed_by_name
    FROM audit_log al
    LEFT JOIN users u ON al.performed_by = u.id
    ${whereClause}
    ORDER BY al.performed_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `, [...params, limit, offset]);
  
  return {
    entries: entriesResult.map(mapAuditLogRow),
    total,
  };
}

/**
 * Get audit trail for a specific entity
 */
export async function getEntityAuditTrail(
  entityType: string,
  entityId: string
): Promise<AuditLogEntry[]> {
  const sql = getDb();
  
  const result = await sql`
    SELECT 
      al.*,
      u.first_name || ' ' || u.last_name as performed_by_name
    FROM audit_log al
    LEFT JOIN users u ON al.performed_by = u.id
    WHERE al.entity_type = ${entityType}
      AND al.entity_id = ${entityId}
    ORDER BY al.performed_at DESC
  `;
  
  return result.map(mapAuditLogRow);
}

/**
 * Get recent activity for a user
 */
export async function getUserActivity(
  userId: string,
  limit: number = 20
): Promise<AuditLogEntry[]> {
  const sql = getDb();
  
  const result = await sql`
    SELECT 
      al.*,
      u.first_name || ' ' || u.last_name as performed_by_name
    FROM audit_log al
    LEFT JOIN users u ON al.performed_by = u.id
    WHERE al.performed_by = ${userId}
    ORDER BY al.performed_at DESC
    LIMIT ${limit}
  `;
  
  return result.map(mapAuditLogRow);
}

/**
 * Map database row to AuditLogEntry
 */
function mapAuditLogRow(row: Record<string, unknown>): AuditLogEntry {
  return {
    id: row.id as string,
    action: row.action as string,
    entityType: row.entity_type as string,
    entityId: row.entity_id as string | undefined,
    developmentId: row.development_id as string | undefined,
    standId: row.stand_id as string | undefined,
    oldValues: row.old_values as Record<string, unknown> | undefined,
    newValues: row.new_values as Record<string, unknown> | undefined,
    performedBy: row.performed_by as string | undefined,
    performedByName: row.performed_by_name as string | undefined,
    performedAt: row.performed_at as string,
    ipAddress: row.ip_address as string | undefined,
    userAgent: row.user_agent as string | undefined,
    reason: row.reason as string | undefined,
    sessionId: row.session_id as string | undefined,
  };
}

// ==========================================
// Predefined Audit Actions
// ==========================================

export const AUDIT_ACTIONS = {
  // User actions
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DELETED: 'USER_DELETED',
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  USER_LOCKED: 'USER_LOCKED',
  USER_UNLOCKED: 'USER_UNLOCKED',
  
  // Permission actions
  PERMISSION_GRANTED: 'PERMISSION_GRANTED',
  PERMISSION_REVOKED: 'PERMISSION_REVOKED',
  ESTATE_ASSIGNED: 'ESTATE_ASSIGNED',
  ESTATE_UNASSIGNED: 'ESTATE_UNASSIGNED',
  
  // Payment actions
  PAYMENT_RECORDED: 'PAYMENT_RECORDED',
  PAYMENT_UPDATED: 'PAYMENT_UPDATED',
  PAYMENT_DELETED: 'PAYMENT_DELETED',
  CASH_PAYMENT_RECORDED: 'CASH_PAYMENT_RECORDED',
  
  // Deduction actions
  DEDUCTION_RECORDED: 'DEDUCTION_RECORDED',
  DEDUCTION_UPDATED: 'DEDUCTION_UPDATED',
  DEDUCTION_DELETED: 'DEDUCTION_DELETED',
  
  // Payout actions
  PAYOUT_REQUESTED: 'PAYOUT_REQUESTED',
  PAYOUT_APPROVED: 'PAYOUT_APPROVED',
  PAYOUT_REJECTED: 'PAYOUT_REJECTED',
  PAYOUT_PAID: 'PAYOUT_PAID',
  PAYOUT_CANCELLED: 'PAYOUT_CANCELLED',
  
  // Stand actions
  STAND_CREATED: 'STAND_CREATED',
  STAND_UPDATED: 'STAND_UPDATED',
  STAND_COMPLETED: 'STAND_COMPLETED',
  STAND_CANCELLED: 'STAND_CANCELLED',
  STAND_TRANSFERRED: 'STAND_TRANSFERRED',
  
  // Development actions
  DEVELOPMENT_CREATED: 'DEVELOPMENT_CREATED',
  DEVELOPMENT_UPDATED: 'DEVELOPMENT_UPDATED',
  DEVELOPMENT_DELETED: 'DEVELOPMENT_DELETED',
  
  // Reconciliation actions
  RECONCILIATION_CREATED: 'RECONCILIATION_CREATED',
  RECONCILIATION_RECONCILED: 'RECONCILIATION_RECONCILED',
  RECONCILIATION_APPROVED: 'RECONCILIATION_APPROVED',
  
  // Import actions
  DATA_IMPORTED: 'DATA_IMPORTED',
  LEDGER_UPLOADED: 'LEDGER_UPLOADED',
  EXCEL_IMPORTED: 'EXCEL_IMPORTED',
  
  // Transaction override
  TRANSACTION_OVERRIDDEN: 'TRANSACTION_OVERRIDDEN',
  TRANSACTION_CORRECTED: 'TRANSACTION_CORRECTED',
} as const;
