// =====================================================
// Stand Lifecycle Service
// Lakecity Accounting Suite
// =====================================================

import { getDb, generateId } from '../db';
import { logAudit, AUDIT_ACTIONS } from '../audit';
import { StandTransfer, TransferStandInput, StandHistory } from '../auth/types';

function sql() {
  return getDb();
}

/**
 * Complete a stand (mark as fully paid)
 * Only allowed if balance is zero or positive (customer doesn't owe)
 */
export async function completeStand(
  standId: string,
  completedBy: string,
  ipAddress?: string
): Promise<{
  id: string;
  standNumber: string;
  developmentName: string;
  status: string;
}> {
  // Get stand details
  const standResult = await sql()`
    SELECT 
      ds.*,
      si.stand_number,
      d.name as development_name
    FROM development_stands ds
    JOIN stand_inventory si ON ds.stand_inventory_id = si.id
    JOIN developments d ON ds.development_id = d.id
    WHERE ds.id = ${standId}
  `;
  
  if (standResult.length === 0) {
    throw new Error('Stand not found');
  }
  
  const stand = standResult[0];
  
  // Check if already completed
  if (stand.accounting_status === 'COMPLETED') {
    throw new Error('Stand is already completed');
  }
  
  // Verify balance is not negative (customer doesn't owe)
  const balance = Number(stand.balance || 0);
  if (balance < 0) {
    throw new Error(`Cannot complete stand with negative balance. Current balance: ${balance.toFixed(2)}`);
  }
  
  // Update stand status
  await sql()`
    UPDATE development_stands
    SET accounting_status = 'COMPLETED',
        updated_at = NOW()
    WHERE id = ${standId}
  `;
  
  // Log to audit
  await logAudit({
    action: AUDIT_ACTIONS.STAND_COMPLETED,
    entityType: 'STAND',
    entityId: standId,
    developmentId: stand.development_id,
    oldValues: { accountingStatus: stand.accounting_status },
    newValues: { accountingStatus: 'COMPLETED' },
    performedBy: completedBy,
    ipAddress,
    reason: `Stand completed. Balance: ${balance.toFixed(2)}`,
  });
  
  return {
    id: standId,
    standNumber: stand.stand_number,
    developmentName: stand.development_name,
    status: 'COMPLETED',
  };
}

/**
 * Cancel a stand (mark as cancelled)
 */
export async function cancelStand(
  standId: string,
  cancelledBy: string,
  reason?: string,
  ipAddress?: string
): Promise<{
  id: string;
  standNumber: string;
  developmentName: string;
  status: string;
}> {
  // Get stand details
  const standResult = await sql()`
    SELECT 
      ds.*,
      si.stand_number,
      d.name as development_name
    FROM development_stands ds
    JOIN stand_inventory si ON ds.stand_inventory_id = si.id
    JOIN developments d ON ds.development_id = d.id
    WHERE ds.id = ${standId}
  `;
  
  if (standResult.length === 0) {
    throw new Error('Stand not found');
  }
  
  const stand = standResult[0];
  
  // Check if already cancelled
  if (stand.accounting_status === 'CANCELLED') {
    throw new Error('Stand is already cancelled');
  }
  
  // Update stand status
  await sql()`
    UPDATE development_stands
    SET accounting_status = 'CANCELLED',
        updated_at = NOW()
    WHERE id = ${standId}
  `;
  
  // Log to audit
  await logAudit({
    action: AUDIT_ACTIONS.STAND_CANCELLED,
    entityType: 'STAND',
    entityId: standId,
    developmentId: stand.development_id,
    oldValues: { accountingStatus: stand.accounting_status },
    newValues: { accountingStatus: 'CANCELLED' },
    performedBy: cancelledBy,
    ipAddress,
    reason: reason || 'Stand cancelled',
  });
  
  return {
    id: standId,
    standNumber: stand.stand_number,
    developmentName: stand.development_name,
    status: 'CANCELLED',
  };
}

/**
 * Transfer stand to a new client
 * Records the transfer and updates client information
 */
