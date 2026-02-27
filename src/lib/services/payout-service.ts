// =====================================================
// Developer Payout Service
// Lakecity Accounting Suite
// =====================================================

import { getDb, generateId } from '../db';
import { logAudit, AUDIT_ACTIONS } from '../audit';
import { canTransitionPayoutStatus, type PayoutStatus, type PaymentMethod } from '../auth/rbac';
import {
  DeveloperPayout,
  PayoutApprovalHistory,
  RequestPayoutInput,
  ApprovePayoutInput,
  MarkPayoutPaidInput,
  PayoutSummary,
  PayoutFilters,
} from '../auth/types';

// Lazy initialization to avoid build-time errors
function sql() {
  return getDb();
}

/**
 * Calculate net payout amount for a stand
 * Net = Total Customer Payments - (F&C Commission + F&C Admin Fees)
 * Legal fees and other third-party deductions go to developer (not deducted)
 */
export async function calculateNetPayout(
  standId: string
): Promise<{
  totalReceived: number;
  fcCommission: number;
  fcAdminFees: number;
  otherDeductions: number; // Legal, AOS, etc - these go to developer
  netPayout: number;
}> {
  // Get total customer payments
  const paymentsResult = await sql()`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM customer_payments
    WHERE stand_id = ${standId}
  `;
  const totalReceived = Number(paymentsResult[0]?.total || 0);

  // Get F&C deductions (commission + admin fees) - these reduce payout
  const fcDeductionsResult = await sql()`
    SELECT 
      COALESCE(SUM(CASE WHEN deduction_type = 'COMMISSION' THEN amount ELSE 0 END), 0) as commission,
      COALESCE(SUM(CASE WHEN deduction_type = 'ADMIN_FEE' THEN amount ELSE 0 END), 0) as admin_fees
    FROM deductions
    WHERE stand_id = ${standId}
      AND deduction_type IN ('COMMISSION', 'ADMIN_FEE')
  `;
  const fcCommission = Number(fcDeductionsResult[0]?.commission || 0);
  const fcAdminFees = Number(fcDeductionsResult[0]?.admin_fees || 0);

  // Get other deductions (legal, AOS, etc) - these go to developer, not deducted from payout
  const otherDeductionsResult = await sql()`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM deductions
    WHERE stand_id = ${standId}
      AND deduction_type NOT IN ('COMMISSION', 'ADMIN_FEE')
  `;
  const otherDeductions = Number(otherDeductionsResult[0]?.total || 0);

  // Net payout = Total received - (F&C Commission + F&C Admin Fees)
  // Legal fees and other deductions are paid to developer, so not subtracted
  const netPayout = totalReceived - fcCommission - fcAdminFees;

  return {
    totalReceived,
    fcCommission,
    fcAdminFees,
    otherDeductions,
    netPayout: Math.max(0, netPayout),
  };
}

/**
 * Request a new payout (Accountant)
 * Calculates net amount after F&C deductions
 */
