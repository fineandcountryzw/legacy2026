import * as XLSX from 'xlsx';
import { isGroqConfigured, categorizeTransaction, validateTransactions, type CategorizationResult, type ValidationError } from '@/lib/ai/ai-analysis-service';

// ============================================================
// EXTENDED TYPES FOR AI ENHANCEMENT
// ============================================================

export interface AICategorization {
  originalCategory: string;
  suggestedCategory: string;
  confidence: number;
  reasoning: string;
}

export interface AIValidationResult {
  errors: ValidationError[];
  summary: {
    totalErrors: number;
    totalWarnings: number;
    totalInfo: number;
  };
}

export interface LedgerParseResult {
  metadata: {
    filename: string;
    parsedAt: string;
    totalSheets: number;
    totalStands: number;
    totalTransactions: number;
    validationErrors: string[];
    warnings: string[];
    aiAnalysis?: {
      enabled: boolean;
      uncategorizedCount: number;
      validationIssues: number;
    };
  };
  estates: EstateSummary[];
  grandTotals: {
    customerPayments: {
      deposits: number;
      installments: number;
      adminFees: number;
      legalFees: number;
      total: number;
    };
    deductibles: {
      commissions: number;
      adminFees: number;
      aosFees: number;
      developerPayments: {
        lakecity: number;
        highrange: number;
        southlands: number;
        lomlight: number;
        other: number;
      };
      realtorPayments: number;
      legalFees: number;
      total: number;
    };
    balance: number;
  };
  allTransactions: ParsedTransaction[];
  // AI enhancement data
  aiCategorizations?: AICategorization[];
  aiValidation?: AIValidationResult;
}

// ============================================================
// REFACTORED LAKECITY LEDGER PARSER
// LEFT Side = CUSTOMER PAYMENTS (Money IN from clients)
// RIGHT Side = DEDUCTIBLES (Money OUT to vendors/developers)
// ============================================================

// Transaction Categories - Left Side (Customer Payments)
export type CustomerPaymentCategory = 
  | 'CUSTOMER_DEPOSIT'
  | 'CUSTOMER_INSTALLMENT'
  | 'CUSTOMER_ADMIN_FEE'
  | 'CUSTOMER_LEGAL_FEE';

// Transaction Categories - Right Side (Deductibles)
export type DeductibleCategory = 
  | 'DEDUCTION_COMMISSION'
  | 'DEDUCTION_ADMIN_FEE'
  | 'DEDUCTION_AOS'
  | 'DEDUCTION_DEVELOPER'
  | 'DEDUCTION_REALTOR'
  | 'DEDUCTION_LEGAL_FEE';

export type TransactionCategory = CustomerPaymentCategory | DeductibleCategory | 'UNKNOWN';

// Recipient types for deductibles
export type Recipient = 
  | 'Fine & Country'
  | 'AOS'
  | 'Lakecity Developers'
  | 'Highrange Developers'
  | 'Southlands Developers'
  | 'Lomlight Developers'
  | 'Realtor'
  | 'Legal/Lawyer'
  | 'Unknown';

// Parsed Transaction - unified structure
export interface ParsedTransaction {
  sheetName: string;
  standNumber: string;
  agentCode: string;
  rowIndex: number;
  
  // Side identification
  side: 'CUSTOMER_PAYMENT' | 'DEDUCTIBLE';
  
  // Common fields
  date: string;
  description: string;
  reference: string;
  amount: number;
  category: TransactionCategory;
  
  // Deductible-specific fields
  recipient?: Recipient;
}

// Customer Payment (Left Side)
export interface CustomerPayment {
  date: string;
  type: 'DEPOSIT' | 'INSTALLMENT' | 'ADMIN_FEE' | 'LEGAL_FEE';
  description: string;
  invoiceRef: string;
  amount: number;
  category: CustomerPaymentCategory;
}

