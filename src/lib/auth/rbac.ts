// =====================================================
// RBAC (Role-Based Access Control) System
// Lakecity Accounting Suite
// =====================================================

export type UserRole = 'ADMIN' | 'MANAGER' | 'ACCOUNTANT' | 'VIEWER';

export type Permission =
  // Payment permissions
  | 'RECORD_PAYMENT'
  | 'RECORD_CASH_PAYMENT'
  | 'UPLOAD_LEDGER'
  | 'GENERATE_STATEMENT'
  | 'DOWNLOAD_STATEMENT'
  
  // Payout permissions
  | 'REQUEST_PAYOUT'
  | 'APPROVE_PAYOUT'
  | 'REJECT_PAYOUT'
  | 'MARK_PAYOUT_PAID'
  | 'VIEW_ALL_PAYOUTS'
  
  // Estate/Development permissions
  | 'VIEW_ALL_ESTATES'
  | 'VIEW_ASSIGNED_ESTATES'
  | 'MANAGE_ESTATES'
  
  // Stand permissions
  | 'MANAGE_STANDS'
  | 'COMPLETE_STAND'
  | 'TRANSFER_STAND'
  | 'OVERRIDE_TRANSACTION'
  
  // User management
  | 'MANAGE_USERS'
  | 'ASSIGN_PERMISSIONS'
  | 'ASSIGN_ESTATES'
  
  // Reports and audit
  | 'VIEW_AUDIT_LOG'
  | 'EXPORT_REPORTS'
  | 'VIEW_REPORTS'
  
  // System
  | 'CONFIGURE_SYSTEM'
  | 'MANAGE_RECONCILIATIONS';

// Role-based permission mapping
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: [
    'RECORD_PAYMENT',
    'RECORD_CASH_PAYMENT',
    'UPLOAD_LEDGER',
    'GENERATE_STATEMENT',
    'DOWNLOAD_STATEMENT',
    'REQUEST_PAYOUT',
    'APPROVE_PAYOUT',
    'REJECT_PAYOUT',
    'MARK_PAYOUT_PAID',
    'VIEW_ALL_PAYOUTS',
    'VIEW_ALL_ESTATES',
    'VIEW_ASSIGNED_ESTATES',
    'MANAGE_ESTATES',
    'MANAGE_STANDS',
    'COMPLETE_STAND',
    'TRANSFER_STAND',
    'OVERRIDE_TRANSACTION',
    'MANAGE_USERS',
    'ASSIGN_PERMISSIONS',
    'ASSIGN_ESTATES',
    'VIEW_AUDIT_LOG',
    'EXPORT_REPORTS',
    'VIEW_REPORTS',
    'CONFIGURE_SYSTEM',
    'MANAGE_RECONCILIATIONS',
  ],
  MANAGER: [
    'RECORD_PAYMENT',
    'RECORD_CASH_PAYMENT',
    'UPLOAD_LEDGER',
    'GENERATE_STATEMENT',
    'DOWNLOAD_STATEMENT',
    'REQUEST_PAYOUT',
    'APPROVE_PAYOUT',
    'REJECT_PAYOUT',
    'MARK_PAYOUT_PAID',
    'VIEW_ALL_PAYOUTS',
    'VIEW_ALL_ESTATES',
    'MANAGE_STANDS',
    'COMPLETE_STAND',
    'TRANSFER_STAND',
    'OVERRIDE_TRANSACTION',
    'VIEW_AUDIT_LOG',
    'EXPORT_REPORTS',
    'VIEW_REPORTS',
    'MANAGE_RECONCILIATIONS',
  ],
  ACCOUNTANT: [
    'RECORD_PAYMENT',
    'RECORD_CASH_PAYMENT',
    'UPLOAD_LEDGER',
    'GENERATE_STATEMENT',
    'DOWNLOAD_STATEMENT',
    'REQUEST_PAYOUT',
    'MARK_PAYOUT_PAID',
    'VIEW_ASSIGNED_ESTATES',
    'VIEW_REPORTS',
  ],
  VIEWER: [
    'DOWNLOAD_STATEMENT',
    'VIEW_ASSIGNED_ESTATES',
    'VIEW_REPORTS',
  ],
};

