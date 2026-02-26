import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as XLSX from 'xlsx';

// Types for parsing stages
interface ParseStage {
  stage: 'reading' | 'parsing_sheets' | 'detecting_stands' | 'processing_transactions' | 'aggregating' | 'calculating' | 'complete' | 'error';
  message: string;
  current: number;
  total: number;
  details?: string;
}

function sendStage(controller: ReadableStreamDefaultController, stage: ParseStage) {
  const data = `data: ${JSON.stringify(stage)}\n\n`;
  controller.enqueue(new TextEncoder().encode(data));
}

// Helper functions (same as ledger-parser)
function detectStandNumber(row: any[]): string | null {
  const cellB = row[1]?.toString().trim() || '';
  let match = cellB.match(/Stand\s+number\s+(\d+)/i);
  if (match) return match[1];
  match = cellB.match(/Cluster\s+stand\s+(\d+)/i);
  if (match) return match[1];
  const numMatch = cellB.match(/^(\d{3,4})$/);
  if (numMatch) return numMatch[1];
  const cellA = row[0]?.toString().trim() || '';
  match = cellA.match(/Stand\s+number\s+(\d+)/i);
  if (match) return match[1];
  return null;
}

function detectAgentCode(row: any[]): string {
  for (let i = row.length - 1; i >= Math.max(0, row.length - 4); i--) {
    const val = row[i]?.toString().trim() || '';
    if (/^[A-Z][a-z]+$/i.test(val) && val.length >= 2 && val.length <= 6) {
      return val.toUpperCase();
    }
  }
  return '';
}

function parseDate(value: any): string | null {
  if (!value) return null;
  if (typeof value === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + (value - 2) * 24 * 60 * 60 * 1000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    return null;
  }
  const str = value.toString().trim();
  let match = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  match = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2})$/);
  if (match) {
    const [, d, m, y] = match;
    const year = parseInt(y) < 50 ? `20${y}` : `19${y}`;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  match = str.match(/^(\d{3})\.(\d{2})\.(\d{4})$/);
  if (match) {
    const day = match[1].slice(-2);
    return `${match[3]}-${match[2]}-${day}`;
  }
  return null;
}

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

function detectDeveloper(description: string): { name: string | null; isAOS: boolean } {
  const desc = description.toLowerCase();
  const isAOS = desc.includes('aos');
  if (desc.includes('lakecity')) return { name: 'LAKECITY', isAOS };
  if (desc.includes('highrange')) return { name: 'HIGHRANGE', isAOS };
  if (desc.includes('southlands')) return { name: 'SOUTHLANDS', isAOS };
  if (desc.includes('lomlight')) return { name: 'LOMLIGHT', isAOS };
  const match = description.match(/(\w+)\s+developers/i);
  if (match && !desc.includes('realtor')) {
    return { name: match[1].toUpperCase(), isAOS };
  }
  return { name: null, isAOS };
}

function categorizeReceipt(description: string): string {
  const desc = description.toLowerCase();
  if (desc.includes('deposit')) return 'CLIENT_DEPOSIT';
  if (desc.includes('installment') || desc.includes('installments') || desc.includes('montly')) return 'CLIENT_INSTALLMENT';
  if (desc.includes('administration') && desc.includes('f&c')) return 'FC_ADMIN_FEE';
  if (desc.includes('legal')) return 'LEGAL_FEE';
  if (desc.includes('aos')) return 'AOS_FEE';
  return 'UNKNOWN';
}

function categorizePayment(description: string): string {
  const desc = description.toLowerCase();
  if (desc.includes('commission') && desc.includes('f&c')) return 'FC_COMMISSION';
  if (desc.includes('administration') && desc.includes('f&c')) return 'FC_ADMIN_FEE';
  if (desc.includes('realtor')) return 'REALTOR_PAYMENT';
  if (desc.includes('developers') || desc.includes('lakecity') || desc.includes('highrange') || desc.includes('southlands') || desc.includes('lomlight')) return 'DEVELOPER_PAYMENT';
  if (desc.includes('legal')) return 'LEGAL_FEE';
  if (desc.includes('aos')) return 'AOS_FEE';
  return 'UNKNOWN';
}

function isHeaderRow(row: any[]): boolean {
  const rowText = row.slice(0, 8).join(' ').toLowerCase();
  return rowText.includes('date') && (rowText.includes('description') || rowText.includes('particulars')) && rowText.includes('amount');
}