// Deductible (Right Side)
export interface Deductible {
  date: string;
  type: 'COMMISSION' | 'ADMIN_FEE' | 'AOS' | 'DEVELOPER' | 'REALTOR' | 'LEGAL_FEE';
  description: string;
  ackRef: string;
  amount: number;
  category: DeductibleCategory;
  recipient: Recipient;
}

// Stand Summary with separated sides
export interface StandSummary {
  sheetName: string;
  standNumber: string;
  agentCode: string;
  
  // LEFT SIDE - Customer Payments
  customerPayments: {
    deposits: number;
    installments: number;
    adminFees: number;
    legalFees: number;
    total: number;
    transactions: ParsedTransaction[];
  };
  
  // RIGHT SIDE - Deductibles
  deductibles: {
    commissions: number;
    adminFees: number;
    aosFees: number;
    developerPayments: {
      lakecity: number;
      highrange: number;
      southlands: number;
      lomlight: number;
      other: number;
    };
    realtorPayments: number;
    legalFees: number;
    total: number;
    transactions: ParsedTransaction[];
  };
  
  // Balance calculation
  balance: number; // customerPayments.total - deductibles.total
}

export interface EstateSummary {
  sheetName: string;
  stands: StandSummary[];
}

// ============================================================
// STAND DETECTION

function detectStand(row: any[]): { standNumber: string; agentCode: string } | null {
  // Check column 1 (B) for stand header
  const cellB = row[1]?.toString().trim() || '';
  
  // Pattern: "Stand number XXXX" or "Stand number  XXXX" (double space)
  const standMatch = cellB.match(/Stand\s+number\s+(\d+)/i);
  if (standMatch) {
    const agentCode = row[9]?.toString().trim() || ''; // Column J
    return { standNumber: standMatch[1], agentCode };
  }
  
  // Pattern: "Cluster stand XX"
  const clusterMatch = cellB.match(/Cluster\s+stand\s+(\d+)/i);
  if (clusterMatch) {
    const agentCode = row[9]?.toString().trim() || '';
    return { standNumber: clusterMatch[1], agentCode };
  }
  
  return null;
}

// ============================================================
// DATE PARSING
// ============================================================

function parseDate(value: any): string | null {
  if (!value) return null;
  
  // Handle Excel date serial numbers
  if (typeof value === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + (value - 2) * 24 * 60 * 60 * 1000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    return null;
  }
  
  const str = value.toString().trim();
  
  // Pattern: DD.MM.YYYY
  let match = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  
  // Pattern: DD.MM.YY
  match = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2})$/);
  if (match) {
    const [, d, m, y] = match;
    const year = parseInt(y) < 50 ? `20${y}` : `19${y}`;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  
  // Handle typos like "325.08.2025" -> "25.08.2025"
  match = str.match(/^(\d{3})\.(\d{2})\.(\d{4})$/);
  if (match) {
    const day = match[1].slice(-2);
    return `${match[3]}-${match[2]}-${day}`;
  }
  
  return null;
}

// ============================================================
// AMOUNT PARSING
// ============================================================

function parseAmount(value: any): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  
  const str = value.toString()
    .replace(/\$/g, '')
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .trim();
  
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

// ============================================================
// LEFT SIDE - CUSTOMER PAYMENT DETECTION & CATEGORIZATION
// ============================================================

function isCustomerPayment(description: string): boolean {
  if (!description) return false;
  const desc = description.toLowerCase().trim();
  
  return desc.includes('deposit') ||
         desc.includes('installment') ||
         desc.includes('installments') ||
         desc.includes('montly') || // handle typo
         (desc.includes('administration') && desc.includes('f&c')) || // client paying F&C
         (desc.includes('legal') && !desc.includes('developer')); // client paying legal
}