export async function requestPayout(
  input: RequestPayoutInput,
  requestedBy: string,
  ipAddress?: string
): Promise<DeveloperPayout> {
  // Validate stand exists
  const standResult = await sql()`
    SELECT ds.*, d.name as development_name, si.stand_number
    FROM development_stands ds
    JOIN developments d ON ds.development_id = d.id
    JOIN stand_inventory si ON ds.stand_inventory_id = si.id
    WHERE ds.id = ${input.standId}
  `;
  
  if (standResult.length === 0) {
    throw new Error('Stand not found');
  }
  
  const stand = standResult[0];
  
  // Calculate net payout amount
  const payoutCalc = await calculateNetPayout(input.standId);
  
  // Use calculated amount if not specified, or validate provided amount
  const payoutAmount = input.amount || payoutCalc.netPayout;
  
  if (payoutAmount > payoutCalc.netPayout) {
    throw new Error(
      `Insufficient net balance. Available: ${payoutCalc.netPayout.toFixed(2)}, ` +
      `Requested: ${payoutAmount.toFixed(2)}. ` +
      `(Total: ${payoutCalc.totalReceived.toFixed(2)}, ` +
      `F&C Commission: ${payoutCalc.fcCommission.toFixed(2)}, ` +
      `F&C Admin: ${payoutCalc.fcAdminFees.toFixed(2)})`
    );
  }
  
  // Get related deductions for this payout
  const deductionsResult = await sql()`
    SELECT id, deduction_type, amount
    FROM deductions
    WHERE stand_id = ${input.standId}
    ORDER BY deduction_date DESC
  `;
  const relatedDeductionIds = deductionsResult.map(d => d.id);
  
  // Create payout record
  const payoutResult = await sql()`
    INSERT INTO developer_payouts (
      id,
      stand_id,
      development_id,
      developer_name,
      payout_type,
      amount,
      description,
      related_deduction_ids,
      requested_by,
      status,
      period_start,
      period_end
    ) VALUES (
      ${generateId()},
      ${input.standId},
      ${stand.development_id},
      ${input.developerName},
      ${input.payoutType},
      ${payoutAmount},
      ${input.description || `Net payout for Stand ${stand.stand_number}`},
      ${relatedDeductionIds},
      ${requestedBy},
      'PENDING',
      ${input.periodStart || null},
      ${input.periodEnd || null}
    )
    RETURNING *
  `;
  
  const payout = payoutResult[0];
  
  // Record in approval history
  await sql()`
    INSERT INTO payout_approval_history (
      id,
      payout_id,
      action,
      performed_by,
      notes,
      old_status,
      new_status
    ) VALUES (
      ${generateId()},
      ${payout.id},
      'REQUESTED',
      ${requestedBy},
      'Payout requested',
      null,
      'PENDING'
    )
  `;
  
  // Log to audit
  await logAudit({
    action: AUDIT_ACTIONS.PAYOUT_REQUESTED,
    entityType: 'PAYOUT',
    entityId: payout.id,
    standId: input.standId,
    developmentId: stand.development_id,
    newValues: {
      standId: input.standId,
      developerName: input.developerName,
      amount: input.amount,
      payoutType: input.payoutType,
      status: 'PENDING',
    },
    performedBy: requestedBy,
    ipAddress,
    reason: `Payout requested for ${input.developerName}`,
  });
  
  return mapPayoutRow({
    ...payout,
    stand_number: stand.stand_number,
    development_name: stand.development_name,
  });
}

/**
 * Approve or reject payout (Manager only)
 */
export async function approvePayout(
  payoutId: string,
  input: ApprovePayoutInput,
  approvedBy: string,
  ipAddress?: string
): Promise<DeveloperPayout> {
  // Get current payout
  const payoutResult = await sql()`
    SELECT dp.*, 
      s.stand_number,
      d.name as development_name,
      req.first_name || ' ' || req.last_name as requested_by_name
    FROM developer_payouts dp
    JOIN development_stands ds ON dp.stand_id = ds.id
    JOIN stand_inventory s ON ds.stand_inventory_id = s.id
    JOIN developments d ON dp.development_id = d.id
    JOIN users req ON dp.requested_by = req.id
    WHERE dp.id = ${payoutId}
  `;
  
  if (payoutResult.length === 0) {
    throw new Error('Payout not found');
  }
  
  const payout = payoutResult[0];
  
  if (payout.status !== 'PENDING') {
    throw new Error(`Cannot ${input.approved ? 'approve' : 'reject'} payout with status ${payout.status}`);
  }
  
  const newStatus: PayoutStatus = input.approved ? 'APPROVED' : 'REJECTED';
  const oldStatus = payout.status as PayoutStatus;
  
  if (!canTransitionPayoutStatus(oldStatus, newStatus)) {
    throw new Error(`Invalid status transition from ${oldStatus} to ${newStatus}`);
  }
  
  // Update payout
  const updatedResult = await sql()`
    UPDATE developer_payouts
    SET status = ${newStatus},
        approved_by = ${approvedBy},
        approved_at = NOW(),
        approval_notes = ${input.notes || null},
        updated_at = NOW()
    WHERE id = ${payoutId}
    RETURNING *
  `;
  
  const updated = updatedResult[0];
  
  // Record in history
  await sql()`
    INSERT INTO payout_approval_history (
      id,
      payout_id,
      action,
      performed_by,
      notes,
      old_status,
      new_status
    ) VALUES (
      ${generateId()},
      ${payoutId},
      ${newStatus},
      ${approvedBy},
      ${input.notes || null},
      ${oldStatus},
      ${newStatus}
    )
  `;
  
  // Log to audit
  await logAudit({
    action: input.approved ? AUDIT_ACTIONS.PAYOUT_APPROVED : AUDIT_ACTIONS.PAYOUT_REJECTED,
    entityType: 'PAYOUT',
    entityId: payoutId,
    standId: payout.stand_id,
    developmentId: payout.development_id,
    oldValues: { status: oldStatus },
    newValues: { status: newStatus, approvedBy, notes: input.notes },
    performedBy: approvedBy,
    ipAddress,
    reason: input.notes,
  });
  
  return mapPayoutRow({
    ...updated,
    stand_number: payout.stand_number,
    development_name: payout.development_name,
    requested_by_name: payout.requested_by_name,
  });
}