export async function transferStand(
  standId: string,
  input: TransferStandInput,
  transferredBy: string,
  ipAddress?: string
): Promise<StandTransfer> {
  // Get current stand details
  const standResult = await sql()`
    SELECT ds.*, si.stand_number
    FROM development_stands ds
    JOIN stand_inventory si ON ds.stand_inventory_id = si.id
    WHERE ds.id = ${standId}
  `;
  
  if (standResult.length === 0) {
    throw new Error('Stand not found');
  }
  
  const stand = standResult[0];
  const oldClientName = stand.client_name;
  const oldClientPhone = stand.client_phone;
  const oldClientEmail = stand.client_email;
  
  // Create stand transfer record
  const transferResult = await sql()`
    INSERT INTO stand_transfers (
      id,
      stand_id,
      old_client_name,
      old_client_phone,
      old_client_email,
      new_client_name,
      new_client_phone,
      new_client_email,
      transfer_date,
      transfer_fee,
      transferred_by,
      notes
    ) VALUES (
      ${generateId()},
      ${standId},
      ${oldClientName || null},
      ${oldClientPhone || null},
      ${oldClientEmail || null},
      ${input.newClientName},
      ${input.newClientPhone || null},
      ${input.newClientEmail || null},
      ${input.transferDate},
      ${input.transferFee || 0},
      ${transferredBy},
      ${input.notes || null}
    )
    RETURNING *
  `;
  
  const transfer = transferResult[0];
  
  // Update stand with new client information
  await sql()`
    UPDATE development_stands
    SET 
      client_name = ${input.newClientName},
      client_phone = ${input.newClientPhone || null},
      client_email = ${input.newClientEmail || null},
      updated_at = NOW()
    WHERE id = ${standId}
  `;
  
  // Log to audit
  await logAudit({
    action: AUDIT_ACTIONS.STAND_TRANSFERRED,
    entityType: 'STAND',
    entityId: standId,
    developmentId: stand.development_id,
    oldValues: {
      clientName: oldClientName,
      clientPhone: oldClientPhone,
      clientEmail: oldClientEmail,
    },
    newValues: {
      clientName: input.newClientName,
      clientPhone: input.newClientPhone,
      clientEmail: input.newClientEmail,
    },
    performedBy: transferredBy,
    ipAddress,
    reason: `Transfer fee: ${(input.transferFee || 0).toFixed(2)}. ${input.notes || ''}`,
  });
  
  return {
    id: transfer.id,
    standId: standId,
    oldClientName: oldClientName || undefined,
    oldClientPhone: oldClientPhone || undefined,
    oldClientEmail: oldClientEmail || undefined,
    newClientName: input.newClientName,
    newClientPhone: input.newClientPhone || undefined,
    newClientEmail: input.newClientEmail || undefined,
    transferDate: transfer.transfer_date,
    transferFee: Number(transfer.transfer_fee),
    transferredBy: transfer.transferred_by,
    notes: transfer.notes || undefined,
    createdAt: transfer.created_at,
  };
}

/**
 * Get complete history for a stand
 * Includes payments, deductions, payouts, and audit trail
 */
