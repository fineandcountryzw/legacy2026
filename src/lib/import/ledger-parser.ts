import * as XLSX from 'xlsx';

// Types based on actual file structure
export interface ParsedTransaction {
  sheetName: string;
  standNumber: string;
  agentCode: string;
  date: string | null;
  description: string;
  reference: string;
  amount: number;
  category: TransactionCategory;
  developerName?: string;
  side: 'RECEIPT' | 'PAYMENT';
  rawRowIndex: number;
}

export type TransactionCategory = 
  | 'CLIENT_DEPOSIT'
  | 'CLIENT_INSTALLMENT'
  | 'FC_ADMIN_FEE'
  | 'FC_COMMISSION'
  | 'DEVELOPER_PAYMENT'
  | 'REALTOR_PAYMENT'
  | 'LEGAL_FEE'
  | 'AOS_FEE'
  | 'UNKNOWN';

export interface StandSummary {
  sheetName: string;
  standNumber: string;
  agentCode: string;
  clientDeposits: number;
  clientInstallments: number;
  totalReceipts: number;
  fcCommissions: number;
  fcAdminFees: number;
  developerPayments: {
    lakecity: number;
    highrange: number;
    southlands: number;
    lomlight: number;
    other: number;
  };
  realtorPayments: number;
  legalFees: number;
  aosFees: number;
  totalPayments: number;
  balanceCarriedDown: number;
  transactions: ParsedTransaction[];
}

export interface EstateSummary {
  sheetName: string;
  stands: StandSummary[];
}

export interface LedgerParseResult {
  metadata: {
    filename: string;
    parsedAt: string;
    totalSheets: number;
    totalStands: number;
    totalTransactions: number;
    validationErrors: string[];
  };
  estates: EstateSummary[];
  grandTotals: {
    clientDeposits: number;
    clientInstallments: number;
    totalReceipts: number;
    fcCommissions: number;
    fcAdminFees: number;
    developerPayments: {
      lakecity: number;
      highrange: number;
      southlands: number;
      lomlight: number;
      other: number;
    };
    realtorPayments: number;
    legalFees: number;
    aosFees: number;
    totalPayments: number;
    balanceCarriedDown: number;
  };
  allTransactions: ParsedTransaction[];
}

// Detect stand number from row (checking column B/index 1 primarily)
function detectStandNumber(row: any[]): string | null {
  // Check column 1 (B) first - "Stand number XXXX" or "Cluster stand XX"
  const cellB = row[1]?.toString().trim() || '';
  
  // Pattern 1: "Stand number XXXX" (with possible double/multiple spaces)
  let match = cellB.match(/Stand\s+number\s+(\d+)/i);
  if (match) return match[1];
  
  // Pattern 2: "Cluster stand XX"
  match = cellB.match(/Cluster\s+stand\s+(\d+)/i);
  if (match) return match[1];
  
  // Pattern 3: Just a number in column B that looks like a stand number (3-4 digits)
  const numMatch = cellB.match(/^(\d{3,4})$/);
  if (numMatch) return numMatch[1];
  
  // Pattern 4: Check column 0 (A) for stand number
  const cellA = row[0]?.toString().trim() || '';
  match = cellA.match(/Stand\s+number\s+(\d+)/i);
  if (match) return match[1];
  
  return null;
}

// Detect agent code from last columns
function detectAgentCode(row: any[]): string {
  // Look at last few columns for agent code (2-6 letter uppercase, or "Kobie")
  for (let i = row.length - 1; i >= Math.max(0, row.length - 4); i--) {
    const val = row[i]?.toString().trim() || '';
    // Match patterns like KCM, RJ, PM, KK, KB, Kobie
    if (/^[A-Z][a-z]+$/i.test(val) && val.length >= 2 && val.length <= 6) {
      return val.toUpperCase();
    }
  }
  return '';
}

// Parse date with typo handling
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

// Parse amount with currency handling
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