function categorizeCustomerPayment(description: string): { category: CustomerPaymentCategory; type: CustomerPayment['type'] } {
  const desc = description.toLowerCase().trim();
  
  if (desc.includes('deposit')) {
    return { category: 'CUSTOMER_DEPOSIT', type: 'DEPOSIT' };
  }
  
  if (desc.includes('installment') || desc.includes('installments') || desc.includes('montly')) {
    return { category: 'CUSTOMER_INSTALLMENT', type: 'INSTALLMENT' };
  }
  
  if (desc.includes('administration') && desc.includes('f&c')) {
    return { category: 'CUSTOMER_ADMIN_FEE', type: 'ADMIN_FEE' };
  }
  
  if (desc.includes('legal')) {
    return { category: 'CUSTOMER_LEGAL_FEE', type: 'LEGAL_FEE' };
  }
  
  // Default fallback
  return { category: 'CUSTOMER_INSTALLMENT', type: 'INSTALLMENT' };
}

// ============================================================
// RIGHT SIDE - DEDUCTIBLE DETECTION & CATEGORIZATION
// ============================================================

function isDeductible(description: string): boolean {
  if (!description) return false;
  const desc = description.toLowerCase().trim();
  
  return desc.includes('commission') ||
         (desc.includes('administration') && desc.includes('f&c')) ||
         desc.includes('aos') ||
         desc.includes('developers') ||
         desc.includes('realtor') ||
         (desc.includes('legal') && desc.includes('fee'));
}

function categorizeDeductible(description: string): { category: DeductibleCategory; type: Deductible['type']; recipient: Recipient } {
  const desc = description.toLowerCase().trim();
  
  // COMMISSION - always F&C
  if (desc.includes('commission')) {
    return { 
      category: 'DEDUCTION_COMMISSION', 
      type: 'COMMISSION', 
      recipient: 'Fine & Country' 
    };
  }
  
  // AOS FEE
  if (desc.includes('aos') && !desc.includes('developer')) {
    return { 
      category: 'DEDUCTION_AOS', 
      type: 'AOS', 
      recipient: 'AOS' 
    };
  }
  
  // REALTOR
  if (desc.includes('realtor')) {
    return { 
      category: 'DEDUCTION_REALTOR', 
      type: 'REALTOR', 
      recipient: 'Realtor' 
    };
  }
  
  // LEGAL FEE (on right side = deductible) - check before developer
  if (desc.includes('legal') || desc.includes('lawyer') || desc.includes('attorney')) {
    return { 
      category: 'DEDUCTION_LEGAL_FEE', 
      type: 'LEGAL_FEE', 
      recipient: 'Legal/Lawyer' 
    };
  }
  
  // DEVELOPER PAYMENTS
  if (desc.includes('developers') || desc.includes('developer')) {
    const recipient = extractDeveloperRecipient(description);
    return { 
      category: 'DEDUCTION_DEVELOPER', 
      type: 'DEVELOPER', 
      recipient 
    };
  }
  
  // AOS + DEVELOPER combo
  if (desc.includes('aos') && desc.includes('developer')) {
    const recipient = extractDeveloperRecipient(description);
    return { 
      category: 'DEDUCTION_DEVELOPER', 
      type: 'DEVELOPER', 
      recipient 
    };
  }
  
  // ADMIN FEE (F&C)
  if (desc.includes('administration') && desc.includes('f&c')) {
    return { 
      category: 'DEDUCTION_ADMIN_FEE', 
      type: 'ADMIN_FEE', 
      recipient: 'Fine & Country' 
    };
  }
  
  // Default fallback
  return { 
    category: 'DEDUCTION_ADMIN_FEE', 
    type: 'ADMIN_FEE', 
    recipient: 'Unknown' 
  };
}

function extractDeveloperRecipient(description: string): Recipient {
  const desc = description.toLowerCase();
  
  if (desc.includes('lakecity')) return 'Lakecity Developers';
  if (desc.includes('highrange')) return 'Highrange Developers';
  if (desc.includes('southlands')) return 'Southlands Developers';
  if (desc.includes('lomlight')) return 'Lomlight Developers';
  if (desc.includes('realtor')) return 'Realtor';
  
  return 'Unknown';
}