/**
 * Mark payout as paid (Accountant, after approval)
 */
export async function markPayoutPaid(
  payoutId: string,
  input: MarkPayoutPaidInput,
  paidBy: string,
  ipAddress?: string
): Promise<DeveloperPayout> {
  // Get current payout
  const payoutResult = await sql()`
    SELECT dp.*, 
      s.stand_number,
      d.name as development_name,
      req.first_name || ' ' || req.last_name as requested_by_name,
      app.first_name || ' ' || app.last_name as approved_by_name
    FROM developer_payouts dp
    JOIN development_stands ds ON dp.stand_id = ds.id
    JOIN stand_inventory s ON ds.stand_inventory_id = s.id
    JOIN developments d ON dp.development_id = d.id
    LEFT JOIN users req ON dp.requested_by = req.id
    LEFT JOIN users app ON dp.approved_by = app.id
    WHERE dp.id = ${payoutId}
  `;
  
  if (payoutResult.length === 0) {
    throw new Error('Payout not found');
  }
  
  const payout = payoutResult[0];
  
  if (payout.status !== 'APPROVED') {
    throw new Error('Payout must be approved before marking as paid');
  }
  
  const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
  
  // Update payout
  const updatedResult = await sql()`
    UPDATE developer_payouts
    SET status = 'PAID',
        paid_by = ${paidBy},
        paid_at = ${paidAt.toISOString()},
        payment_method = ${input.paymentMethod},
        payment_reference = ${input.paymentReference},
        updated_at = NOW()
    WHERE id = ${payoutId}
    RETURNING *
  `;
  
  const updated = updatedResult[0];
  
  // Record in history
  await sql()`
    INSERT INTO payout_approval_history (
      id,
      payout_id,
      action,
      performed_by,
      notes,
      old_status,
      new_status
    ) VALUES (
      ${generateId()},
      ${payoutId},
      'PAID',
      ${paidBy},
      ${`Payment method: ${input.paymentMethod}, Reference: ${input.paymentReference}`},
      'APPROVED',
      'PAID'
    )
  `;
  
  // Log to audit
  await logAudit({
    action: AUDIT_ACTIONS.PAYOUT_PAID,
    entityType: 'PAYOUT',
    entityId: payoutId,
    standId: payout.stand_id,
    developmentId: payout.development_id,
    oldValues: { status: 'APPROVED' },
    newValues: {
      status: 'PAID',
      paymentMethod: input.paymentMethod,
      paymentReference: input.paymentReference,
      paidAt: paidAt.toISOString(),
    },
    performedBy: paidBy,
    ipAddress,
    reason: `Payment processed via ${input.paymentMethod}`,
  });
  
  return mapPayoutRow({
    ...updated,
    stand_number: payout.stand_number,
    development_name: payout.development_name,
    requested_by_name: payout.requested_by_name,
    approved_by_name: payout.approved_by_name,
  });
}

/**
 * Get pending payouts for manager dashboard
 */
