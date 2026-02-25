import * as XLSX from 'xlsx';

export interface ParsedPayment {
  date: Date | null;
  amount: number;
  reference: string;
  description: string;
  rowIndex: number;
}

export interface StandBlock {
  standNumber: string;
  standKey: string;
  clientName?: string;
  payments: ParsedPayment[];
  startRow: number;
  endRow: number;
}

export interface ParseResult {
  stands: StandBlock[];
  unmatchedTransactions: ParsedPayment[];
  totalRows: number;
  errors: string[];
  debug: {
    headersFound: string[];
    rowsProcessed: number;
    paymentsFound: number;
  };
}

/**
 * Detects if a row is a stand header with multiple pattern support
 */
function isStandHeader(row: any[]): { 
  isHeader: boolean; 
  standNumber?: string; 
  clientName?: string;
  matchedPattern?: string;
} {
  const rowStr = row.map(cell => String(cell || '')).join(' ').trim();
  
  if (!rowStr) return { isHeader: false };
  
  // Extended patterns for stand headers
  const patterns = [
    // Stand number variations
    /stand\s*#?\s*number[\s:.-]*(\d+[a-zA-Z]*)/i,
    /stand\s*#?[\s:.-]+(\d+[a-zA-Z]*)/i,
    /stand\s*no\.?[\s:.-]*(\d+[a-zA-Z]*)/i,
    /stand\s*#[\s:.-]*(\d+[a-zA-Z]*)/i,
    /^(\d{2,4})\s*-\s*stand/i,
    
    // Plot variations
    /plot\s*#?\s*number?[\s:.-]*(\d+[a-zA-Z]*)/i,
    /plot\s*#?[\s:.-]+(\d+[a-zA-Z]*)/i,
    /plot\s*no\.?[\s:.-]*(\d+[a-zA-Z]*)/i,
    
    // Property variations
    /property\s*#?\s*number?[\s:.-]*(\d+[a-zA-Z]*)/i,
    /property\s*#?[\s:.-]+(\d+[a-zA-Z]*)/i,
    
    // Unit variations
    /unit\s*#?\s*number?[\s:.-]*(\d+[a-zA-Z]*)/i,
    /unit\s*#?[\s:.-]+(\d+[a-zA-Z]*)/i,
    
    // Simple number at start (if followed by financial data)
    /^(\d{3,4})\s*$/,
    /^(\d{3,4})[\s:-]+([a-zA-Z\s]+)$/,
  ];
  
  for (const pattern of patterns) {
    const match = rowStr.match(pattern);
    if (match) {
      // Try to find client name in the same row
      const clientPatterns = [
        /(?:client|purchaser|buyer|name)[\s:]+([a-zA-Z\s]+?)(?=\s+(?:stand|plot|date|$))/i,
        /(?:client|purchaser|buyer)[\s:]+([a-zA-Z\s]+)/i,
        /-\s*([a-zA-Z\s]+?)(?:\s+\(|$)/,
      ];
      
      let clientName: string | undefined;
      for (const clientPattern of clientPatterns) {
        const clientMatch = rowStr.match(clientPattern);
        if (clientMatch) {
          clientName = clientMatch[1].trim();
          break;
        }
      }
      
      return {
        isHeader: true,
        standNumber: match[1].trim(),
        clientName,
        matchedPattern: pattern.toString()
      };
    }
  }
  
  return { isHeader: false };
}

/**
 * Parses a payment row with flexible column detection
 */
function parsePaymentRow(row: any[], rowIndex: number): ParsedPayment | null {
  let date: Date | null = null;
  let amount: number | null = null;
  let reference = '';
  let description = '';
  
  // Convert all cells to strings and clean
  const cells = row.map((cell, idx) => ({
    raw: cell,
    str: String(cell || '').trim(),
    idx
  })).filter(c => c.str.length > 0);
  
  for (const cell of cells) {
    const cellStr = cell.str;
    const cellRaw = cell.raw;
    
    // Try to parse as date
    if (!date) {
      // Excel date serial number
      if (typeof cellRaw === 'number' && cellRaw > 30000 && cellRaw < 60000) {
        const excelEpoch = new Date(1899, 11, 30);
        date = new Date(excelEpoch.getTime() + cellRaw * 24 * 60 * 60 * 1000);
        continue;
      }
      
      // Date string patterns
      const datePatterns = [
        // DD/MM/YYYY or DD-MM-YYYY
        { regex: /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/, day: 1, month: 2, year: 3 },
        // YYYY/MM/DD
        { regex: /^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/, day: 3, month: 2, year: 1 },
        // DD-MMM-YYYY (e.g., 15-Jan-2024)
        { regex: /^(\d{1,2})[-\s]([a-zA-Z]{3,9})[-\s](\d{2,4})$/i, day: 1, month: 2, year: 3, isTextMonth: true },
      ];
      
      for (const pattern of datePatterns) {
        const match = cellStr.match(pattern.regex);
        if (match) {
          let day = parseInt(match[pattern.day]);
          let month: number;
          let year = parseInt(match[pattern.year]);
          
          if (pattern.isTextMonth) {
            const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
            month = monthNames.findIndex(m => match[pattern.month].toLowerCase().startsWith(m));
          } else {
            month = parseInt(match[pattern.month]) - 1;
          }
          
          if (year < 100) year += 2000;
          
          const parsed = new Date(year, month, day);
          if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2000) {
            date = parsed;
            break;
          }
        }
      }
    }
    
    // Try to parse as amount
    if (amount === null) {
      // Remove all non-numeric chars except decimal point and minus
      const cleanAmount = cellStr.replace(/[^\d.\-]/g, '');
      const numMatch = cleanAmount.match(/^-?\d+\.?\d*$/);
      if (numMatch) {
        const num = parseFloat(cleanAmount);
        // Amount should be positive and reasonable
        if (!isNaN(num) && num > 0 && num < 10000000) {
          amount = num;
          continue;
        }
      }
      
      // Check if it's a number type
      if (typeof cellRaw === 'number' && cellRaw > 0 && cellRaw < 10000000) {
        amount = cellRaw;
        continue;
      }
    }
    
    // Look for reference patterns
    if (!reference) {
      const refPatterns = [
        /^(REF|DEP|TXN|PAY|INV|REC|CHQ|CHEQUE|BANK)[-\s.]?(\d+)$/i,
        /^(\d{4,})$/,
      ];
      
      for (const pattern of refPatterns) {
        if (pattern.test(cellStr)) {
          reference = cellStr;
          break;
        }
      }
    }
    
    // Description - longer text that's not a date, amount, or reference
    if (!description && cellStr.length > 3 && !date && amount === null) {
      if (!/^(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d+[,.]?\d*)$/.test(cellStr)) {
        description = cellStr;
      }
    }
  }
  
  // Must have at least a date and amount
  if (date && amount !== null) {
    return {
      date,
      amount,
      reference: reference || `ROW-${rowIndex + 1}`,
      description: description || 'Payment',
      rowIndex
    };
  }
  
  return null;
}