// ============================================================
// ROW PARSING
// ============================================================

function parseRow(
  row: any[], 
  rowIndex: number,
  sheetName: string, 
  currentStand: string, 
  currentAgent: string
): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  
  // === PARSE LEFT SIDE (Customer Payments - Columns B-E) ===
  // B=Date(1), C=Description(2), D=Ref(3), E=Amount(4)
  const leftDate = parseDate(row[1]);
  const leftDesc = row[2]?.toString().trim() || '';
  const leftRef = row[3]?.toString().trim() || '';
  const leftAmount = parseAmount(row[4]);
  
  if (leftDate && leftAmount > 0 && isCustomerPayment(leftDesc)) {
    const { category, type } = categorizeCustomerPayment(leftDesc);
    
    transactions.push({
      sheetName,
      standNumber: currentStand,
      agentCode: currentAgent,
      rowIndex,
      side: 'CUSTOMER_PAYMENT',
      date: leftDate,
      description: leftDesc,
      reference: leftRef,
      amount: leftAmount,
      category
    });
  }
  
  // === PARSE RIGHT SIDE (Deductibles - Columns F-I) ===
  // F=Date(5), G=Description(6), H=Ref(7), I=Amount(8)
  const rightDate = parseDate(row[5]) || leftDate; // Use left date if right is empty
  const rightDesc = row[6]?.toString().trim() || '';
  const rightRef = row[7]?.toString().trim() || '';
  const rightAmount = parseAmount(row[8]);
  
  if (rightDate && rightAmount > 0 && isDeductible(rightDesc)) {
    const { category, type, recipient } = categorizeDeductible(rightDesc);
    
    transactions.push({
      sheetName,
      standNumber: currentStand,
      agentCode: currentAgent,
      rowIndex,
      side: 'DEDUCTIBLE',
      date: rightDate,
      description: rightDesc,
      reference: rightRef,
      amount: rightAmount,
      category,
      recipient
    });
  }
  
  return transactions;
}

// ============================================================
// HEADER DETECTION
// ============================================================

function isHeaderRow(row: any[]): boolean {
  const rowText = row.slice(0, 8).join(' ').toLowerCase();
  return rowText.includes('date') && 
         (rowText.includes('description') || rowText.includes('particulars')) &&
         rowText.includes('amount');
}

function isBalanceRow(row: any[]): boolean {
  const descB = row[2]?.toString().toLowerCase() || '';
  const descG = row[6]?.toString().toLowerCase() || '';
  return descB.includes('balance') || 
         descG.includes('balance') ||
         descB.includes('brought forward') ||
         descG.includes('brought forward') ||
         descB.includes('carried down') ||
         descG.includes('carried down');
}

// ============================================================
// SHEET PARSING
// ============================================================

function parseSheet(sheet: XLSX.WorkSheet, sheetName: string, warnings: string[]): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  
  // Convert sheet to array of arrays
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { 
    header: 1,
    defval: '',
    blankrows: false
  });
  
  let currentStand: string | null = null;
  let currentAgent: string = '';
  let headerRowFound = false;
  
  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    
    // STEP 1: Detect Stand Number
    const standInfo = detectStand(row);
    if (standInfo) {
      currentStand = standInfo.standNumber;
      currentAgent = standInfo.agentCode;
      headerRowFound = false;
      continue;
    }
    
    // STEP 2: Detect Header Row
    if (isHeaderRow(row)) {
      headerRowFound = true;
      continue;
    }
    
    // Skip if no stand context or before headers
    if (!currentStand || !headerRowFound) continue;
    
    // Skip balance/total rows
    if (isBalanceRow(row)) continue;
    
    // STEP 3: Parse row for transactions
    const rowTransactions = parseRow(row, rowIdx, sheetName, currentStand, currentAgent);
    transactions.push(...rowTransactions);
    
    // Warn if amounts found but not categorized
    const leftAmount = parseAmount(row[4]);
    const rightAmount = parseAmount(row[8]);
    const leftDesc = row[2]?.toString().trim() || '';
    const rightDesc = row[6]?.toString().trim() || '';
    
    if (leftAmount > 0 && leftDesc && !isCustomerPayment(leftDesc)) {
      warnings.push(`Row ${rowIdx + 1}: LEFT amount $${leftAmount} with unrecognized description "${leftDesc}"`);
    }
    
    if (rightAmount > 0 && rightDesc && !isDeductible(rightDesc)) {
      warnings.push(`Row ${rowIdx + 1}: RIGHT amount $${rightAmount} with unrecognized description "${rightDesc}"`);
    }
  }
  
  return transactions;
}