export async function getPendingPayouts(
  filters?: PayoutFilters,
  options: { limit?: number; offset?: number } = {}
): Promise<PayoutSummary> {
  const { limit = 50, offset = 0 } = options;
  
  // Build WHERE conditions
  const conditions: string[] = ["dp.status = 'PENDING'"];
  const params: unknown[] = [];
  
  if (filters?.developer) {
    conditions.push(`dp.developer_name = $${params.length + 1}`);
    params.push(filters.developer);
  }
  
  if (filters?.developmentId) {
    conditions.push(`dp.development_id = $${params.length + 1}`);
    params.push(filters.developmentId);
  }
  
  if (filters?.dateFrom) {
    conditions.push(`dp.requested_at >= $${params.length + 1}`);
    params.push(filters.dateFrom);
  }
  
  if (filters?.dateTo) {
    conditions.push(`dp.requested_at <= $${params.length + 1}`);
    params.push(filters.dateTo);
  }
  
  if (filters?.requestedBy) {
    conditions.push(`dp.requested_by = $${params.length + 1}`);
    params.push(filters.requestedBy);
  }
  
  const whereClause = conditions.join(' AND ');
  
  // Get payouts
  const payoutsResult = await (sql() as any).unsafe(`
    SELECT dp.*, 
      s.stand_number,
      d.name as development_name,
      req.first_name || ' ' || req.last_name as requested_by_name
    FROM developer_payouts dp
    JOIN development_stands ds ON dp.stand_id = ds.id
    JOIN stand_inventory s ON ds.stand_inventory_id = s.id
    JOIN developments d ON dp.development_id = d.id
    JOIN users req ON dp.requested_by = req.id
    WHERE ${whereClause}
    ORDER BY dp.requested_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `, [...params, limit, offset]);
  
  // Get summary
  const summaryResult = await (sql() as any).unsafe(`
    SELECT 
      COUNT(*) as total_pending,
      COALESCE(SUM(CASE WHEN status = 'PENDING' THEN amount ELSE 0 END), 0) as pending_amount,
      COALESCE(SUM(CASE WHEN status = 'APPROVED' THEN amount ELSE 0 END), 0) as approved_amount,
      COALESCE(SUM(CASE WHEN status = 'PAID' THEN amount ELSE 0 END), 0) as paid_amount,
      COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) as total_approved,
      COUNT(CASE WHEN status = 'PAID' THEN 1 END) as total_paid,
      developer_name,
      COUNT(*) as count_by_developer,
      SUM(amount) as amount_by_developer
    FROM developer_payouts dp
    WHERE ${whereClause}
    GROUP BY developer_name
  `, params);
  
  // Calculate totals
  const totalPending = summaryResult.reduce((sum: number, row: { count_by_developer: number }) => sum + Number(row.count_by_developer), 0);
  const totalApproved = summaryResult.reduce((sum: number, row: { total_approved: number }) => sum + Number(row.total_approved), 0);
  const totalPaid = summaryResult.reduce((sum: number, row: { total_paid: number }) => sum + Number(row.total_paid), 0);
  const pendingAmount = summaryResult.reduce((sum: number, row: { pending_amount: number }) => sum + Number(row.pending_amount), 0);
  const approvedAmount = summaryResult.reduce((sum: number, row: { approved_amount: number }) => sum + Number(row.approved_amount), 0);
  const paidAmount = summaryResult.reduce((sum: number, row: { paid_amount: number }) => sum + Number(row.paid_amount), 0);
  
  const byDeveloper = summaryResult.map((row: { developer_name: string; count_by_developer: number; amount_by_developer: number }) => ({
    developerName: row.developer_name,
    count: Number(row.count_by_developer),
    amount: Number(row.amount_by_developer),
  }));
  
  return {
    payouts: payoutsResult.map(mapPayoutRow),
    summary: {
      totalPending,
      totalApproved,
      totalPaid,
      pendingAmount,
      approvedAmount,
      paidAmount,
      byDeveloper,
    },
  };
}

/**
 * Get all payouts with filters
 */
