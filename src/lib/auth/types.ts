// =====================================================
// Auth & RBAC Types
// Lakecity Accounting Suite
// =====================================================

import { Permission, UserRole, PayoutStatus, PaymentMethod, PayoutType } from './rbac';

// ==========================================
// User Types
// ==========================================

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone?: string;
  isActive: boolean;
  lastLoginAt?: string;
  loginAttempts?: number;
  lockedUntil?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserWithPermissions extends User {
  permissions: Permission[];
  assignedDevelopmentIds: string[];
}

export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone?: string;
}

export interface UpdateUserInput {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  phone?: string;
  isActive?: boolean;
}

// ==========================================
// Session Types
// ==========================================

export interface UserSession {
  id: string;
  userId: string;
  token: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: string;
  createdAt: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
  developmentIds: string[];
  iat: number;
  exp: number;
}

// ==========================================
// Developer Payout Types
// ==========================================

export interface DeveloperPayout {
  id: string;
  standId: string;
  developmentId: string;
  developerName: string;
  payoutType: PayoutType;
  amount: number;
  description?: string;
  status: PayoutStatus;
  
  // Request info
  requestedBy: string;
  requestedAt: string;
  requestedByName?: string;
  
  // Approval info
  approvedBy?: string;
  approvedAt?: string;
  approvedByName?: string;
  approvalNotes?: string;
  
  // Payment info
  paidBy?: string;
  paidAt?: string;
  paidByName?: string;
  paymentMethod?: PaymentMethod;
  paymentReference?: string;
  
  // Related deductions
  relatedDeductionIds?: string[];
  
  // Period dates (for tracking payout periods)
  periodStart?: string;
  periodEnd?: string;
  
  // Stand info (joined)
  standNumber?: string;
  developmentName?: string;
  
  // Calculated breakdown
  totalReceived?: number;
  fcCommission?: number;
  fcAdminFees?: number;
  otherDeductions?: number;
  
  createdAt: string;
  updatedAt: string;
}

export interface PayoutApprovalHistory {
  id: string;
  payoutId: string;
  action: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'PAID';
  performedBy: string;
  performedByName?: string;
  performedAt: string;
  notes?: string;
  oldStatus?: PayoutStatus;
  newStatus?: PayoutStatus;
}

export interface RequestPayoutInput {
  standId: string;
  developerName: string;
  amount: number;
  payoutType: PayoutType;
  description?: string;
  relatedDeductionIds?: string[];
  periodStart?: string;
  periodEnd?: string;
}

export interface ApprovePayoutInput {
  approved: boolean;
  notes?: string;
}

export interface MarkPayoutPaidInput {
  paymentMethod: PaymentMethod;
  paymentReference: string;
  paidAt?: string;
}

export interface PayoutSummary {
  payouts: DeveloperPayout[];
  summary: {
    totalPending: number;
    totalApproved: number;
    totalPaid: number;
    pendingAmount: number;
    approvedAmount: number;
    paidAmount: number;
    byDeveloper: { developerName: string; count: number; amount: number }[];
  };
}

export interface PayoutFilters {
  status?: PayoutStatus;
  developer?: string;
  developmentId?: string;
  dateFrom?: string;
  dateTo?: string;
  requestedBy?: string;
}

// ==========================================
// Customer Payment Types
// ==========================================

export type PaymentSource = 'EXCEL_UPLOAD' | 'MANUAL_ENTRY' | 'CASH_PAYMENT';
export type CustomerPaymentType = 'DEPOSIT' | 'INSTALLMENT' | 'ADMIN_FEE' | 'LEGAL_FEE';

export interface CustomerPayment {
  id: string;
  standId: string;
  paymentDate: string;
  paymentType: CustomerPaymentType;
  description: string;
  invoiceRef?: string;
  amount: number;
  source: PaymentSource;
  sourceId?: string;
  recordedBy?: string;
  recordedByName?: string;
  recordedAt: string;
  receiptNumber?: string;
  originalSheet?: string;
  originalRowIndex?: number;
  legacyTransactionId?: string;
  createdAt: string;
}

export interface RecordPaymentInput {
  standId: string;
  paymentDate: string;
  paymentType: CustomerPaymentType;
  description: string;
  amount: number;
  invoiceRef?: string;
}

// ==========================================
// Cash Payment Types
// ==========================================

export interface CashPayment {
  id: string;
  standId: string;
  receiptNumber: string;
  paymentDate: string;
  paymentType: 'DEPOSIT' | 'INSTALLMENT';
  amount: number;
  receivedBy?: string;
  notes?: string;
  recordedBy?: string;
  recordedByName?: string;
  recordedAt: string;
  customerPaymentId?: string;
  createdAt: string;
}

