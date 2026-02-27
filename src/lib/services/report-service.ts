// =====================================================
// Reporting Service
// Lakecity Accounting Suite
// =====================================================

import { getDb } from '../db';
import {
  EstateSummaryReport,
  DeveloperPayoutReport,
  AgentPerformanceReport,
  MonthlyReconciliationReport,
  DateRange,
} from '../auth/types';

// Lazy initialization to avoid build-time errors
function sql() {
  return getDb();
}

/**
 * Get estate/development summary report
 */
export async function getEstateSummary(
  developmentId?: string
): Promise<EstateSummaryReport[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  
  if (developmentId) {
    conditions.push(`d.id = $${params.length + 1}`);
    params.push(developmentId);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  const result = await (sql() as any).unsafe(`
    SELECT 
      d.id as development_id,
      d.name as development_name,
      COUNT(DISTINCT ds.id) as total_stands,
      COUNT(DISTINCT CASE WHEN ds.accounting_status = 'ACTIVE' THEN ds.id END) as active_stands,
      COUNT(DISTINCT CASE WHEN ds.accounting_status = 'COMPLETED' THEN ds.id END) as completed_stands,
      COALESCE(SUM(ds.total_customer_payments), 0) as total_payments,
      COALESCE(SUM(ds.total_deductions), 0) as total_deductions,
      COALESCE(SUM(ds.balance), 0) as total_balance
    FROM developments d
    LEFT JOIN development_stands ds ON d.id = ds.development_id
    ${whereClause}
    GROUP BY d.id, d.name
    ORDER BY d.name
  `, params);
  
  return result.map((row: Record<string, unknown>) => ({
    developmentId: row.development_id as string,
    developmentName: row.development_name as string,
    totalStands: Number(row.total_stands),
    activeStands: Number(row.active_stands),
    completedStands: Number(row.completed_stands),
    totalPayments: Number(row.total_payments),
    totalDeductions: Number(row.total_deductions),
    totalBalance: Number(row.total_balance),
  }));
}

/**
 * Get developer payout summary report
 */
export async function getDeveloperPayoutSummary(
  developerName?: string,
  period?: DateRange
): Promise<DeveloperPayoutReport[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  
  if (developerName) {
    conditions.push(`developer_name = $${params.length + 1}`);
    params.push(developerName);
  }
  
  if (period?.from) {
    conditions.push(`requested_at >= $${params.length + 1}`);
    params.push(period.from);
  }
  
  if (period?.to) {
    conditions.push(`requested_at <= $${params.length + 1}`);
    params.push(period.to);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  const result = await (sql() as any).unsafe(`
    SELECT 
      developer_name,
      COUNT(*) as total_payouts,
      COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_count,
      COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) as approved_count,
      COUNT(CASE WHEN status = 'PAID' THEN 1 END) as paid_count,
      COALESCE(SUM(CASE WHEN status = 'PENDING' THEN amount END), 0) as pending_amount,
      COALESCE(SUM(CASE WHEN status = 'APPROVED' THEN amount END), 0) as approved_amount,
      COALESCE(SUM(CASE WHEN status = 'PAID' THEN amount END), 0) as paid_amount
    FROM developer_payouts
    ${whereClause}
    GROUP BY developer_name
    ORDER BY developer_name
  `, params);
  
  return result.map((row: Record<string, unknown>) => ({
    developerName: row.developer_name as string,
    totalPayouts: Number(row.total_payouts),
    pendingCount: Number(row.pending_count),
    approvedCount: Number(row.approved_count),
    paidCount: Number(row.paid_count),
    pendingAmount: Number(row.pending_amount),
    approvedAmount: Number(row.approved_amount),
    paidAmount: Number(row.paid_amount),
  }));
}

/**
 * Get agent performance report
 */
export async function getAgentPerformance(
  agentCode: string,
  period?: DateRange
): Promise<AgentPerformanceReport> {
  // Get stands for agent
  const standsResult = await sql()`
    SELECT 
      s.stand_number,
      ds.development_id,
      d.name as development_name,
      ds.client_name,
      ds.total_customer_payments,
      ds.total_deductions,
      ds.balance,
      ds.accounting_status
    FROM development_stands ds
    JOIN stand_inventory s ON ds.stand_inventory_id = s.id
    JOIN developments d ON ds.development_id = d.id
    WHERE ds.agent_code = ${agentCode}
    ORDER BY d.name, s.stand_number
  `;
  
  const stands = standsResult.map((row: Record<string, unknown>) => ({
    standNumber: row.stand_number as string,
    developmentName: row.development_name as string,
    clientName: row.client_name as string | undefined,
    totalPayments: Number(row.total_customer_payments),
    balance: Number(row.balance),
    status: row.accounting_status as string,
  }));
  
  const summary = {
    totalStands: stands.length,
    totalPayments: stands.reduce((a, s) => a + s.totalPayments, 0),
    totalDeductions: standsResult.reduce((a: number, s: Record<string, unknown>) => a + Number(s.total_deductions), 0),
    totalBalance: stands.reduce((a, s) => a + s.balance, 0),
    activeStands: stands.filter(s => s.status === 'ACTIVE').length,
    completedStands: stands.filter(s => s.status === 'COMPLETED').length,
  };
  
  return {
    agentCode,
    stands,
    totalStands: summary.totalStands,
    activeStands: summary.activeStands,
    completedStands: summary.completedStands,
    totalPayments: summary.totalPayments,
    totalDeductions: summary.totalDeductions,
    totalBalance: summary.totalBalance,
  };
}

/**
 * Generate monthly reconciliation report
 */
export async function generateMonthlyReconciliation(
  developmentId: string,
  year: number,
  month: number
): Promise<MonthlyReconciliationReport> {
  const periodStart = `${year}-${month.toString().padStart(2, '0')}-01`;
  const periodEnd = new Date(year, month, 0).toISOString().split('T')[0];
  
  // Get development name
  const devResult = await sql()`
    SELECT name FROM developments WHERE id = ${developmentId}
  `;
  
  if (devResult.length === 0) {
    throw new Error('Development not found');
  }
  
  const developmentName = devResult[0].name;
  
  // Get opening balances (from previous period or zero)
  const openingResult = await sql()`
    SELECT 
      closing_customer_payments,
      closing_deductions,
      closing_balance
    FROM reconciliations
    WHERE development_id = ${developmentId} 
      AND period_end < ${periodStart}
    ORDER BY period_end DESC
    LIMIT 1
  `;
  
  const openingPayments = Number(openingResult[0]?.closing_customer_payments || 0);
  const openingDeductions = Number(openingResult[0]?.closing_deductions || 0);
  const openingBalance = Number(openingResult[0]?.closing_balance || 0);
  
  // Get period transactions
  const periodPaymentsResult = await sql()`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM customer_payments cp
    JOIN development_stands ds ON cp.stand_id = ds.id
    WHERE ds.development_id = ${developmentId} 
      AND cp.payment_date >= ${periodStart}
      AND cp.payment_date <= ${periodEnd}
  `;
  
  const periodDeductionsResult = await sql()`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM deductions d
    JOIN development_stands ds ON d.stand_id = ds.id
    WHERE ds.development_id = ${developmentId}
      AND d.deduction_date >= ${periodStart}
      AND d.deduction_date <= ${periodEnd}
  `;
  
  const periodPaymentsTotal = Number(periodPaymentsResult[0]?.total || 0);
  const periodDeductionsTotal = Number(periodDeductionsResult[0]?.total || 0);
  
  // Calculate closing balances
  const closingPayments = openingPayments + periodPaymentsTotal;
  const closingDeductions = openingDeductions + periodDeductionsTotal;
  const closingBalance = closingPayments - closingDeductions;
  
  // Get detailed transactions
  const paymentDetailsResult = await sql()`
    SELECT 
      cp.*,
      si.stand_number,
      u.first_name || ' ' || u.last_name as recorded_by_name
    FROM customer_payments cp
    JOIN development_stands ds ON cp.stand_id = ds.id
    JOIN stand_inventory si ON ds.stand_inventory_id = si.id
    LEFT JOIN users u ON cp.recorded_by = u.id
    WHERE ds.development_id = ${developmentId}
      AND cp.payment_date >= ${periodStart}
      AND cp.payment_date <= ${periodEnd}
    ORDER BY cp.payment_date
  `;
  
  const deductionDetailsResult = await sql()`
    SELECT 
      d.*,
      si.stand_number,
      u.first_name || ' ' || u.last_name as recorded_by_name
    FROM deductions d
    JOIN development_stands ds ON d.stand_id = ds.id
    JOIN stand_inventory si ON ds.stand_inventory_id = si.id
    LEFT JOIN users u ON d.recorded_by = u.id
    WHERE ds.development_id = ${developmentId}
      AND d.deduction_date >= ${periodStart}
      AND d.deduction_date <= ${periodEnd}
    ORDER BY d.deduction_date
  `;
  
  return {
    developmentId,
    developmentName,
    period: { from: periodStart, to: periodEnd },
    opening: {
      customerPayments: openingPayments,
      deductions: openingDeductions,
      balance: openingBalance,
    },
    periodStats: {
      customerPayments: periodPaymentsTotal,
      deductions: periodDeductionsTotal,
    },
    closing: {
      customerPayments: closingPayments,
      deductions: closingDeductions,
      balance: closingBalance,
    },
    paymentDetails: paymentDetailsResult.map(mapPaymentRow),
    deductionDetails: deductionDetailsResult.map(mapDeductionRow),
  };
}

// Helper functions
function mapPaymentRow(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    standId: row.stand_id as string,
    paymentDate: row.payment_date as string,
    paymentType: row.payment_type as 'DEPOSIT' | 'INSTALLMENT' | 'ADMIN_FEE' | 'LEGAL_FEE',
    description: row.description as string,
    invoiceRef: row.invoice_ref as string | undefined,
    amount: Number(row.amount),
    source: row.source as 'EXCEL_UPLOAD' | 'MANUAL_ENTRY' | 'CASH_PAYMENT',
    sourceId: row.source_id as string | undefined,
    recordedBy: row.recorded_by as string | undefined,
    recordedByName: row.recorded_by_name as string | undefined,
    recordedAt: row.recorded_at as string,
    receiptNumber: row.receipt_number as string | undefined,
    originalSheet: row.original_sheet as string | undefined,
    originalRowIndex: row.original_row_index as number | undefined,
    legacyTransactionId: row.legacy_transaction_id as string | undefined,
    createdAt: row.created_at as string,
  };
}

function mapDeductionRow(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    standId: row.stand_id as string,
    deductionDate: row.deduction_date as string,
    deductionType: row.deduction_type as 'COMMISSION' | 'ADMIN_FEE' | 'AOS' | 'DEVELOPER' | 'REALTOR' | 'LEGAL_FEE',
    description: row.description as string,
    ackRef: row.ack_ref as string | undefined,
    amount: Number(row.amount),
    recipient: row.recipient as string,
    source: row.source as string,
    recordedBy: row.recorded_by as string | undefined,
    recordedByName: row.recorded_by_name as string | undefined,
    recordedAt: row.recorded_at as string,
    originalSheet: row.original_sheet as string | undefined,
    originalRowIndex: row.original_row_index as number | undefined,
    createdAt: row.created_at as string,
  };
}