// Detect developer from description
function detectDeveloper(description: string): { name: string | null; isAOS: boolean } {
  const desc = description.toLowerCase();
  const isAOS = desc.includes('aos');
  
  if (desc.includes('lakecity')) return { name: 'LAKECITY', isAOS };
  if (desc.includes('highrange')) return { name: 'HIGHRANGE', isAOS };
  if (desc.includes('southlands')) return { name: 'SOUTHLANDS', isAOS };
  if (desc.includes('lomlight')) return { name: 'LOMLIGHT', isAOS };
  
  // Extract any word before "developers"
  const match = description.match(/(\w+)\s+developers/i);
  if (match && !desc.includes('realtor')) {
    return { name: match[1].toUpperCase(), isAOS };
  }
  
  return { name: null, isAOS };
}

// Categorize receipt (left side)
function categorizeReceipt(description: string): TransactionCategory {
  const desc = description.toLowerCase();
  
  if (desc.includes('deposit')) return 'CLIENT_DEPOSIT';
  if (desc.includes('installment') || desc.includes('installments') || desc.includes('montly')) {
    return 'CLIENT_INSTALLMENT';
  }
  if (desc.includes('administration') && desc.includes('f&c')) return 'FC_ADMIN_FEE';
  if (desc.includes('legal')) return 'LEGAL_FEE';
  if (desc.includes('aos')) return 'AOS_FEE';
  
  return 'UNKNOWN';
}

// Categorize payment (right side)
function categorizePayment(description: string): TransactionCategory {
  const desc = description.toLowerCase();
  
  if (desc.includes('commission') && desc.includes('f&c')) return 'FC_COMMISSION';
  if (desc.includes('administration') && desc.includes('f&c')) return 'FC_ADMIN_FEE';
  if (desc.includes('realtor')) return 'REALTOR_PAYMENT';
  if (desc.includes('developers') || desc.includes('lakecity') || 
      desc.includes('highrange') || desc.includes('southlands') || 
      desc.includes('lomlight')) return 'DEVELOPER_PAYMENT';
  if (desc.includes('legal')) return 'LEGAL_FEE';
  if (desc.includes('aos')) return 'AOS_FEE';
  
  return 'UNKNOWN';
}

// Check if row is a header row
function isHeaderRow(row: any[]): boolean {
  const rowText = row.slice(0, 8).join(' ').toLowerCase();
  return rowText.includes('date') && 
         (rowText.includes('description') || rowText.includes('particulars')) &&
         rowText.includes('amount');
}

// Parse a single sheet
function parseSheet(sheet: XLSX.WorkSheet, sheetName: string): ParsedTransaction[] {
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
    const standNum = detectStandNumber(row);
    if (standNum) {
      currentStand = standNum;
      currentAgent = detectAgentCode(row);
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
    
    // Skip balance rows
    const descB = row[2]?.toString().toLowerCase() || '';
    const descG = row[6]?.toString().toLowerCase() || '';
    if (descB.includes('balance') || descG.includes('balance')) continue;
    
    // STEP 3: Parse Receipts (Left Side - columns 1-4: B, C, D, E)
    const leftDate = parseDate(row[1]);
    const leftDesc = row[2]?.toString().trim() || '';
    const leftRef = row[3]?.toString().trim() || '';
    const leftAmount = parseAmount(row[4]);
    
    if (leftDate && leftDesc && leftAmount > 0) {
      const category = categorizeReceipt(leftDesc);
      transactions.push({
        sheetName,
        standNumber: currentStand,
        agentCode: currentAgent,
        date: leftDate,
        description: leftDesc,
        reference: leftRef || '',
        amount: leftAmount,
        category,
        side: 'RECEIPT',
        rawRowIndex: rowIdx
      });
    }
    
    // STEP 4: Parse Payments (Right Side - columns 5-8: F, G, H, I)
    const rightDate = parseDate(row[5]) || leftDate; // Use left date if right is empty
    const rightDesc = row[6]?.toString().trim() || '';
    const rightRef = row[7]?.toString().trim() || '';
    const rightAmount = parseAmount(row[8]);
    
    if (rightDesc && rightAmount > 0 && rightDesc !== leftDesc) {
      const category = categorizePayment(rightDesc);
      const { name: developerName } = detectDeveloper(rightDesc);
      
      transactions.push({
        sheetName,
        standNumber: currentStand,
        agentCode: currentAgent,
        date: rightDate,
        description: rightDesc,
        reference: rightRef || '',
        amount: rightAmount,
        category,
        developerName: developerName || undefined,
        side: 'PAYMENT',
        rawRowIndex: rowIdx
      });
    }
  }
  
  return transactions;
}