export interface RecordCashPaymentInput {
  standId: string;
  receiptNumber: string;
  paymentDate: string;
  paymentType: 'DEPOSIT' | 'INSTALLMENT';
  amount: number;
  receivedBy?: string;
  notes?: string;
}

// ==========================================
// Deduction Types
// ==========================================

export type DeductionType = 'COMMISSION' | 'ADMIN_FEE' | 'AOS' | 'DEVELOPER' | 'REALTOR' | 'LEGAL_FEE';

export interface Deduction {
  id: string;
  standId: string;
  deductionDate: string;
  deductionType: DeductionType;
  description: string;
  ackRef?: string;
  amount: number;
  recipient: string;
  source: string;
  recordedBy?: string;
  recordedByName?: string;
  recordedAt: string;
  originalSheet?: string;
  originalRowIndex?: number;
  createdAt: string;
}

// ==========================================
// Stand Transfer Types
// ==========================================

export interface StandTransfer {
  id: string;
  standId: string;
  oldClientName?: string;
  oldClientPhone?: string;
  oldClientEmail?: string;
  newClientName: string;
  newClientPhone?: string;
  newClientEmail?: string;
  transferDate: string;
  transferFee: number;
  transferredBy?: string;
  transferredByName?: string;
  notes?: string;
  createdAt: string;
}

export interface TransferStandInput {
  standId: string;
  newClientName: string;
  newClientPhone?: string;
  newClientEmail?: string;
  transferDate: string;
  transferFee?: number;
  notes?: string;
}

// ==========================================
// Stand History Types
// ==========================================

export interface StandSummary {
  id: string;
  standNumber: string;
  developmentName: string;
  developmentId: string;
  agentCode?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  salePrice?: number;
  saleDate?: string;
  paymentTerms?: string;
  totalDeposits: number;
  totalInstallments: number;
  totalCustomerPayments: number;
  totalDeductions: number;
  balance: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface StandHistory {
  stand: StandSummary;
  payments: CustomerPayment[];
  deductions: Deduction[];
  payouts: DeveloperPayout[];
  transfers: StandTransfer[];
  auditTrail: AuditLogEntry[];
}

// ==========================================
// Reconciliation Types
// ==========================================

export type ReconciliationStatus = 'DRAFT' | 'RECONCILED' | 'APPROVED';

export interface Reconciliation {
  id: string;
  developmentId?: string;
  periodStart: string;
  periodEnd: string;
  
  // Opening balances
  openingCustomerPayments: number;
  openingDeductions: number;
  openingBalance: number;
  
  // Period transactions
  periodCustomerPayments: number;
  periodDeductions: number;
  
  // Closing balances
  closingCustomerPayments: number;
  closingDeductions: number;
  closingBalance: number;
  
  // Status
  status: ReconciliationStatus;
  reconciledBy?: string;
  reconciledAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  
  notes?: string;
  createdAt: string;
}

// ==========================================
// Audit Log Types
// ==========================================

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  developmentId?: string;
  standId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  performedBy?: string;
  performedByName?: string;
  performedAt: string;
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
  sessionId?: string;
}

export interface AuditLogFilters {
  action?: string;
  entityType?: string;
  entityId?: string;
  developmentId?: string;
  standId?: string;
  performedBy?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ==========================================
// Report Types
// ==========================================

export interface EstateSummaryReport {
  developmentId: string;
  developmentName: string;
  totalStands: number;
  activeStands: number;
  completedStands: number;
  totalPayments: number;
  totalDeductions: number;
  totalBalance: number;
}

export interface DeveloperPayoutReport {
  developerName: string;
  totalPayouts: number;
  pendingCount: number;
  approvedCount: number;
  paidCount: number;
  pendingAmount: number;
  approvedAmount: number;
  paidAmount: number;
}

export interface AgentPerformanceReport {
  agentCode: string;
  totalStands: number;
  activeStands: number;
  completedStands: number;
  totalPayments: number;
  totalDeductions: number;
  totalBalance: number;
  stands: {
    standNumber: string;
    developmentName: string;
    clientName?: string;
    totalPayments: number;
    balance: number;
    status: string;
  }[];
}

export interface MonthlyReconciliationReport {
  developmentId: string;
  developmentName: string;
  period: { from: string; to: string };
  opening: {
    customerPayments: number;
    deductions: number;
    balance: number;
  };
  periodStats: {
    customerPayments: number;
    deductions: number;
  };
  closing: {
    customerPayments: number;
    deductions: number;
    balance: number;
  };
  paymentDetails: CustomerPayment[];
  deductionDetails: Deduction[];
}

export interface DateRange {
  from: string;
  to: string;
}