// POST /api/uploads/stream - Stream parsing progress
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
          sendStage(controller, { stage: 'error', message: 'No file provided', current: 0, total: 0, details: 'Please select a file to upload' });
          controller.close();
          return;
        }

        if (!file.name.match(/\.(xlsx|xls)$/i)) {
          sendStage(controller, { stage: 'error', message: 'Invalid file type', current: 0, total: 0, details: 'Only Excel files (.xlsx, .xls) are allowed' });
          controller.close();
          return;
        }

        // Stage 1: Reading file
        sendStage(controller, {
          stage: 'reading',
          message: 'Reading Excel file...',
          current: 0,
          total: 100,
          details: `File: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`
        });

        const buffer = await file.arrayBuffer();

        // Stage 2: Parsing workbook
        sendStage(controller, {
          stage: 'parsing_sheets',
          message: 'Parsing workbook structure...',
          current: 25,
          total: 100,
          details: 'Reading sheet names and preparing to parse each sheet'
        });

        const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
        const sheetNames = workbook.SheetNames;

        sendStage(controller, {
          stage: 'parsing_sheets',
          message: `Found ${sheetNames.length} sheet(s)...`,
          current: 30,
          total: 100,
          details: `Sheets: ${sheetNames.join(', ')}`
        });

        const allTransactions: any[] = [];
        const estates: any[] = [];
        let totalStandsDetected = 0;
        let currentSheetIndex = 0;

        // Parse each sheet
        for (const sheetName of sheetNames) {
          currentSheetIndex++;
          const progressBase = 30 + (currentSheetIndex / sheetNames.length) * 40;

          sendStage(controller, {
            stage: 'detecting_stands',
            message: `Processing sheet ${currentSheetIndex}/${sheetNames.length}: ${sheetName}...`,
            current: Math.round(progressBase),
            total: 100,
            details: 'Detecting stand headers and agent codes'
          });

          const sheet = workbook.Sheets[sheetName];
          const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });

          let currentStand: string | null = null;
          let currentAgent = '';
          let headerRowFound = false;
          let standsInSheet = 0;
          let transactionsInSheet = 0;

          for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
            const row = rows[rowIdx];

            // Detect stand number
            const standNum = detectStandNumber(row);
            if (standNum) {
              currentStand = standNum;
              currentAgent = detectAgentCode(row);
              headerRowFound = false;
              standsInSheet++;
              totalStandsDetected++;
              
              if (standsInSheet % 5 === 0) {
                sendStage(controller, {
                  stage: 'detecting_stands',
                  message: `Processing sheet ${currentSheetIndex}/${sheetNames.length}: ${sheetName}...`,
                  current: Math.round(progressBase + (rowIdx / rows.length) * 10),
                  total: 100,
                  details: `Found ${standsInSheet} stands so far (latest: Stand ${standNum})`
                });
              }
              continue;
            }

            // Detect header row
            if (isHeaderRow(row)) {
              headerRowFound = true;
              continue;
            }

            if (!currentStand || !headerRowFound) continue;

            // Skip balance rows
            const descB = row[2]?.toString().toLowerCase() || '';
            const descG = row[6]?.toString().toLowerCase() || '';
            if (descB.includes('balance') || descG.includes('balance')) continue;

            // Parse receipt (left side)
            const leftDate = parseDate(row[1]);
            const leftDesc = row[2]?.toString().trim() || '';
            const leftRef = row[3]?.toString().trim() || '';
            const leftAmount = parseAmount(row[4]);

            if (leftDate && leftDesc && leftAmount > 0) {
              allTransactions.push({
                sheetName,
                standNumber: currentStand,
                agentCode: currentAgent,
                date: leftDate,
                description: leftDesc,
                reference: leftRef || '',
                amount: leftAmount,
                category: categorizeReceipt(leftDesc),
                side: 'RECEIPT',
                rawRowIndex: rowIdx
              });
              transactionsInSheet++;
            }

            // Parse payment (right side)
            const rightDate = parseDate(row[5]) || leftDate;
            const rightDesc = row[6]?.toString().trim() || '';
            const rightRef = row[7]?.toString().trim() || '';
            const rightAmount = parseAmount(row[8]);

            if (rightDesc && rightAmount > 0 && rightDesc !== leftDesc) {
              const category = categorizePayment(rightDesc);
              const { name: developerName } = detectDeveloper(rightDesc);
              allTransactions.push({
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
              transactionsInSheet++;
            }
          }

          if (transactionsInSheet > 0) {
            estates.push({ sheetName, transactions: transactionsInSheet, stands: standsInSheet });
          }
        }

        // Stage 3: Aggregating by stand
        sendStage(controller, {
          stage: 'aggregating',
          message: 'Grouping transactions by stand...',
          current: 75,
          total: 100,
          details: `Organizing ${allTransactions.length} transactions into ${totalStandsDetected} stands`
        });

        const grouped = new Map<string, any[]>();
        for (const tx of allTransactions) {
          const key = `${tx.sheetName}-${tx.standNumber}`;
          if (!grouped.has(key)) grouped.set(key, []);
          grouped.get(key)!.push(tx);
        }

        // Stage 4: Calculating totals
        sendStage(controller, {
          stage: 'calculating',
          message: 'Calculating financial totals...',
          current: 85,
          total: 100,
          details: 'Summing receipts, payments, and balances'
        });

        const receipts = allTransactions.filter(t => t.side === 'RECEIPT');
        const payments = allTransactions.filter(t => t.side === 'PAYMENT');
        
        const totalReceipts = receipts.reduce((sum, t) => sum + t.amount, 0);
        const totalPayments = payments.reduce((sum, t) => sum + t.amount, 0);

        const clientDeposits = receipts.filter(t => t.category === 'CLIENT_DEPOSIT').reduce((sum, t) => sum + t.amount, 0);
        const clientInstallments = receipts.filter(t => t.category === 'CLIENT_INSTALLMENT').reduce((sum, t) => sum + t.amount, 0);
        const fcCommissions = payments.filter(t => t.category === 'FC_COMMISSION').reduce((sum, t) => sum + t.amount, 0);
        const fcAdminFees = payments.filter(t => t.category === 'FC_ADMIN_FEE').reduce((sum, t) => sum + t.amount, 0);
        const legalFees = [...receipts, ...payments].filter(t => t.category === 'LEGAL_FEE').reduce((sum, t) => sum + t.amount, 0);
        const aosFees = [...receipts, ...payments].filter(t => t.category === 'AOS_FEE').reduce((sum, t) => sum + t.amount, 0);
        const realtorPayments = payments.filter(t => t.category === 'REALTOR_PAYMENT').reduce((sum, t) => sum + t.amount, 0);

        const developerPayments = {
          lakecity: payments.filter(t => t.developerName === 'LAKECITY').reduce((sum, t) => sum + t.amount, 0),
          highrange: payments.filter(t => t.developerName === 'HIGHRANGE').reduce((sum, t) => sum + t.amount, 0),
          southlands: payments.filter(t => t.developerName === 'SOUTHLANDS').reduce((sum, t) => sum + t.amount, 0),
          lomlight: payments.filter(t => t.developerName === 'LOMLIGHT').reduce((sum, t) => sum + t.amount, 0),
          other: payments.filter(t => t.category === 'DEVELOPER_PAYMENT' && !['LAKECITY', 'HIGHRANGE', 'SOUTHLANDS', 'LOMLIGHT'].includes(t.developerName || '')).reduce((sum, t) => sum + t.amount, 0),
        };

        // Stage 5: Complete
        sendStage(controller, {
          stage: 'complete',
          message: 'Parsing complete!',
          current: 100,
          total: 100,
          details: `Found ${totalStandsDetected} stands with ${allTransactions.length} transactions across ${sheetNames.length} sheets`
        });

        // Send final result - match structure expected by page.tsx
        const result = {
          metadata: {
            filename: file.name,
            parsedAt: new Date().toISOString(),
            totalSheets: sheetNames.length,
            totalStands: totalStandsDetected,
            totalTransactions: allTransactions.length,
            validationErrors: totalStandsDetected === 0 ? ['No stands detected. Check file format.'] : []
          },
          estates: estates.map(e => ({
            sheetName: e.sheetName,
            stands: [], // Simplified for preview
            transactionCount: e.transactions
          })),
          grandTotals: {
            clientDeposits: Math.round(clientDeposits * 100) / 100,
            clientInstallments: Math.round(clientInstallments * 100) / 100,
            totalReceipts: Math.round(totalReceipts * 100) / 100,
            fcCommissions: Math.round(fcCommissions * 100) / 100,
            fcAdminFees: Math.round(fcAdminFees * 100) / 100,
            developerPayments: {
              lakecity: Math.round(developerPayments.lakecity * 100) / 100,
              highrange: Math.round(developerPayments.highrange * 100) / 100,
              southlands: Math.round(developerPayments.southlands * 100) / 100,
              lomlight: Math.round(developerPayments.lomlight * 100) / 100,
              other: Math.round(developerPayments.other * 100) / 100,
            },
            realtorPayments: Math.round(realtorPayments * 100) / 100,
            legalFees: Math.round(legalFees * 100) / 100,
            aosFees: Math.round(aosFees * 100) / 100,
            totalPayments: Math.round(totalPayments * 100) / 100,
            balanceCarriedDown: Math.round((totalReceipts - totalPayments) * 100) / 100
          },
          allTransactions
        };

        sendStage(controller, {
          stage: 'complete',
          message: 'Ready to preview',
          current: 100,
          total: 100,
          details: JSON.stringify(result)
        });

        controller.close();

      } catch (error) {
        sendStage(controller, {
          stage: 'error',
          message: 'Parse failed',
          current: 0,
          total: 100,
          details: error instanceof Error ? error.message : 'Unknown error'
        });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
