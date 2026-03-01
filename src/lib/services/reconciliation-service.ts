// =====================================================
// Reconciliation Service
// Lakecity Accounting Suite
// =====================================================

import { getDb, generateId } from '../db';
import { logAudit, AUDIT_ACTIONS } from '../audit';
import { Reconciliation, ReconciliationStatus, MonthlyReconciliationReport } from '../auth/types';

function sql() {
  return getDb();
}

/**
 * Create a new reconciliation for a development and period
 */
export async function createReconciliation(
  developmentId: string,
  periodStart: string,
  periodEnd: string,
  createdBy: string,
  ipAddress?: string
): Promise<Reconciliation> {
  // Validate dates
  const startDate = new Date(periodStart);
  const endDate = new Date(periodEnd);
  
  if (startDate > endDate) {
    throw new Error('Period start date must be before end date');
  }
  
  // Check if reconciliation already exists for this period
  const existing = await sql()`
    SELECT id FROM reconciliations
    WHERE development_id = ${developmentId}
      AND period_start = ${periodStart}
      AND period_end = ${periodEnd}
  `;
  
  if (existing.length > 0) {
    throw new Error('Reconciliation already exists for this period');
  }
  
  // Get opening balances (from previous period end)
  const openingBalances = await calculateOpeningBalances(developmentId, periodStart);
  
  // Get period transactions
  const periodStats = await calculatePeriodStats(developmentId, periodStart, periodEnd);
  
  // Calculate closing balances
  const closingCustomerPayments = openingBalances.customerPayments + periodStats.customerPayments;
  const closingDeductions = openingBalances.deductions + periodStats.deductions;
  const closingBalance = closingCustomerPayments - closingDeductions;
  
  // Create reconciliation record
  const result = await sql()`
    INSERT INTO reconciliations (
      id,
      development_id,
      period_start,
      period_end,
      opening_customer_payments,
      opening_deductions,
      opening_balance,
      period_customer_payments,
      period_deductions,
      closing_customer_payments,
      closing_deductions,
      closing_balance,
      status,
      reconciled_by,
      reconciled_at
    ) VALUES (
      ${generateId()},
      ${developmentId},
      ${periodStart},
      ${periodEnd},
      ${openingBalances.customerPayments},
      ${openingBalances.deductions},
      ${openingBalances.balance},
      ${periodStats.customerPayments},
      ${periodStats.deductions},
      ${closingCustomerPayments},
      ${closingDeductions},
      ${closingBalance},
      'DRAFT',
      ${createdBy},
      NOW()
    )
    RETURNING *
  `;
  
  const reconciliation = result[0];
  
  // Log to audit
  await logAudit({
    action: AUDIT_ACTIONS.RECONCILIATION_CREATED,
    entityType: 'RECONCILIATION',
    entityId: reconciliation.id,
    developmentId,
    newValues: {
      periodStart,
      periodEnd,
      openingCustomerPayments: openingBalances.customerPayments,
      openingDeductions: openingBalances.deductions,
      periodCustomerPayments: periodStats.customerPayments,
      periodDeductions: periodStats.deductions,
    },
    performedBy: createdBy,
    ipAddress,
    reason: `Reconciliation created for period ${periodStart} to ${periodEnd}`,
  });
  
  return mapReconciliationRow(reconciliation);
}

/**
 * Get reconciliation by ID
 */
export async function getReconciliationById(
  reconciliationId: string
): Promise<Reconciliation | null> {
  const result = await sql()`
    SELECT r.*, d.name as development_name
    FROM reconciliations r
    LEFT JOIN developments d ON r.development_id = d.id
    WHERE r.id = ${reconciliationId}
  `;
  
  if (result.length === 0) {
    return null;
  }
  
  return mapReconciliationRow(result[0]);
}

/**
 * Get reconciliations for a development
 */