// Aggregate transactions by stand
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
    const receipts = txs.filter(t => t.side === 'RECEIPT');
    const payments = txs.filter(t => t.side === 'PAYMENT');
    
    const totalReceipts = receipts.reduce((sum, t) => sum + t.amount, 0);
    const totalPayments = payments.reduce((sum, t) => sum + t.amount, 0);
    
    return {
      sheetName: txs[0].sheetName,
      standNumber: txs[0].standNumber,
      agentCode: txs[0].agentCode,
      
      clientDeposits: receipts.filter(t => t.category === 'CLIENT_DEPOSIT').reduce((sum, t) => sum + t.amount, 0),
      clientInstallments: receipts.filter(t => t.category === 'CLIENT_INSTALLMENT').reduce((sum, t) => sum + t.amount, 0),
      totalReceipts,
      
      fcCommissions: payments.filter(t => t.category === 'FC_COMMISSION').reduce((sum, t) => sum + t.amount, 0),
      fcAdminFees: payments.filter(t => t.category === 'FC_ADMIN_FEE').reduce((sum, t) => sum + t.amount, 0),
      developerPayments: {
        lakecity: payments.filter(t => t.developerName === 'LAKECITY').reduce((sum, t) => sum + t.amount, 0),
        highrange: payments.filter(t => t.developerName === 'HIGHRANGE').reduce((sum, t) => sum + t.amount, 0),
        southlands: payments.filter(t => t.developerName === 'SOUTHLANDS').reduce((sum, t) => sum + t.amount, 0),
        lomlight: payments.filter(t => t.developerName === 'LOMLIGHT').reduce((sum, t) => sum + t.amount, 0),
        other: payments.filter(t => t.category === 'DEVELOPER_PAYMENT' && 
          !['LAKECITY', 'HIGHRANGE', 'SOUTHLANDS', 'LOMLIGHT'].includes(t.developerName || '')).reduce((sum, t) => sum + t.amount, 0),
      },
      realtorPayments: payments.filter(t => t.category === 'REALTOR_PAYMENT').reduce((sum, t) => sum + t.amount, 0),
      legalFees: [...receipts, ...payments].filter(t => t.category === 'LEGAL_FEE').reduce((sum, t) => sum + t.amount, 0),
      aosFees: [...receipts, ...payments].filter(t => t.category === 'AOS_FEE').reduce((sum, t) => sum + t.amount, 0),
      totalPayments,
      balanceCarriedDown: totalReceipts - totalPayments,
      transactions: txs
    };
  });
}