// Permission descriptions for UI
export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  RECORD_PAYMENT: 'Record customer payments',
  RECORD_CASH_PAYMENT: 'Record cash payments with receipts',
  UPLOAD_LEDGER: 'Upload and import Excel ledgers',
  GENERATE_STATEMENT: 'Generate customer statements',
  DOWNLOAD_STATEMENT: 'Download statements and reports',
  REQUEST_PAYOUT: 'Request developer payouts',
  APPROVE_PAYOUT: 'Approve pending payouts',
  REJECT_PAYOUT: 'Reject pending payouts',
  MARK_PAYOUT_PAID: 'Mark approved payouts as paid',
  VIEW_ALL_PAYOUTS: 'View all payout requests',
  VIEW_ALL_ESTATES: 'View all estates/developments',
  VIEW_ASSIGNED_ESTATES: 'View only assigned estates',
  MANAGE_ESTATES: 'Create and manage estates',
  MANAGE_STANDS: 'Manage stand records',
  COMPLETE_STAND: 'Mark stands as completed',
  TRANSFER_STAND: 'Transfer stands between clients',
  OVERRIDE_TRANSACTION: 'Override/edit transactions',
  MANAGE_USERS: 'Create and manage users',
  ASSIGN_PERMISSIONS: 'Assign permissions to users',
  ASSIGN_ESTATES: 'Assign estates to accountants',
  VIEW_AUDIT_LOG: 'View audit trail',
  EXPORT_REPORTS: 'Export reports (Excel/PDF)',
  VIEW_REPORTS: 'View reports and analytics',
  CONFIGURE_SYSTEM: 'Configure system settings',
  MANAGE_RECONCILIATIONS: 'Manage monthly reconciliations',
};

// Check if a user has a specific permission
export function hasPermission(
  userRole: UserRole,
  userPermissions: Permission[],
  permission: Permission
): boolean {
  // Check role-based permissions
  const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
  if (rolePermissions.includes(permission)) {
    return true;
  }
  
  // Check explicitly granted permissions
  return userPermissions.includes(permission);
}

// Check if a user has any of the specified permissions
export function hasAnyPermission(
  userRole: UserRole,
  userPermissions: Permission[],
  permissions: Permission[]
): boolean {
  return permissions.some(p => hasPermission(userRole, userPermissions, p));
}

// Check if a user has all of the specified permissions
export function hasAllPermissions(
  userRole: UserRole,
  userPermissions: Permission[],
  permissions: Permission[]
): boolean {
  return permissions.every(p => hasPermission(userRole, userPermissions, p));
}

// Get all permissions for a role
export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

// Payout status workflow
export type PayoutStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';

export const PAYOUT_STATUS_TRANSITIONS: Record<PayoutStatus, PayoutStatus[]> = {
  PENDING: ['APPROVED', 'REJECTED'],
  APPROVED: ['PAID'],
  REJECTED: [],
  PAID: [],
};

export function canTransitionPayoutStatus(
  currentStatus: PayoutStatus,
  newStatus: PayoutStatus
): boolean {
  return PAYOUT_STATUS_TRANSITIONS[currentStatus]?.includes(newStatus) || false;
}

// Payout status labels and colors for UI
export const PAYOUT_STATUS_CONFIG: Record<
  PayoutStatus,
  { label: string; color: string; bgColor: string }
> = {
  PENDING: {
    label: 'Pending Approval',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
  },
  APPROVED: {
    label: 'Approved',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
  },
  REJECTED: {
    label: 'Rejected',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
  },
  PAID: {
    label: 'Paid',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
  },
};

// Payment method options
export type PaymentMethod = 'BANK_TRANSFER' | 'CASH' | 'CHEQUE';

export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CHEQUE', label: 'Cheque' },
];

// Payout types
export type PayoutType = 'INSTALLMENT' | 'COMPLETION' | 'COMMISSION';

export const PAYOUT_TYPE_OPTIONS: { value: PayoutType; label: string }[] = [
  { value: 'INSTALLMENT', label: 'Installment Payment' },
  { value: 'COMPLETION', label: 'Completion Payment' },
  { value: 'COMMISSION', label: 'Commission' },
];
