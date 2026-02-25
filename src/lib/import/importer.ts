import { createClient as createServerClient } from "@/lib/supabase/server";
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

  const supabase = await createServerClient();

  try {
    // 1. Parse the Excel file
    const parseResult = parseExcelFile(fileBuffer, options.developmentCode);

    if (parseResult.errors.length > 0) {
      result.errors.push(...parseResult.errors);
      return result;
    }

    // 2. Create upload record
    const { data: upload, error: uploadError } = await supabase
      .from("uploads")
      .insert({
        user_id: options.userId,
        development_id: options.developmentId || null,
        file_name: fileName,
        file_path: `uploads/${options.userId}/${Date.now()}_${fileName}`,
        file_size: fileBuffer.byteLength,
        status: "Processing",
        stands_detected: parseResult.stands.length,
        transactions_detected: parseResult.stands.reduce((sum, s) => sum + s.payments.length, 0) + parseResult.unmatchedTransactions.length,
        raw_data: parseResult
      })
      .select()
      .single();

    if (uploadError || !upload) {
      throw new Error(`Failed to create upload record: ${uploadError?.message}`);
    }

    result.uploadId = upload.id;

    // 3. Process each stand block
    for (const standBlock of parseResult.stands) {
      try {
        await processStandBlock(supabase, standBlock, upload.id, options);
        result.standsProcessed++;
      } catch (err) {
        result.errors.push(`Error processing stand ${standBlock.standNumber}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // 4. Process unmatched transactions
    for (const payment of parseResult.unmatchedTransactions) {
      try {
        const idempotencyKey = `${upload.id}-unmatched-${payment.rowIndex}`;
        
        const { error } = await supabase
          .from("payment_transactions")
          .insert({
            user_id: options.userId,
            upload_id: upload.id,
            development_id: options.developmentId,
            stand_id: null,
            transaction_date: payment.date?.toISOString().split('T')[0],
            amount: payment.amount,
            reference: payment.reference,
            description: payment.description,
            status: "Unmatched",
            source_row_index: payment.rowIndex,
            idempotency_key: idempotencyKey
          });

        if (!error) {
          result.transactionsCreated++;
        }
      } catch (err) {
        result.errors.push(`Error processing unmatched transaction: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // 5. Mark upload as completed
    await supabase
      .from("uploads")
      .update({
        status: result.errors.length > 0 ? "Failed" : "Completed",
        completed_at: new Date().toISOString()
      })
      .eq("id", upload.id);

  } catch (error) {
    result.errors.push(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

/**
 * Processes a single stand block - upserts stand and creates transactions
 */
async function processStandBlock(
  supabase: any,
  standBlock: StandBlock,
  uploadId: string,
  options: ImportOptions
) {
  // 1. Upsert stand inventory (canonical stand)
  const { data: standInv, error: standInvError } = await supabase
    .from("stand_inventory")
    .upsert({
      canonical_stand_key: standBlock.standKey,
      stand_number: standBlock.standNumber
    }, {
      onConflict: "canonical_stand_key"
    })
    .select()
    .single();

  if (standInvError) {
    throw new Error(`Failed to upsert stand inventory: ${standInvError.message}`);
  }

  // 2. If developmentId provided, link stand to development
  let developmentStandId: string | null = null;
  
  if (options.developmentId) {
    // Check if development stand already exists
    const { data: existingDevStand } = await supabase
      .from("development_stands")
      .select("id")
      .eq("development_id", options.developmentId)
      .eq("stand_inventory_id", standInv.id)
      .maybeSingle();

    if (existingDevStand) {
      developmentStandId = existingDevStand.id;
      
      // Update client name if provided
      if (standBlock.clientName) {
        await supabase
          .from("development_stands")
          .update({ client_name: standBlock.clientName })
          .eq("id", developmentStandId);
      }
    } else {
      // Create new development stand
      const { data: newDevStand, error: devStandError } = await supabase
        .from("development_stands")
        .insert({
          development_id: options.developmentId,
          stand_inventory_id: standInv.id,
          client_name: standBlock.clientName,
          status: "Sold"
        })
        .select()
        .single();

      if (devStandError) {
        throw new Error(`Failed to create development stand: ${devStandError.message}`);
      }
      
      developmentStandId = newDevStand.id;
    }
  }

  // 3. Create payment transactions
  for (const payment of standBlock.payments) {
    const idempotencyKey = `${uploadId}-${standBlock.standKey}-${payment.rowIndex}`;
    
    const { error: txnError } = await supabase
      .from("payment_transactions")
      .insert({
        user_id: options.userId,
        upload_id: uploadId,
        development_id: options.developmentId,
        stand_id: developmentStandId,
        transaction_date: payment.date?.toISOString().split('T')[0],
        amount: payment.amount,
        reference: payment.reference,
        description: payment.description,
        status: developmentStandId ? "Matched" : "Unmatched",
        source_row_index: payment.rowIndex,
        idempotency_key: idempotencyKey
      }, {
        onConflict: "idempotency_key"
      });

    if (txnError) {
      console.warn(`Failed to insert transaction: ${txnError.message}`);
    }
  }
}

/**
 * Reconciles transactions with stands based on reference matching
 */
export async function reconcileTransactions(userId: string, developmentId?: string) {
  const supabase = await createServerClient();

  // Get unmatched transactions
  let query = supabase
    .from("payment_transactions")
    .select("*, uploads!inner(file_name)")
    .eq("user_id", userId)
    .eq("status", "Unmatched");

  if (developmentId) {
    query = query.eq("development_id", developmentId);
  }

  const { data: unmatchedTxns, error } = await query;

  if (error || !unmatchedTxns) {
    throw new Error(`Failed to fetch unmatched transactions: ${error?.message}`);
  }

  const reconciled: string[] = [];

  for (const txn of unmatchedTxns) {
    // Try to match by reference pattern (e.g., "DEP-GVE-101" -> stand 101)
    const refMatch = txn.reference?.match(/(\d{3,4})/);
    
    if (refMatch && txn.development_id) {
      const standNumber = refMatch[1];
      
      // Find development stand
      const { data: devStand } = await supabase
        .from("development_stands")
        .select("id, stand_inventory!inner(stand_number)")
        .eq("development_id", txn.development_id)
        .eq("stand_inventory.stand_number", standNumber)
        .maybeSingle();

      if (devStand) {
        // Update transaction as matched
        await supabase
          .from("payment_transactions")
          .update({
            stand_id: devStand.id,
            status: "Matched"
          })
          .eq("id", txn.id);

        reconciled.push(txn.id);
      }
    }
  }

  return { reconciledCount: reconciled.length, reconciledIds: reconciled };
}
