import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { parseLedgerFile } from "@/lib/import/ledger-parser";

// POST /api/uploads/import - Import ledger data to database
export async function POST(request: NextRequest) {
  const importSummary = {
    uploadId: '',
    estatesProcessed: 0,
    standsCreated: 0,
    transactionsCreated: 0,
    clientPaymentsTotal: 0,
    developerPaymentsTotal: 0,
    legalFeesTotal: 0,
    fcFeesTotal: 0,
    realtorPaymentsTotal: 0,
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
                ${stand.totalReceipts}, 
                ${stand.totalReceipts > 0 ? 'Sold' : 'Available'}
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

          // 3. Create payment transactions
          for (const tx of stand.transactions) {
            const idempotencyKey = `${upload.id}-${tx.sheetName}-${stand.standNumber}-${tx.rawRowIndex}`;

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
                ${tx.category}, ${tx.side}, ${tx.sheetName},
                ${devStandId ? 'Matched' : 'Unmatched'},
                ${tx.rawRowIndex}, ${idempotencyKey}
              ) ON CONFLICT (idempotency_key) DO UPDATE
              SET 
                amount = EXCLUDED.amount,
                reference = EXCLUDED.reference,
                description = EXCLUDED.description
            `;

            importSummary.transactionsCreated++;

            // Track category totals
            if (tx.category === 'CLIENT_DEPOSIT' || tx.category === 'CLIENT_INSTALLMENT') {
              importSummary.clientPaymentsTotal += tx.amount;
            } else if (tx.category === 'DEVELOPER_PAYMENT') {
              importSummary.developerPaymentsTotal += tx.amount;
            } else if (tx.category === 'LEGAL_FEE') {
              importSummary.legalFeesTotal += tx.amount;
            } else if (tx.category === 'FC_COMMISSION' || tx.category === 'FC_ADMIN_FEE') {
              importSummary.fcFeesTotal += tx.amount;
            } else if (tx.category === 'REALTOR_PAYMENT') {
              importSummary.realtorPaymentsTotal += tx.amount;
            }
          }

        } catch (standErr) {
          console.error(`Stand processing error for ${stand.standNumber}:`, standErr);
          importSummary.errors.push(`Stand ${stand.standNumber}: ${standErr instanceof Error ? standErr.message : 'Unknown error'}`);
        }
      }
    }

    // 4. Mark upload as completed
    await sql`
      UPDATE uploads
      SET status = 'Completed', completed_at = NOW()
      WHERE id = ${upload.id}
    `;

    // Round numbers
    importSummary.clientPaymentsTotal = Math.round(importSummary.clientPaymentsTotal * 100) / 100;
    importSummary.developerPaymentsTotal = Math.round(importSummary.developerPaymentsTotal * 100) / 100;
    importSummary.legalFeesTotal = Math.round(importSummary.legalFeesTotal * 100) / 100;
    importSummary.fcFeesTotal = Math.round(importSummary.fcFeesTotal * 100) / 100;
    importSummary.realtorPaymentsTotal = Math.round(importSummary.realtorPaymentsTotal * 100) / 100;

    const hasErrors = importSummary.errors.length > 0;
    return NextResponse.json({
      success: !hasErrors,
      summary: importSummary
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