/**
 * Main Excel parsing function with enhanced detection
 */
export function parseExcelFile(buffer: ArrayBuffer, developmentCode?: string): ParseResult {
  const result: ParseResult = {
    stands: [],
    unmatchedTransactions: [],
    totalRows: 0,
    errors: [],
    debug: {
      headersFound: [],
      rowsProcessed: 0,
      paymentsFound: 0
    }
  };
  
  try {
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    
    if (workbook.SheetNames.length === 0) {
      result.errors.push('Excel file has no sheets');
      return result;
    }
    
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(firstSheet, { 
      header: 1,
      defval: '',
      blankrows: false
    });
    
    result.totalRows = rows.length;
    
    if (rows.length === 0) {
      result.errors.push('Excel file is empty');
      return result;
    }
    
    let currentStand: StandBlock | null = null;
    let paymentCount = 0;
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      result.debug.rowsProcessed++;
      
      // Skip completely empty rows
      if (!row || row.length === 0 || row.every(cell => !cell || String(cell).trim() === '')) {
        continue;
      }
      
      // Check if this is a stand header
      const headerCheck = isStandHeader(row);
      if (headerCheck.isHeader && headerCheck.standNumber) {
        // Save previous stand if exists
        if (currentStand && currentStand.payments.length > 0) {
          result.stands.push(currentStand);
        }
        
        const standKey = developmentCode 
          ? `${developmentCode}:${headerCheck.standNumber}`
          : headerCheck.standNumber;
        
        result.debug.headersFound.push(`Row ${i + 1}: Stand ${headerCheck.standNumber}`);
        
        currentStand = {
          standNumber: headerCheck.standNumber,
          standKey,
          clientName: headerCheck.clientName,
          payments: [],
          startRow: i,
          endRow: i
        };
        continue;
      }
      
      // Skip header rows (rows with "Date", "Amount", etc.)
      const rowStr = row.map(c => String(c || '')).join(' ').toLowerCase();
      if (/\b(date|amount|reference|description|payment)\b/.test(rowStr) && !currentStand) {
        continue;
      }
      
      // Try to parse as payment row
      const payment = parsePaymentRow(row, i);
      if (payment) {
        paymentCount++;
        if (currentStand) {
          currentStand.payments.push(payment);
          currentStand.endRow = i;
        } else {
          // Unmatched transaction
          result.unmatchedTransactions.push(payment);
        }
      }
    }
    
    // Don't forget the last stand
    if (currentStand && currentStand.payments.length > 0) {
      result.stands.push(currentStand);
    }
    
    result.debug.paymentsFound = paymentCount;
    
  } catch (error) {
    result.errors.push(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return result;
}

/**
 * Validates the parse result and returns human-readable summary
 */
export function validateParseResult(result: ParseResult): { valid: boolean; message: string } {
  if (result.errors.length > 0) {
    return { valid: false, message: result.errors.join(', ') };
  }
  
  if (result.stands.length === 0 && result.unmatchedTransactions.length === 0) {
    return { valid: false, message: 'No stands or payment data found in file. Check that your file has headers like "Stand number 123" before each group of payments.' };
  }
  
  const totalPayments = result.stands.reduce((sum, s) => sum + s.payments.length, 0) + result.unmatchedTransactions.length;
  
  let message = `Found ${result.stands.length} stands with ${totalPayments} payments`;
  if (result.unmatchedTransactions.length > 0) {
    message += ` (${result.unmatchedTransactions.length} unmatched)`;
  }
  
  return { valid: true, message };
}

/**
 * Get debug info for troubleshooting
 */
export function getParseDebugInfo(result: ParseResult): string {
  const lines = [
    `Total rows in file: ${result.totalRows}`,
    `Rows processed: ${result.debug.rowsProcessed}`,
    `Headers found: ${result.debug.headersFound.length}`,
    `Payments found: ${result.debug.paymentsFound}`,
    `Stands detected: ${result.stands.length}`,
    '',
    'Headers found:',
    ...result.debug.headersFound.map(h => `  - ${h}`),
  ];
  
  if (result.errors.length > 0) {
    lines.push('', 'Errors:', ...result.errors.map(e => `  - ${e}`));
  }
  
  return lines.join('\n');
}