// ============================================================
// AGGREGATION
// ============================================================

function aggregateByStand(transactions: ParsedTransaction[]): StandSummary[] {
  const grouped = new Map<string, ParsedTransaction[]>();
  
  for (const tx of transactions) {
    const key = `${tx.sheetName}-${tx.standNumber}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(tx);
  }
  
  return Array.from(grouped.entries()).map(([key, txs]) => {
    const customerTxs = txs.filter(t => t.side === 'CUSTOMER_PAYMENT');
    const deductibleTxs = txs.filter(t => t.side === 'DEDUCTIBLE');
    
    const customerTotal = customerTxs.reduce((sum, t) => sum + t.amount, 0);
    const deductibleTotal = deductibleTxs.reduce((sum, t) => sum + t.amount, 0);
    
    return {
      sheetName: txs[0].sheetName,
      standNumber: txs[0].standNumber,
      agentCode: txs[0].agentCode,
      
      customerPayments: {
        deposits: customerTxs.filter(t => t.category === 'CUSTOMER_DEPOSIT').reduce((sum, t) => sum + t.amount, 0),
        installments: customerTxs.filter(t => t.category === 'CUSTOMER_INSTALLMENT').reduce((sum, t) => sum + t.amount, 0),
        adminFees: customerTxs.filter(t => t.category === 'CUSTOMER_ADMIN_FEE').reduce((sum, t) => sum + t.amount, 0),
        legalFees: customerTxs.filter(t => t.category === 'CUSTOMER_LEGAL_FEE').reduce((sum, t) => sum + t.amount, 0),
        total: customerTotal,
        transactions: customerTxs
      },
      
      deductibles: {
        commissions: deductibleTxs.filter(t => t.category === 'DEDUCTION_COMMISSION').reduce((sum, t) => sum + t.amount, 0),
        adminFees: deductibleTxs.filter(t => t.category === 'DEDUCTION_ADMIN_FEE').reduce((sum, t) => sum + t.amount, 0),
        aosFees: deductibleTxs.filter(t => t.category === 'DEDUCTION_AOS').reduce((sum, t) => sum + t.amount, 0),
        developerPayments: {
          lakecity: deductibleTxs.filter(t => t.recipient === 'Lakecity Developers').reduce((sum, t) => sum + t.amount, 0),
          highrange: deductibleTxs.filter(t => t.recipient === 'Highrange Developers').reduce((sum, t) => sum + t.amount, 0),
          southlands: deductibleTxs.filter(t => t.recipient === 'Southlands Developers').reduce((sum, t) => sum + t.amount, 0),
          lomlight: deductibleTxs.filter(t => t.recipient === 'Lomlight Developers').reduce((sum, t) => sum + t.amount, 0),
          other: deductibleTxs.filter(t => 
            t.category === 'DEDUCTION_DEVELOPER' && 
            !['Lakecity Developers', 'Highrange Developers', 'Southlands Developers', 'Lomlight Developers'].includes(t.recipient || '')
          ).reduce((sum, t) => sum + t.amount, 0),
        },
        realtorPayments: deductibleTxs.filter(t => t.category === 'DEDUCTION_REALTOR').reduce((sum, t) => sum + t.amount, 0),
        legalFees: deductibleTxs.filter(t => t.category === 'DEDUCTION_LEGAL_FEE').reduce((sum, t) => sum + t.amount, 0),
        total: deductibleTotal,
        transactions: deductibleTxs
      },
      
      balance: customerTotal - deductibleTotal
    };
  });
}

// ============================================================
// MAIN PARSER
// ============================================================

export function parseLedgerFile(buffer: ArrayBuffer, filename: string): LedgerParseResult {
  const warnings: string[] = [];
  
  const result: LedgerParseResult = {
    metadata: {
      filename,
      parsedAt: new Date().toISOString(),
      totalSheets: 0,
      totalStands: 0,
      totalTransactions: 0,
      validationErrors: [],
      warnings
    },
    estates: [],
    grandTotals: {
      customerPayments: {
        deposits: 0,
        installments: 0,
        adminFees: 0,
        legalFees: 0,
        total: 0
      },
      deductibles: {
        commissions: 0,
        adminFees: 0,
        aosFees: 0,
        developerPayments: {
          lakecity: 0,
          highrange: 0,
          southlands: 0,
          lomlight: 0,
          other: 0
        },
        realtorPayments: 0,
        legalFees: 0,
        total: 0
      },
      balance: 0
    },
    allTransactions: []
  };
  
  try {
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
    result.metadata.totalSheets = workbook.SheetNames.length;
    
    // Parse each sheet
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const transactions = parseSheet(sheet, sheetName, warnings);
      
      if (transactions.length > 0) {
        const stands = aggregateByStand(transactions);
        result.estates.push({ sheetName, stands });
        result.allTransactions.push(...transactions);
      }
    }
    
    // Calculate metadata
    result.metadata.totalStands = result.estates.reduce((sum, e) => sum + e.stands.length, 0);
    result.metadata.totalTransactions = result.allTransactions.length;
    
    // Calculate grand totals
    for (const estate of result.estates) {
      for (const stand of estate.stands) {
        // Customer payments
        result.grandTotals.customerPayments.deposits += stand.customerPayments.deposits;
        result.grandTotals.customerPayments.installments += stand.customerPayments.installments;
        result.grandTotals.customerPayments.adminFees += stand.customerPayments.adminFees;
        result.grandTotals.customerPayments.legalFees += stand.customerPayments.legalFees;
        result.grandTotals.customerPayments.total += stand.customerPayments.total;
        
        // Deductibles
        result.grandTotals.deductibles.commissions += stand.deductibles.commissions;
        result.grandTotals.deductibles.adminFees += stand.deductibles.adminFees;
        result.grandTotals.deductibles.aosFees += stand.deductibles.aosFees;
        result.grandTotals.deductibles.developerPayments.lakecity += stand.deductibles.developerPayments.lakecity;
        result.grandTotals.deductibles.developerPayments.highrange += stand.deductibles.developerPayments.highrange;
        result.grandTotals.deductibles.developerPayments.southlands += stand.deductibles.developerPayments.southlands;
        result.grandTotals.deductibles.developerPayments.lomlight += stand.deductibles.developerPayments.lomlight;
        result.grandTotals.deductibles.developerPayments.other += stand.deductibles.developerPayments.other;
        result.grandTotals.deductibles.realtorPayments += stand.deductibles.realtorPayments;
        result.grandTotals.deductibles.legalFees += stand.deductibles.legalFees;
        result.grandTotals.deductibles.total += stand.deductibles.total;
        
        // Balance
        result.grandTotals.balance += stand.balance;
      }
    }
    
    // Round all numbers to 2 decimal places
    const round2 = (n: number) => Math.round(n * 100) / 100;
    
    result.grandTotals.customerPayments.deposits = round2(result.grandTotals.customerPayments.deposits);
    result.grandTotals.customerPayments.installments = round2(result.grandTotals.customerPayments.installments);
    result.grandTotals.customerPayments.adminFees = round2(result.grandTotals.customerPayments.adminFees);
    result.grandTotals.customerPayments.legalFees = round2(result.grandTotals.customerPayments.legalFees);
    result.grandTotals.customerPayments.total = round2(result.grandTotals.customerPayments.total);
    
    result.grandTotals.deductibles.commissions = round2(result.grandTotals.deductibles.commissions);
    result.grandTotals.deductibles.adminFees = round2(result.grandTotals.deductibles.adminFees);
    result.grandTotals.deductibles.aosFees = round2(result.grandTotals.deductibles.aosFees);
    result.grandTotals.deductibles.developerPayments.lakecity = round2(result.grandTotals.deductibles.developerPayments.lakecity);
    result.grandTotals.deductibles.developerPayments.highrange = round2(result.grandTotals.deductibles.developerPayments.highrange);
    result.grandTotals.deductibles.developerPayments.southlands = round2(result.grandTotals.deductibles.developerPayments.southlands);
    result.grandTotals.deductibles.developerPayments.lomlight = round2(result.grandTotals.deductibles.developerPayments.lomlight);
    result.grandTotals.deductibles.developerPayments.other = round2(result.grandTotals.deductibles.developerPayments.other);
    result.grandTotals.deductibles.realtorPayments = round2(result.grandTotals.deductibles.realtorPayments);
    result.grandTotals.deductibles.legalFees = round2(result.grandTotals.deductibles.legalFees);
    result.grandTotals.deductibles.total = round2(result.grandTotals.deductibles.total);
    result.grandTotals.balance = round2(result.grandTotals.balance);
    
    // Validation
    if (result.metadata.totalStands === 0) {
      result.metadata.validationErrors.push('No stands detected. Check file format.');
    }
    
    if (result.allTransactions.length === 0) {
      result.metadata.validationErrors.push('No transactions found. Check column mapping.');
    }
    
  } catch (error) {
    result.metadata.validationErrors.push(`Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return result;
}

// ============================================================
// EXPORT FUNCTIONS
// ============================================================

export function exportToJson(result: LedgerParseResult): string {
  return JSON.stringify(result, null, 2);
}

export function exportToCsv(result: LedgerParseResult): string {
  const headers = [
    'Sheet', 'Stand Number', 'Agent', 'Side', 'Date', 'Description', 'Ref', 
    'Category', 'Recipient', 'Amount'
  ];
  
  const rows: string[] = [headers.join(',')];
  
  for (const tx of result.allTransactions) {
    rows.push([
      tx.sheetName,
      tx.standNumber,
      tx.agentCode,
      tx.side,
      tx.date || '',
      `"${tx.description.replace(/"/g, '""')}"`,
      tx.reference,
      tx.category,
      tx.recipient || '',
      tx.amount
    ].join(','));
  }
  
  return rows.join('\n');
}

// ============================================================
// VALIDATION HELPERS
// ============================================================

export function validateStandBalance(stand: StandSummary): { valid: boolean; difference: number } {
  const expectedBalance = stand.customerPayments.total - stand.deductibles.total;
  const difference = Math.abs(stand.balance - expectedBalance);
  return {
    valid: difference < 0.01, // Allow for rounding errors
    difference
  };
}

export function findUnmatchedDescriptions(result: LedgerParseResult): { left: string[]; right: string[] } {
  const left = new Set<string>();
  const right = new Set<string>();
  
  for (const tx of result.allTransactions) {
    if (tx.category === 'UNKNOWN') {
      if (tx.side === 'CUSTOMER_PAYMENT') {
        left.add(tx.description);
      } else {
        right.add(tx.description);
      }
    }
  }
  
  return {
    left: Array.from(left),
    right: Array.from(right)
  };
}
