import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { parseLedgerFile, ParsedTransaction } from "@/lib/import/ledger-parser";

// POST /api/uploads/import - Import ledger data to database
export async function POST(request: NextRequest) {
  const importSummary = {
    uploadId: '',
    estatesProcessed: 0,
    standsCreated: 0,
    transactionsCreated: 0,
    customerPaymentsTotal: 0,
    deductiblesTotal: 0,
    commissionsTotal: 0,
    developerPaymentsTotal: 0,
    legalFeesTotal: 0,
    adminFeesTotal: 0,
    aosFeesTotal: 0,
    realtorPaymentsTotal: 0,
    warnings: [] as string[],
    errors: [] as string[]
  };

  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fileData, filename, developmentId } = await request.json();
    const sql = getDb();

    // Parse the file data (base64 to ArrayBuffer)
    const buffer = Buffer.from(fileData, 'base64');
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

    // Parse the ledger
    const result = parseLedgerFile(arrayBuffer as ArrayBuffer, filename);

    if (result.metadata.totalStands === 0) {
      return NextResponse.json({
        error: "No stands found in file",
        summary: importSummary
      }, { status: 400 });
    }

    // 1. Create upload record
    const uploadResults = await sql`
      INSERT INTO uploads (
        user_id, development_id, file_name, file_path, 
        file_size, status, stands_detected, transactions_detected, raw_data
      ) VALUES (
        ${userId}, ${developmentId || null}, ${filename}, 
        ${`uploads/${userId}/${Date.now()}_${filename}`}, ${buffer.length}, 
        'Processing', ${result.metadata.totalStands}, 
        ${result.metadata.totalTransactions}, 
        ${JSON.stringify({ estates: result.estates.map(e => e.sheetName) })}
      ) RETURNING *
    `;

    const upload = uploadResults[0];
    if (!upload) {
      throw new Error("Failed to create upload record");
    }

    importSummary.uploadId = upload.id;

    // Add any parser warnings
    if (result.metadata.warnings.length > 0) {
      importSummary.warnings.push(...result.metadata.warnings);
    }

    // 2. Process each estate and stand
    for (const estate of result.estates) {
      importSummary.estatesProcessed++;

      for (const stand of estate.stands) {
        try {
          // Create or get stand inventory
          const standKey = developmentId
            ? `${developmentId}:${stand.standNumber}`
            : `${estate.sheetName}:${stand.standNumber}`;

          const standInvResults = await sql`
            INSERT INTO stand_inventory (canonical_stand_key, stand_number)
            VALUES (${standKey}, ${stand.standNumber})
            ON CONFLICT (canonical_stand_key) DO UPDATE 
            SET stand_number = EXCLUDED.stand_number
            RETURNING id
          `;

          const standInv = standInvResults[0];

          // Create development_stand link if development selected
          let devStandId: string | null = null;
          if (developmentId) {
            const devStandResults = await sql`
              INSERT INTO development_stands (
                development_id, stand_inventory_id, client_name, agreed_price, status
              ) VALUES (
                ${developmentId}, ${standInv.id}, 
                ${stand.agentCode ? `${stand.agentCode}` : null}, 
                ${stand.customerPayments.total}, 
                ${stand.customerPayments.total > 0 ? 'Sold' : 'Available'}
              ) ON CONFLICT (development_id, stand_inventory_id) DO UPDATE 
              SET 
                client_name = EXCLUDED.client_name,
                agreed_price = EXCLUDED.agreed_price,
                status = EXCLUDED.status
              RETURNING id
            `;
            devStandId = devStandResults[0].id;
          }

          importSummary.standsCreated++;

          // 3. Create payment transactions - combine both sides
          const allTransactions: ParsedTransaction[] = [
            ...stand.customerPayments.transactions,
            ...stand.deductibles.transactions
          ];

          for (const tx of allTransactions) {
            const idempotencyKey = `${upload.id}-${tx.sheetName}-${stand.standNumber}-${tx.rowIndex}`;

            // Map new categories to database categories
            const dbCategory = mapCategoryToDb(tx.category);
            const dbSide = tx.side === 'CUSTOMER_PAYMENT' ? 'RECEIPT' : 'PAYMENT';

            await sql`
              INSERT INTO payment_transactions (
                user_id, upload_id, development_id, stand_id, stand_inventory_id,
                transaction_date, amount, reference, description, category, side,
                sheet_name, status, source_row_index, idempotency_key
              ) VALUES (
                ${userId}, ${upload.id}, ${developmentId || null}, 
                ${devStandId}, ${standInv.id},
                ${tx.date}, ${tx.amount}, ${tx.reference}, 
                ${`[${tx.sheetName}] ${tx.description}`}, 
                ${dbCategory}, ${dbSide}, ${tx.sheetName},
                ${devStandId ? 'Matched' : 'Unmatched'},
                ${tx.rowIndex}, ${idempotencyKey}
              ) ON CONFLICT (idempotency_key) DO UPDATE
              SET 
                amount = EXCLUDED.amount,
                reference = EXCLUDED.reference,
                description = EXCLUDED.description
            `;

            importSummary.transactionsCreated++;

            // Track totals by side and category
            if (tx.side === 'CUSTOMER_PAYMENT') {
              importSummary.customerPaymentsTotal += tx.amount;
            } else {
              importSummary.deductiblesTotal += tx.amount;
              
              // Track deductible subcategories
              switch (tx.category) {
                case 'DEDUCTION_COMMISSION':
                  importSummary.commissionsTotal += tx.amount;
                  break;
                case 'DEDUCTION_DEVELOPER':
                  importSummary.developerPaymentsTotal += tx.amount;
                  break;
                case 'DEDUCTION_LEGAL_FEE':
                  importSummary.legalFeesTotal += tx.amount;
                  break;
                case 'DEDUCTION_ADMIN_FEE':
                  importSummary.adminFeesTotal += tx.amount;
                  break;
                case 'DEDUCTION_AOS':
                  importSummary.aosFeesTotal += tx.amount;
                  break;
                case 'DEDUCTION_REALTOR':
                  importSummary.realtorPaymentsTotal += tx.amount;
                  break;
              }
            }
          }

        } catch (standErr) {
          console.error(`Stand processing error for ${stand.standNumber}:`, standErr);
          importSummary.errors.push(`Stand ${stand.standNumber}: ${standErr instanceof Error ? standErr.message : 'Unknown error'}`);
        }
      }
    }

    // Helper function to map new categories to database categories
    function mapCategoryToDb(category: string): string {
      const mapping: Record<string, string> = {
        'CUSTOMER_DEPOSIT': 'CLIENT_DEPOSIT',
        'CUSTOMER_INSTALLMENT': 'CLIENT_INSTALLMENT',
        'CUSTOMER_ADMIN_FEE': 'FC_ADMIN_FEE',
        'CUSTOMER_LEGAL_FEE': 'LEGAL_FEE',
        'DEDUCTION_COMMISSION': 'FC_COMMISSION',
        'DEDUCTION_ADMIN_FEE': 'FC_ADMIN_FEE',
        'DEDUCTION_AOS': 'AOS_FEE',
        'DEDUCTION_DEVELOPER': 'DEVELOPER_PAYMENT',
        'DEDUCTION_REALTOR': 'REALTOR_PAYMENT',
        'DEDUCTION_LEGAL_FEE': 'LEGAL_FEE',
        'UNKNOWN': 'UNKNOWN'
      };
      return mapping[category] || 'UNKNOWN';
    }

    // 4. Mark upload as completed
    await sql`
      UPDATE uploads
      SET status = 'Completed', completed_at = NOW()
      WHERE id = ${upload.id}
    `;

    // Round numbers
    const round2 = (n: number) => Math.round(n * 100) / 100;
    importSummary.customerPaymentsTotal = round2(importSummary.customerPaymentsTotal);
    importSummary.deductiblesTotal = round2(importSummary.deductiblesTotal);
    importSummary.commissionsTotal = round2(importSummary.commissionsTotal);
    importSummary.developerPaymentsTotal = round2(importSummary.developerPaymentsTotal);
    importSummary.legalFeesTotal = round2(importSummary.legalFeesTotal);
    importSummary.adminFeesTotal = round2(importSummary.adminFeesTotal);
    importSummary.aosFeesTotal = round2(importSummary.aosFeesTotal);
    importSummary.realtorPaymentsTotal = round2(importSummary.realtorPaymentsTotal);

    const hasErrors = importSummary.errors.length > 0;
    return NextResponse.json({
      success: !hasErrors,
      summary: importSummary,
      grandTotals: result.grandTotals
    }, { status: hasErrors ? 207 : 200 });

  } catch (error) {
    console.error("Import error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to import";
    importSummary.errors.push(`Fatal error: ${errorMessage}`);
    return NextResponse.json({
      error: errorMessage,
      summary: importSummary
    }, { status: 500 });
  }
}