export async function getStandHistory(standId: string): Promise<StandHistory> {
  // Get stand details
  const standResult = await sql()`
    SELECT 
      ds.*,
      si.stand_number,
      d.name as development_name
    FROM development_stands ds
    JOIN stand_inventory si ON ds.stand_inventory_id = si.id
    JOIN developments d ON ds.development_id = d.id
    WHERE ds.id = ${standId}
  `;
  
  if (standResult.length === 0) {
    throw new Error('Stand not found');
  }
  
  const stand = standResult[0];
  
  // Get customer payments
  const paymentsResult = await sql()`
    SELECT 
      cp.*,
      u.first_name || ' ' || u.last_name as recorded_by_name
    FROM customer_payments cp
    LEFT JOIN users u ON cp.recorded_by = u.id
    WHERE cp.stand_id = ${standId}
    ORDER BY cp.payment_date DESC, cp.created_at DESC
  `;
  
  // Get deductions
  const deductionsResult = await sql()`
    SELECT 
      d.*,
      u.first_name || ' ' || u.last_name as recorded_by_name
    FROM deductions d
    LEFT JOIN users u ON d.recorded_by = u.id
    WHERE d.stand_id = ${standId}
    ORDER BY d.deduction_date DESC, d.created_at DESC
  `;
  
  // Get developer payouts
  const payoutsResult = await sql()`
    SELECT 
      dp.*,
      req.first_name || ' ' || req.last_name as requested_by_name,
      app.first_name || ' ' || app.last_name as approved_by_name,
      paid.first_name || ' ' || paid.last_name as paid_by_name
    FROM developer_payouts dp
    LEFT JOIN users req ON dp.requested_by = req.id
    LEFT JOIN users app ON dp.approved_by = app.id
    LEFT JOIN users paid ON dp.paid_by = paid.id
    WHERE dp.stand_id = ${standId}
    ORDER BY dp.requested_at DESC
  `;
  
  // Get stand transfers
  const transfersResult = await sql()`
    SELECT 
      st.*,
      u.first_name || ' ' || u.last_name as transferred_by_name
    FROM stand_transfers st
    LEFT JOIN users u ON st.transferred_by = u.id
    WHERE st.stand_id = ${standId}
    ORDER BY st.transfer_date DESC
  `;
  
  // Get audit trail
  const auditResult = await sql()`
    SELECT 
      al.*,
      u.first_name || ' ' || u.last_name as performed_by_name
    FROM audit_log al
    LEFT JOIN users u ON al.performed_by = u.id
    WHERE al.stand_id = ${standId}
      OR (al.entity_type = 'STAND' AND al.entity_id = ${standId})
    ORDER BY al.performed_at DESC
  `;
  
  return {
    stand: {
      id: stand.id,
      standNumber: stand.stand_number,
      developmentName: stand.development_name,
      developmentId: stand.development_id,
      agentCode: stand.agent_code,
      clientName: stand.client_name,
      clientPhone: stand.client_phone,
      clientEmail: stand.client_email,
      salePrice: stand.sale_price ? Number(stand.sale_price) : undefined,
      saleDate: stand.sale_date,
      paymentTerms: stand.payment_terms,
      totalDeposits: Number(stand.total_deposits || 0),
      totalInstallments: Number(stand.total_installments || 0),
      totalCustomerPayments: Number(stand.total_customer_payments || 0),
      totalDeductions: Number(stand.total_deductions || 0),
      balance: Number(stand.balance || 0),
      status: stand.accounting_status,
      createdAt: stand.created_at,
      updatedAt: stand.updated_at,
    },
    payments: paymentsResult.map(p => ({
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
      recordedByName: p.recorded_by_name,
      recordedAt: p.recorded_at,
      receiptNumber: p.receipt_number,
      createdAt: p.created_at,
    })),
    deductions: deductionsResult.map(d => ({
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
      recordedByName: d.recorded_by_name,
      recordedAt: d.recorded_at,
      createdAt: d.created_at,
    })),
    payouts: payoutsResult.map(p => ({
      id: p.id,
      standId: p.stand_id,
      developmentId: p.development_id,
      developerName: p.developer_name,
      payoutType: p.payout_type,
      amount: Number(p.amount),
      description: p.description,
      status: p.status,
      requestedBy: p.requested_by,
      requestedAt: p.requested_at,
      requestedByName: p.requested_by_name,
      approvedBy: p.approved_by,
      approvedAt: p.approved_at,
      approvedByName: p.approved_by_name,
      paidBy: p.paid_by,
      paidAt: p.paid_at,
      paidByName: p.paid_by_name,
      paymentMethod: p.payment_method,
      paymentReference: p.payment_reference,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    })),
    transfers: transfersResult.map(t => ({
      id: t.id,
      standId: t.stand_id,
      oldClientName: t.old_client_name || undefined,
      oldClientPhone: t.old_client_phone || undefined,
      oldClientEmail: t.old_client_email || undefined,
      newClientName: t.new_client_name,
      newClientPhone: t.new_client_phone || undefined,
      newClientEmail: t.new_client_email || undefined,
      transferDate: t.transfer_date,
      transferFee: Number(t.transfer_fee),
      transferredBy: t.transferred_by,
      transferredByName: t.transferred_by_name || undefined,
      notes: t.notes || undefined,
      createdAt: t.created_at,
    })),
    auditTrail: auditResult.map(a => ({
      id: a.id,
      action: a.action,
      entityType: a.entity_type,
      entityId: a.entity_id,
      developmentId: a.development_id,
      standId: a.stand_id,
      oldValues: a.old_values,
      newValues: a.new_values,
      performedBy: a.performed_by,
      performedByName: a.performed_by_name,
      performedAt: a.performed_at,
      ipAddress: a.ip_address,
      reason: a.reason,
    })),
  };
}

/**
 * Get transfer history for a stand
 */
export async function getStandTransfers(standId: string): Promise<StandTransfer[]> {
  const result = await sql()`
    SELECT 
      st.*,
      u.first_name || ' ' || u.last_name as transferred_by_name
    FROM stand_transfers st
    LEFT JOIN users u ON st.transferred_by = u.id
    WHERE st.stand_id = ${standId}
    ORDER BY st.transfer_date DESC
  `;
  
  return result.map(t => ({
    id: t.id,
    standId: t.stand_id,
    oldClientName: t.old_client_name || undefined,
    oldClientPhone: t.old_client_phone || undefined,
    oldClientEmail: t.old_client_email || undefined,
    newClientName: t.new_client_name,
    newClientPhone: t.new_client_phone || undefined,
    newClientEmail: t.new_client_email || undefined,
    transferDate: t.transfer_date,
    transferFee: Number(t.transfer_fee),
    transferredBy: t.transferred_by,
    transferredByName: t.transferred_by_name || undefined,
    notes: t.notes || undefined,
    createdAt: t.created_at,
  }));
}
