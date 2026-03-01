// =====================================================
// Historical Data Import Service
// Lakecity Accounting Suite
// =====================================================

import { getDb, generateId } from '../db';
import { logAudit, AUDIT_ACTIONS } from '../audit';
import { hasPermission, type Permission } from '../auth/rbac';

function sql() {
  return getDb();
}

export interface HistoricalStandData {
  estateName: string;
  standNumber: string;
  agentCode?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  salePrice?: number;
  saleDate?: string;
  paymentTerms?: 'CASH' | 'INSTALLMENT';
  status?: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
}

export interface ImportResult {
  estatesCreated: number;
  estatesUpdated: number;
  standsCreated: number;
  standsUpdated: number;
  errors: { sheet: string; row: number; error: string }[];
}

// Excel row structure expected:
// [Stand Number, Agent Code, Client Name, Client Phone, Client Email, Sale Price, Sale Date, Payment Terms, Status]

/**
 * Import historical stands from Excel workbook
 * Each sheet in the workbook represents an estate/development
 */
export async function importHistoricalStands(
  fileBuffer: Buffer,
  importedBy: string,
  ipAddress?: string
): Promise<ImportResult> {
  // Dynamic import for xlsx to avoid build issues
  const XLSX = require('xlsx');
  
  const result: ImportResult = {
    estatesCreated: 0,
    estatesUpdated: 0,
    standsCreated: 0,
    standsUpdated: 0,
    errors: [],
  };

  try {
    // Read workbook
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    
    // Process each sheet (each sheet = one development)
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
      
      // Skip empty sheets
      if (rows.length === 0) continue;
      
      // Get or create development
      let development = await sql()`
        SELECT id FROM developments WHERE name = ${sheetName}
      `;
      
      let developmentId: string;
      
      if (development.length === 0) {
        // Create new development
        const newDev = await sql()`
          INSERT INTO developments (id, name, status, created_at)
          VALUES (${generateId()}, ${sheetName}, 'ACTIVE', NOW())
          RETURNING id
        `;
        developmentId = newDev[0].id;
        result.estatesCreated++;
        
        // Log development creation
        await logAudit({
          action: AUDIT_ACTIONS.DEVELOPMENT_CREATED,
          entityType: 'DEVELOPMENT',
          entityId: developmentId,
          newValues: { name: sheetName, status: 'ACTIVE' },
          performedBy: importedBy,
          ipAddress,
          reason: 'Created from historical data import',
        });
      } else {
        developmentId = development[0].id;
        result.estatesUpdated++;
      }
      
      // Process each row (starting from row 2 to skip headers if present)
      // Try to detect if first row is header
      const startIndex = isHeaderRow(rows[0]) ? 1 : 0;
      
      for (let i = startIndex; i < rows.length; i++) {
        const row = rows[i];
        
        try {
          const standData = parseStandRow(row, sheetName);
          
          if (!standData.standNumber) {
            continue; // Skip rows without stand number
          }
          
          // Check if stand exists
          const existingStand = await sql()`
            SELECT ds.id, ds.client_name, ds.sale_price, ds.sale_date
            FROM development_stands ds
            JOIN stand_inventory si ON ds.stand_inventory_id = si.id
            WHERE ds.development_id = ${developmentId}
              AND si.stand_number = ${standData.standNumber}
          `;
          
          if (existingStand.length > 0) {
            // Update existing stand
            await sql()`
              UPDATE development_stands
              SET 
                agent_code = COALESCE(${standData.agentCode || null}, agent_code),
                client_name = COALESCE(${standData.clientName || null}, client_name),
                client_phone = COALESCE(${standData.clientPhone || null}, client_phone),
                client_email = COALESCE(${standData.clientEmail || null}, client_email),
                sale_price = COALESCE(${standData.salePrice || null}, sale_price),
                sale_date = COALESCE(${standData.saleDate || null}, sale_date),
                payment_terms = COALESCE(${standData.paymentTerms || null}, payment_terms),
                accounting_status = COALESCE(${standData.status || null}, accounting_status),
                updated_at = NOW()
              WHERE id = ${existingStand[0].id}
            `;
            result.standsUpdated++;
          } else {
            // Create new stand - need to get or create stand_inventory first
            let standInventory = await sql()`
              SELECT id FROM stand_inventory 
              WHERE development_id = ${developmentId}
                AND stand_number = ${standData.standNumber}
            `;
            
            let standInventoryId: string;
            
            if (standInventory.length === 0) {
              const newSI = await sql()`
                INSERT INTO stand_inventory (id, development_id, stand_number, status, created_at)
                VALUES (${generateId()}, ${developmentId}, ${standData.standNumber}, 'AVAILABLE', NOW())
                RETURNING id
              `;
              standInventoryId = newSI[0].id;
            } else {
              standInventoryId = standInventory[0].id;
            }
            
            // Create development_stands record
            await sql()`
              INSERT INTO development_stands (
                id,
                stand_inventory_id,
                development_id,
                agent_code,
                client_name,
                client_phone,
                client_email,
                sale_price,
                sale_date,
                payment_terms,
                accounting_status,
                total_deposits,
                total_installments,
                total_customer_payments,
                total_deductions,
                balance,
                created_at,
                updated_at
              ) VALUES (
                ${generateId()},
                ${standInventoryId},
                ${developmentId},
                ${standData.agentCode || null},
                ${standData.clientName || null},
                ${standData.clientPhone || null},
                ${standData.clientEmail || null},
                ${standData.salePrice || null},
                ${standData.saleDate || null},
                ${standData.paymentTerms || 'INSTALLMENT'},
                ${standData.status || 'ACTIVE'},
                0,
                0,
                0,
                0,
                0,
                NOW(),
                NOW()
              )
            `;
            result.standsCreated++;
          }
        } catch (rowError) {
          result.errors.push({
            sheet: sheetName,
            row: i + 1,
            error: (rowError as Error).message,
          });
        }
      }
    }
    
    // Log import
    await logAudit({
      action: AUDIT_ACTIONS.DATA_IMPORTED,
      entityType: 'IMPORT',
      newValues: {
        estatesCreated: result.estatesCreated,
        estatesUpdated: result.estatesUpdated,
        standsCreated: result.standsCreated,
        standsUpdated: result.standsUpdated,
        errorCount: result.errors.length,
      },
      performedBy: importedBy,
      ipAddress,
      reason: 'Historical stand sales data import',
    });
    
    return result;
  } catch (error) {
    console.error('Error importing historical data:', error);
    throw error;
  }
}

