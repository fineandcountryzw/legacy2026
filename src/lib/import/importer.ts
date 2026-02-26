import { getDb } from "@/lib/db";
import { parseExcelFile, ParseResult, StandBlock } from "./excel-parser";

export interface ImportOptions {
  developmentId?: string;
  developmentCode?: string;
  autoMatchStands?: boolean;
  userId: string;
}

export interface ImportResult {
  uploadId: string;
  standsProcessed: number;
  transactionsCreated: number;
  errors: string[];
}

/**
 * Processes an Excel file upload and imports stands/transactions
 */
export async function processExcelUpload(
  fileBuffer: ArrayBuffer,
  fileName: string,
  options: ImportOptions
): Promise<ImportResult> {
  const result: ImportResult = {
    uploadId: "",
    standsProcessed: 0,
    transactionsCreated: 0,
    errors: []
  };

  const sql = getDb();

  try {
    // 1. Parse the Excel file
    const parseResult = parseExcelFile(fileBuffer, options.developmentCode);

    if (parseResult.errors.length > 0) {
      result.errors.push(...parseResult.errors);
      return result;
    }

    // 2. Create upload record
    const uploadResults = await sql`
      INSERT INTO uploads (
        user_id, development_id, file_name, file_path, 
        file_size, status, stands_detected, transactions_detected, raw_data
      ) VALUES (
        ${options.userId}, ${options.developmentId || null}, ${fileName}, 
        ${`uploads/${options.userId}/${Date.now()}_${fileName}`}, ${fileBuffer.byteLength}, 
        'Processing', ${parseResult.stands.length}, 
        ${parseResult.stands.reduce((sum, s) => sum + s.payments.length, 0) + parseResult.unmatchedTransactions.length}, 
        ${JSON.stringify(parseResult)}
      ) RETURNING *
    `;

    const upload = uploadResults[0];
    if (!upload) {
      throw new Error("Failed to create upload record");
    }

    result.uploadId = upload.id;

    // 3. Process each stand block
    for (const standBlock of parseResult.stands) {
      try {
        const txCount = await processStandBlock(sql, standBlock, upload.id, options);
        result.standsProcessed++;
        result.transactionsCreated += txCount;
      } catch (err) {
        result.errors.push(`Error processing stand ${standBlock.standNumber}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // 4. Process unmatched transactions
    for (const payment of parseResult.unmatchedTransactions) {
      try {
        const sheetNameClean = payment.sheetName.replace(/[^a-zA-Z0-9]/g, '_');
        const idempotencyKey = `${upload.id}-${sheetNameClean}-unmatched-${payment.rowIndex}`;

        await sql`
          INSERT INTO payment_transactions (
            user_id, upload_id, development_id, stand_id,
            transaction_date, amount, reference, description, status,
            source_row_index, idempotency_key, sheet_name
          ) VALUES (
            ${options.userId}, ${upload.id}, ${options.developmentId || null}, null,
            ${payment.date?.toISOString().split('T')[0]}, ${payment.amount}, 
            ${payment.reference}, ${payment.description}, 'Unmatched',
            ${payment.rowIndex}, ${idempotencyKey}, ${payment.sheetName}
          ) ON CONFLICT (idempotency_key) DO NOTHING
        `;

        result.transactionsCreated++;
      } catch (err) {
        result.errors.push(`Error processing unmatched transaction: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // 5. Mark upload as completed
    await sql`
      UPDATE uploads
      SET 
        status = ${result.errors.length > 0 ? 'Failed' : 'Completed'},
        completed_at = NOW()
      WHERE id = ${upload.id}
    `;

  } catch (error) {
    result.errors.push(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

/**
 * Processes a single stand block - upserts stand and creates transactions
 */
async function processStandBlock(
  sql: any,
  standBlock: StandBlock,
  uploadId: string,
  options: ImportOptions
): Promise<number> {
  let txCreated = 0;

  // 1. Upsert stand inventory (canonical stand)
  const standInvResults = await sql`
    INSERT INTO stand_inventory (canonical_stand_key, stand_number)
    VALUES (${standBlock.standKey}, ${standBlock.standNumber})
    ON CONFLICT (canonical_stand_key) DO UPDATE 
    SET stand_number = EXCLUDED.stand_number
    RETURNING id
  `;

  const standInv = standInvResults[0];

  // 2. If developmentId provided, link stand to development
  let developmentStandId: string | null = null;

  if (options.developmentId) {
    const existingDevStands = await sql`
      SELECT id FROM development_stands 
      WHERE development_id = ${options.developmentId} AND stand_inventory_id = ${standInv.id}
    `;

    if (existingDevStands.length > 0) {
      developmentStandId = existingDevStands[0].id;

      if (standBlock.clientName) {
        await sql`
          UPDATE development_stands 
          SET client_name = ${standBlock.clientName} 
          WHERE id = ${developmentStandId}
        `;
      }
    } else {
      const newDevStandResults = await sql`
        INSERT INTO development_stands (development_id, stand_inventory_id, client_name, status)
        VALUES (${options.developmentId}, ${standInv.id}, ${standBlock.clientName}, 'Sold')
        RETURNING id
      `;
      developmentStandId = newDevStandResults[0].id;
    }
  }

  // 3. Create payment transactions
  for (const payment of standBlock.payments) {
    // Improved idempotency key includes sheetName to prevent collisions between sheets
    const sheetNameClean = payment.sheetName.replace(/[^a-zA-Z0-9]/g, '_');
    const idempotencyKey = `${uploadId}-${sheetNameClean}-${standBlock.standKey}-${payment.rowIndex}`;

    await sql`
      INSERT INTO payment_transactions (
        user_id, upload_id, development_id, stand_id, stand_inventory_id,
        transaction_date, amount, reference, description, status,
        source_row_index, idempotency_key, sheet_name, category, side
      ) VALUES (
        ${options.userId}, ${uploadId}, ${options.developmentId || null}, 
        ${developmentStandId}, ${standInv.id},
        ${payment.date?.toISOString().split('T')[0]}, ${payment.amount}, 
        ${payment.reference}, ${payment.description}, 
        ${developmentStandId ? 'Matched' : 'Unmatched'},
        ${payment.rowIndex}, ${idempotencyKey}, ${payment.sheetName},
        ${standBlock.category}, ${standBlock.side}
      ) ON CONFLICT (idempotency_key) DO UPDATE
      SET 
        amount = EXCLUDED.amount,
        reference = EXCLUDED.reference,
        description = EXCLUDED.description
    `;
    txCreated++;
  }

  return txCreated;
}

/**
 * Reconciles transactions with stands based on reference matching
 */
export async function reconcileTransactions(userId: string, developmentId?: string) {
  const sql = getDb();

  // Get unmatched transactions
  let unmatchedTxns;
  if (developmentId) {
    unmatchedTxns = await sql`
      SELECT t.*, u.file_name 
      FROM payment_transactions t
      JOIN uploads u ON t.upload_id = u.id
      WHERE t.user_id = ${userId} AND t.status = 'Unmatched' AND t.development_id = ${developmentId}
    `;
  } else {
    unmatchedTxns = await sql`
      SELECT t.*, u.file_name 
      FROM payment_transactions t
      JOIN uploads u ON t.upload_id = u.id
      WHERE t.user_id = ${userId} AND t.status = 'Unmatched'
    `;
  }

  const reconciled: string[] = [];

  for (const txn of unmatchedTxns) {
    // Try to match by reference pattern (e.g., "DEP-GVE-101" -> stand 101)
    const refMatch = txn.reference?.match(/(\d{3,4})/);

    if (refMatch && txn.development_id) {
      const standNumber = refMatch[1];

      // Find development stand
      const devStands = await sql`
        SELECT ds.id 
        FROM development_stands ds
        JOIN stand_inventory si ON ds.stand_inventory_id = si.id
        WHERE ds.development_id = ${txn.development_id} AND si.stand_number = ${standNumber}
      `;

      if (devStands.length > 0) {
        // Update transaction as matched
        await sql`
          UPDATE payment_transactions
          SET stand_id = ${devStands[0].id}, status = 'Matched'
          WHERE id = ${txn.id}
        `;
        reconciled.push(txn.id);
      }
    }
  }

  return { reconciledCount: reconciled.length, reconciledIds: reconciled };
}