export async function getPayouts(
  filters?: PayoutFilters,
  options: { limit?: number; offset?: number } = {}
): Promise<PayoutSummary> {
  const { limit = 50, offset = 0 } = options;
  
  // Build WHERE conditions
  const conditions: string[] = [];
  const params: unknown[] = [];
  
  if (filters?.status) {
    conditions.push(`dp.status = $${params.length + 1}`);
    params.push(filters.status);
  }
  
  if (filters?.developer) {
    conditions.push(`dp.developer_name = $${params.length + 1}`);
    params.push(filters.developer);
  }
  
  if (filters?.developmentId) {
    conditions.push(`dp.development_id = $${params.length + 1}`);
    params.push(filters.developmentId);
  }
  
  if (filters?.dateFrom) {
    conditions.push(`dp.requested_at >= $${params.length + 1}`);
    params.push(filters.dateFrom);
  }
  
  if (filters?.dateTo) {
    conditions.push(`dp.requested_at <= $${params.length + 1}`);
    params.push(filters.dateTo);
  }
  
  if (filters?.requestedBy) {
    conditions.push(`dp.requested_by = $${params.length + 1}`);
    params.push(filters.requestedBy);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  // Get payouts
  const payoutsResult = await (sql() as any).unsafe(`
    SELECT dp.*, 
      s.stand_number,
      d.name as development_name,
      req.first_name || ' ' || req.last_name as requested_by_name,
      app.first_name || ' ' || app.last_name as approved_by_name,
      paid.first_name || ' ' || paid.last_name as paid_by_name
    FROM developer_payouts dp
    JOIN development_stands ds ON dp.stand_id = ds.id
    JOIN stand_inventory s ON ds.stand_inventory_id = s.id
    JOIN developments d ON dp.development_id = d.id
    JOIN users req ON dp.requested_by = req.id
    LEFT JOIN users app ON dp.approved_by = app.id
    LEFT JOIN users paid ON dp.paid_by = paid.id
    ${whereClause}
    ORDER BY dp.requested_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `, [...params, limit, offset]);
  
  // Get summary
  const summaryResult = await (sql() as any).unsafe(`
    SELECT 
      COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as total_pending,
      COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) as total_approved,
      COUNT(CASE WHEN status = 'PAID' THEN 1 END) as total_paid,
      COALESCE(SUM(CASE WHEN status = 'PENDING' THEN amount ELSE 0 END), 0) as pending_amount,
      COALESCE(SUM(CASE WHEN status = 'APPROVED' THEN amount ELSE 0 END), 0) as approved_amount,
      COALESCE(SUM(CASE WHEN status = 'PAID' THEN amount ELSE 0 END), 0) as paid_amount,
      developer_name,
      COUNT(*) as count_by_developer,
      SUM(amount) as amount_by_developer
    FROM developer_payouts dp
    ${whereClause}
    GROUP BY developer_name
  `, params);
  
  const totalPending = summaryResult.reduce((sum: number, row: { total_pending: number }) => sum + Number(row.total_pending), 0);
  const totalApproved = summaryResult.reduce((sum: number, row: { total_approved: number }) => sum + Number(row.total_approved), 0);
  const totalPaid = summaryResult.reduce((sum: number, row: { total_paid: number }) => sum + Number(row.total_paid), 0);
  const pendingAmount = summaryResult.reduce((sum: number, row: { pending_amount: number }) => sum + Number(row.pending_amount), 0);
  const approvedAmount = summaryResult.reduce((sum: number, row: { approved_amount: number }) => sum + Number(row.approved_amount), 0);
  const paidAmount = summaryResult.reduce((sum: number, row: { paid_amount: number }) => sum + Number(row.paid_amount), 0);
  
  const byDeveloper = summaryResult.map((row: { developer_name: string; count_by_developer: number; amount_by_developer: number }) => ({
    developerName: row.developer_name,
    count: Number(row.count_by_developer),
    amount: Number(row.amount_by_developer),
  }));
  
  return {
    payouts: payoutsResult.map(mapPayoutRow),
    summary: {
      totalPending,
      totalApproved,
      totalPaid,
      pendingAmount,
      approvedAmount,
      paidAmount,
      byDeveloper,
    },
  };
}

/**
 * Get payout by ID with full details
 */
export async function getPayoutById(payoutId: string): Promise<DeveloperPayout & { history: PayoutApprovalHistory[] }> {
  // Get payout
  const payoutResult = await sql()`
    SELECT dp.*, 
      s.stand_number,
      d.name as development_name,
      req.first_name || ' ' || req.last_name as requested_by_name,
      app.first_name || ' ' || app.last_name as approved_by_name,
      paid.first_name || ' ' || paid.last_name as paid_by_name
    FROM developer_payouts dp
    JOIN development_stands ds ON dp.stand_id = ds.id
    JOIN stand_inventory s ON ds.stand_inventory_id = s.id
    JOIN developments d ON dp.development_id = d.id
    JOIN users req ON dp.requested_by = req.id
    LEFT JOIN users app ON dp.approved_by = app.id
    LEFT JOIN users paid ON dp.paid_by = paid.id
    WHERE dp.id = ${payoutId}
  `;
  
  if (payoutResult.length === 0) {
    throw new Error('Payout not found');
  }
  
  // Get history
  const historyResult = await sql()`
    SELECT 
      pah.*,
      u.first_name || ' ' || u.last_name as performed_by_name
    FROM payout_approval_history pah
    LEFT JOIN users u ON pah.performed_by = u.id
    WHERE pah.payout_id = ${payoutId}
    ORDER BY pah.performed_at ASC
  `;
  
  return {
    ...mapPayoutRow(payoutResult[0]),
    history: historyResult.map(mapHistoryRow),
  };
}

/**
 * Get payout history for a stand
 */
export async function getPayoutsByStand(standId: string): Promise<DeveloperPayout[]> {
  const result = await sql()`
    SELECT dp.*, 
      s.stand_number,
      d.name as development_name,
      req.first_name || ' ' || req.last_name as requested_by_name,
      app.first_name || ' ' || app.last_name as approved_by_name,
      paid.first_name || ' ' || paid.last_name as paid_by_name
    FROM developer_payouts dp
    JOIN development_stands ds ON dp.stand_id = ds.id
    JOIN stand_inventory s ON ds.stand_inventory_id = s.id
    JOIN developments d ON dp.development_id = d.id
    JOIN users req ON dp.requested_by = req.id
    LEFT JOIN users app ON dp.approved_by = app.id
    LEFT JOIN users paid ON dp.paid_by = paid.id
    WHERE dp.stand_id = ${standId}
    ORDER BY dp.requested_at DESC
  `;
  
  return result.map(mapPayoutRow);
}

/**
 * Map database row to DeveloperPayout
 */
function mapPayoutRow(row: Record<string, unknown>): DeveloperPayout {
  return {
    id: row.id as string,
    standId: row.stand_id as string,
    developmentId: row.development_id as string,
    developerName: row.developer_name as string,
    payoutType: row.payout_type as 'INSTALLMENT' | 'COMPLETION' | 'COMMISSION',
    amount: Number(row.amount),
    description: row.description as string | undefined,
    status: row.status as PayoutStatus,
    requestedBy: row.requested_by as string,
    requestedAt: row.requested_at as string,
    requestedByName: row.requested_by_name as string | undefined,
    approvedBy: row.approved_by as string | undefined,
    approvedAt: row.approved_at as string | undefined,
    approvedByName: row.approved_by_name as string | undefined,
    approvalNotes: row.approval_notes as string | undefined,
    paidBy: row.paid_by as string | undefined,
    paidAt: row.paid_at as string | undefined,
    paidByName: row.paid_by_name as string | undefined,
    paymentMethod: row.payment_method as PaymentMethod | undefined,
    paymentReference: row.payment_reference as string | undefined,
    relatedDeductionIds: row.related_deduction_ids as string[] | undefined,
    periodStart: row.period_start as string | undefined,
    periodEnd: row.period_end as string | undefined,
    standNumber: row.stand_number as string | undefined,
    developmentName: row.development_name as string | undefined,
    totalReceived: row.total_received ? Number(row.total_received) : undefined,
    fcCommission: row.fc_commission ? Number(row.fc_commission) : undefined,
    fcAdminFees: row.fc_admin_fees ? Number(row.fc_admin_fees) : undefined,
    otherDeductions: row.other_deductions ? Number(row.other_deductions) : undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/**
 * Map database row to PayoutApprovalHistory
 */
function mapHistoryRow(row: Record<string, unknown>): PayoutApprovalHistory {
  return {
    id: row.id as string,
    payoutId: row.payout_id as string,
    action: row.action as 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'PAID',
    performedBy: row.performed_by as string,
    performedByName: row.performed_by_name as string | undefined,
    performedAt: row.performed_at as string,
    notes: row.notes as string | undefined,
    oldStatus: row.old_status as PayoutStatus | undefined,
    newStatus: row.new_status as PayoutStatus | undefined,
  };
}