// Main parser function
export function parseLedgerFile(buffer: ArrayBuffer, filename: string): LedgerParseResult {
  const result: LedgerParseResult = {
    metadata: {
      filename,
      parsedAt: new Date().toISOString(),
      totalSheets: 0,
      totalStands: 0,
      totalTransactions: 0,
      validationErrors: []
    },
    estates: [],
    grandTotals: {
      clientDeposits: 0,
      clientInstallments: 0,
      totalReceipts: 0,
      fcCommissions: 0,
      fcAdminFees: 0,
      developerPayments: {
        lakecity: 0,
        highrange: 0,
        southlands: 0,
        lomlight: 0,
        other: 0
      },
      realtorPayments: 0,
      legalFees: 0,
      aosFees: 0,
      totalPayments: 0,
      balanceCarriedDown: 0
    },
    allTransactions: []
  };
  
  try {
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
    result.metadata.totalSheets = workbook.SheetNames.length;
    
    // Parse each sheet
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const transactions = parseSheet(sheet, sheetName);
      
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
        result.grandTotals.clientDeposits += stand.clientDeposits;
        result.grandTotals.clientInstallments += stand.clientInstallments;
        result.grandTotals.totalReceipts += stand.totalReceipts;
        result.grandTotals.fcCommissions += stand.fcCommissions;
        result.grandTotals.fcAdminFees += stand.fcAdminFees;
        result.grandTotals.developerPayments.lakecity += stand.developerPayments.lakecity;
        result.grandTotals.developerPayments.highrange += stand.developerPayments.highrange;
        result.grandTotals.developerPayments.southlands += stand.developerPayments.southlands;
        result.grandTotals.developerPayments.lomlight += stand.developerPayments.lomlight;
        result.grandTotals.developerPayments.other += stand.developerPayments.other;
        result.grandTotals.realtorPayments += stand.realtorPayments;
        result.grandTotals.legalFees += stand.legalFees;
        result.grandTotals.aosFees += stand.aosFees;
        result.grandTotals.totalPayments += stand.totalPayments;
        result.grandTotals.balanceCarriedDown += stand.balanceCarriedDown;
      }
    }
    
    // Round all numbers
    result.grandTotals.clientDeposits = Math.round(result.grandTotals.clientDeposits * 100) / 100;
    result.grandTotals.clientInstallments = Math.round(result.grandTotals.clientInstallments * 100) / 100;
    result.grandTotals.totalReceipts = Math.round(result.grandTotals.totalReceipts * 100) / 100;
    result.grandTotals.fcCommissions = Math.round(result.grandTotals.fcCommissions * 100) / 100;
    result.grandTotals.fcAdminFees = Math.round(result.grandTotals.fcAdminFees * 100) / 100;
    result.grandTotals.developerPayments.lakecity = Math.round(result.grandTotals.developerPayments.lakecity * 100) / 100;
    result.grandTotals.developerPayments.highrange = Math.round(result.grandTotals.developerPayments.highrange * 100) / 100;
    result.grandTotals.developerPayments.southlands = Math.round(result.grandTotals.developerPayments.southlands * 100) / 100;
    result.grandTotals.developerPayments.lomlight = Math.round(result.grandTotals.developerPayments.lomlight * 100) / 100;
    result.grandTotals.developerPayments.other = Math.round(result.grandTotals.developerPayments.other * 100) / 100;
    result.grandTotals.realtorPayments = Math.round(result.grandTotals.realtorPayments * 100) / 100;
    result.grandTotals.legalFees = Math.round(result.grandTotals.legalFees * 100) / 100;
    result.grandTotals.aosFees = Math.round(result.grandTotals.aosFees * 100) / 100;
    result.grandTotals.totalPayments = Math.round(result.grandTotals.totalPayments * 100) / 100;
    result.grandTotals.balanceCarriedDown = Math.round(result.grandTotals.balanceCarriedDown * 100) / 100;
    
    // Validation
    if (result.metadata.totalStands === 0) {
      result.metadata.validationErrors.push('No stands detected. Check file format.');
    }
    
  } catch (error) {
    result.metadata.validationErrors.push(`Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return result;
}

// Export to JSON
export function exportToJson(result: LedgerParseResult): string {
  return JSON.stringify(result, null, 2);
}

// Export to CSV
export function exportToCsv(result: LedgerParseResult): string {
  const headers = [
    'Sheet', 'Stand Number', 'Agent', 'Date', 'Description', 'Ref', 
    'Category', 'Side', 'Amount'
  ];
  
  const rows: string[] = [headers.join(',')];
  
  for (const tx of result.allTransactions) {
    rows.push([
      tx.sheetName,
      tx.standNumber,
      tx.agentCode,
      tx.date || '',
      `"${tx.description.replace(/"/g, '""')}"`,
      tx.reference,
      tx.category,
      tx.side,
      tx.amount
    ].join(','));
  }
  
  return rows.join('\n');
}