export async function getReconciliations(
  developmentId?: string,
  options: { status?: ReconciliationStatus; limit?: number; offset?: number } = {}
): Promise<{ reconciliations: Reconciliation[]; total: number }> {
  const { status, limit = 50, offset = 0 } = options;
  
  const conditions: string[] = [];
  const params: unknown[] = [];
  
  if (developmentId) {
    conditions.push(`r.development_id = $${params.length + 1}`);
    params.push(developmentId);
  }
  
  if (status) {
    conditions.push(`r.status = $${params.length + 1}`);
    params.push(status);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  // Get total count
  const countResult = await (sql() as any).unsafe(`
    SELECT COUNT(*) as total FROM reconciliations r
    ${whereClause}
  `, params);
  
  const total = parseInt(countResult[0].total, 10);
  
  // Get reconciliations
  const result = await (sql() as any).unsafe(`
    SELECT r.*, d.name as development_name
    FROM reconciliations r
    LEFT JOIN developments d ON r.development_id = d.id
    ${whereClause}
    ORDER BY r.period_start DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `, [...params, limit, offset]);
  
  return {
    reconciliations: result.map(mapReconciliationRow),
    total,
  };
}

/**
 * Mark reconciliation as reconciled
 */
export async function reconcileReconciliation(
  reconciliationId: string,
  reconciledBy: string,
  notes?: string,
  ipAddress?: string
): Promise<Reconciliation> {
  const reconciliation = await getReconciliationById(reconciliationId);
  
  if (!reconciliation) {
    throw new Error('Reconciliation not found');
  }
  
  if (reconciliation.status !== 'DRAFT') {
    throw new Error(`Cannot reconcile reconciliation with status ${reconciliation.status}`);
  }
  
  // Update reconciliation
  const result = await sql()`
    UPDATE reconciliations
    SET status = 'RECONCILED',
        reconciled_by = ${reconciledBy},
        reconciled_at = NOW(),
        notes = COALESCE(${notes || null}, notes),
        updated_at = NOW()
    WHERE id = ${reconciliationId}
    RETURNING *
  `;
  
  const updated = result[0];
  
  // Log to audit
  await logAudit({
    action: AUDIT_ACTIONS.RECONCILIATION_RECONCILED,
    entityType: 'RECONCILIATION',
    entityId: reconciliationId,
    developmentId: reconciliation.developmentId,
    oldValues: { status: 'DRAFT' },
    newValues: { status: 'RECONCILED' },
    performedBy: reconciledBy,
    ipAddress,
    reason: notes,
  });
  
  return mapReconciliationRow(updated);
}

/**
 * Approve reconciliation (Manager only)
 */
export async function approveReconciliation(
  reconciliationId: string,
  approvedBy: string,
  notes?: string,
  ipAddress?: string
): Promise<Reconciliation> {
  const reconciliation = await getReconciliationById(reconciliationId);
  
  if (!reconciliation) {
    throw new Error('Reconciliation not found');
  }
  
  if (reconciliation.status !== 'RECONCILED') {
    throw new Error(`Cannot approve reconciliation with status ${reconciliation.status}`);
  }
  
  // Update reconciliation
  const result = await sql()`
    UPDATE reconciliations
    SET status = 'APPROVED',
        approved_by = ${approvedBy},
        approved_at = NOW(),
        notes = COALESCE(${notes || null}, notes),
        updated_at = NOW()
    WHERE id = ${reconciliationId}
    RETURNING *
  `;
  
  const updated = result[0];
  
  // Log to audit
  await logAudit({
    action: AUDIT_ACTIONS.RECONCILIATION_APPROVED,
    entityType: 'RECONCILIATION',
    entityId: reconciliationId,
    developmentId: reconciliation.developmentId,
    oldValues: { status: 'RECONCILED' },
    newValues: { status: 'APPROVED' },
    performedBy: approvedBy,
    ipAddress,
    reason: notes,
  });
  
  return mapReconciliationRow(updated);
}

/**
 * Get detailed reconciliation report with transaction details
 */
export async function getReconciliationReport(
  reconciliationId: string
): Promise<MonthlyReconciliationReport> {
  const reconciliation = await getReconciliationById(reconciliationId);
  
  if (!reconciliation) {
    throw new Error('Reconciliation not found');
  }
  
  // Get payment details for the period
  const paymentsResult = await sql()`
    SELECT cp.*
    FROM customer_payments cp
    JOIN development_stands ds ON cp.stand_id = ds.id
    WHERE ds.development_id = ${reconciliation.developmentId}
      AND cp.payment_date >= ${reconciliation.periodStart}
      AND cp.payment_date <= ${reconciliation.periodEnd}
    ORDER BY cp.payment_date
  `;
  
  // Get deduction details for the period
  const deductionsResult = await sql()`
    SELECT d.*
    FROM deductions d
    JOIN development_stands ds ON d.stand_id = ds.id
    WHERE ds.development_id = ${reconciliation.developmentId}
      AND d.deduction_date >= ${reconciliation.periodStart}
      AND d.deduction_date <= ${reconciliation.periodEnd}
    ORDER BY d.deduction_date
  `;
  
  return {
    developmentId: reconciliation.developmentId!,
    developmentName: '', // Will be populated if joined
    period: {
      from: reconciliation.periodStart,
      to: reconciliation.periodEnd,
    },
    opening: {
      customerPayments: reconciliation.openingCustomerPayments,
      deductions: reconciliation.openingDeductions,
      balance: reconciliation.openingBalance,
    },
    periodStats: {
      customerPayments: reconciliation.periodCustomerPayments,
      deductions: reconciliation.periodDeductions,
    },
    closing: {
      customerPayments: reconciliation.closingCustomerPayments,
      deductions: reconciliation.closingDeductions,
      balance: reconciliation.closingBalance,
    },
    paymentDetails: paymentsResult.map(p => ({
      id: p.id,
      standId: p.stand_id,
      paymentDate: p.payment_date,
      paymentType: p.payment_type,
      description: p.description,
      invoiceRef: p.invoice_ref,
      amount: Number(p.amount),
      source: p.source,
      sourceId: p.source_id,
      recordedBy: p.recorded_by,
      recordedAt: p.recorded_at,
      receiptNumber: p.receipt_number,
      createdAt: p.created_at,
    })),
    deductionDetails: deductionsResult.map(d => ({
      id: d.id,
      standId: d.stand_id,
      deductionDate: d.deduction_date,
      deductionType: d.deduction_type,
      description: d.description,
      ackRef: d.ack_ref,
      amount: Number(d.amount),
      recipient: d.recipient,
      source: d.source,
      recordedBy: d.recorded_by,
      recordedAt: d.recorded_at,
      createdAt: d.created_at,
    })),
  };
}

// ==========================================
// Helper Functions
// ==========================================

/**
 * Calculate opening balances from previous periods
 */
async function calculateOpeningBalances(
  developmentId: string,
  periodStart: string
): Promise<{
  customerPayments: number;
  deductions: number;
  balance: number;
}> {
  // Get all transactions before period start
  const paymentsResult = await sql()`
    SELECT COALESCE(SUM(cp.amount), 0) as total
    FROM customer_payments cp
    JOIN development_stands ds ON cp.stand_id = ds.id
    WHERE ds.development_id = ${developmentId}
      AND cp.payment_date < ${periodStart}
  `;
  
  const deductionsResult = await sql()`
    SELECT COALESCE(SUM(d.amount), 0) as total
    FROM deductions d
    JOIN development_stands ds ON d.stand_id = ds.id
    WHERE ds.development_id = ${developmentId}
      AND d.deduction_date < ${periodStart}
  `;
  
  const customerPayments = Number(paymentsResult[0]?.total || 0);
  const deductions = Number(deductionsResult[0]?.total || 0);
  
  return {
    customerPayments,
    deductions,
    balance: customerPayments - deductions,
  };
}

/**
 * Calculate period transaction totals
 */
async function calculatePeriodStats(
  developmentId: string,
  periodStart: string,
  periodEnd: string
): Promise<{
  customerPayments: number;
  deductions: number;
}> {
  // Get transactions in period
  const paymentsResult = await sql()`
    SELECT COALESCE(SUM(cp.amount), 0) as total
    FROM customer_payments cp
    JOIN development_stands ds ON cp.stand_id = ds.id
    WHERE ds.development_id = ${developmentId}
      AND cp.payment_date >= ${periodStart}
      AND cp.payment_date <= ${periodEnd}
  `;
  
  const deductionsResult = await sql()`
    SELECT COALESCE(SUM(d.amount), 0) as total
    FROM deductions d
    JOIN development_stands ds ON d.stand_id = ds.id
    WHERE ds.development_id = ${developmentId}
      AND d.deduction_date >= ${periodStart}
      AND d.deduction_date <= ${periodEnd}
  `;
  
  return {
    customerPayments: Number(paymentsResult[0]?.total || 0),
    deductions: Number(deductionsResult[0]?.total || 0),
  };
}

/**
 * Map database row to Reconciliation
 */
function mapReconciliationRow(row: Record<string, unknown>): Reconciliation {
  return {
    id: row.id as string,
    developmentId: row.development_id as string | undefined,
    periodStart: row.period_start as string,
    periodEnd: row.period_end as string,
    openingCustomerPayments: Number(row.opening_customer_payments || 0),
    openingDeductions: Number(row.opening_deductions || 0),
    openingBalance: Number(row.opening_balance || 0),
    periodCustomerPayments: Number(row.period_customer_payments || 0),
    periodDeductions: Number(row.period_deductions || 0),
    closingCustomerPayments: Number(row.closing_customer_payments || 0),
    closingDeductions: Number(row.closing_deductions || 0),
    closingBalance: Number(row.closing_balance || 0),
    status: row.status as ReconciliationStatus,
    reconciledBy: row.reconciled_by as string | undefined,
    reconciledAt: row.reconciled_at as string | undefined,
    approvedBy: row.approved_by as string | undefined,
    approvedAt: row.approved_at as string | undefined,
    notes: row.notes as string | undefined,
    createdAt: row.created_at as string,
  };
}