/**
 * Check if the first row is a header row
 */
function isHeaderRow(row: unknown[]): boolean {
  if (!row || !Array.isArray(row) || row.length === 0) return false;
  
  const firstCell = String(row[0]).toLowerCase().trim();
  const headerIndicators = ['stand', 'number', 'stand#', 'stand number', 'agent', 'client', 'name'];
  
  return headerIndicators.some(indicator => firstCell.includes(indicator));
}

/**
 * Parse a stand row from Excel data
 */
function parseStandRow(row: unknown[], sheetName: string): HistoricalStandData {
  // Expected column order based on spec:
  // [Stand Number, Agent Code, Client Name, Client Phone, Client Email, Sale Price, Sale Date, Payment Terms, Status]
  
  const standNumber = String(row[0] || '').trim();
  const agentCode = row[1] ? String(row[1]).trim() : undefined;
  const clientName = row[2] ? String(row[2]).trim() : undefined;
  const clientPhone = row[3] ? String(row[3]).trim() : undefined;
  const clientEmail = row[4] ? String(row[4]).trim() : undefined;
  const salePrice = row[5] ? parseFloat(String(row[5])) : undefined;
  const saleDate = row[6] ? parseDate(row[6]) : undefined;
  const paymentTerms = row[7] ? String(row[7]).toUpperCase().trim() as 'CASH' | 'INSTALLMENT' : undefined;
  const status = row[8] ? String(row[8]).toUpperCase().trim() as 'ACTIVE' | 'COMPLETED' | 'CANCELLED' : undefined;
  
  return {
    estateName: sheetName,
    standNumber,
    agentCode: agentCode || undefined,
    clientName: clientName || undefined,
    clientPhone: clientPhone || undefined,
    clientEmail: clientEmail || undefined,
    salePrice: isNaN(salePrice!) ? undefined : salePrice,
    saleDate,
    paymentTerms: (paymentTerms === 'CASH' || paymentTerms === 'INSTALLMENT') ? paymentTerms : undefined,
    status: (status === 'ACTIVE' || status === 'COMPLETED' || status === 'CANCELLED') ? status : undefined,
  };
}

/**
 * Parse date from various formats
 */
function parseDate(value: unknown): string | undefined {
  if (!value) return undefined;
  
  // If it's already a string in YYYY-MM-DD format
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    return undefined;
  }
  
  // If it's a serial date number (Excel date)
  if (typeof value === 'number') {
    // Excel serial date: days since 1899-12-30
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    return undefined;
  }
  
  // If it's a Date object
  if (value instanceof Date) {
    if (!isNaN(value.getTime())) {
      return value.toISOString().split('T')[0];
    }
  }
  
  return undefined;
}

/**
 * Get import template for historical data
 * Returns a sample structure showing expected format
 */
export function getImportTemplate(): {
  headers: string[];
  exampleRows: unknown[][];
  description: string;
} {
  return {
    headers: [
      'Stand Number',
      'Agent Code',
      'Client Name',
      'Client Phone',
      'Client Email',
      'Sale Price',
      'Sale Date (YYYY-MM-DD)',
      'Payment Terms (CASH/INSTALLMENT)',
      'Status (ACTIVE/COMPLETED/CANCELLED)',
    ],
    exampleRows: [
      ['A001', 'AGN001', 'John Doe', '+1234567890', 'john@example.com', 150000, '2024-01-15', 'INSTALLMENT', 'ACTIVE'],
      ['A002', 'AGN002', 'Jane Smith', '+1234567891', 'jane@example.com', 175000, '2024-02-20', 'CASH', 'COMPLETED'],
    ],
    description: 'Each sheet in the workbook represents a development. The sheet name should match the development name.',
  };
}
