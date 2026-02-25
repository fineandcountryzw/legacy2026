import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
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

    let supabase;
    try {
      supabase = await createClient();
    } catch (err) {
      console.error("Failed to create Supabase client:", err);
      return NextResponse.json({ 
        error: "Database configuration error", 
        details: err instanceof Error ? err.message : "Unknown error"
      }, { status: 500 });
    }

    const { fileData, filename, developmentId } = await request.json();
    
    // Parse the file data (base64 to ArrayBuffer)
    const buffer = Buffer.from(fileData, 'base64');
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    
    // Parse the ledger
    const result = parseLedgerFile(arrayBuffer, filename);
    
    if (result.metadata.totalStands === 0) {
      return NextResponse.json({ 
        error: "No stands found in file",
        summary: importSummary 
      }, { status: 400 });
    }

    // 1. Create upload record
    const { data: upload, error: uploadError } = await supabase
      .from("uploads")
      .insert({
        user_id: userId,
        development_id: developmentId || null,
        file_name: filename,
        file_path: `uploads/${userId}/${Date.now()}_${filename}`,
        file_size: buffer.length,
        status: "Processing",
        stands_detected: result.metadata.totalStands,
        transactions_detected: result.metadata.totalTransactions,
        raw_data: { estates: result.estates.map(e => e.sheetName) }
      })
      .select()
      .single();

    if (uploadError || !upload) {
      throw new Error(`Failed to create upload record: ${uploadError?.message}`);
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
          
          const { data: standInv, error: standError } = await supabase
            .from("stand_inventory")
            .upsert({
              canonical_stand_key: standKey,
              stand_number: stand.standNumber
            }, { onConflict: "canonical_stand_key" })
            .select()
            .single();

          if (standError) {
            console.error(`Stand inventory error for ${stand.standNumber}:`, standError);
            importSummary.errors.push(`Stand ${stand.standNumber}: ${standError.message}`);
            continue;
          }
          
          if (!standInv) {
            console.error(`No stand inventory returned for ${stand.standNumber}`);
            importSummary.errors.push(`Stand ${stand.standNumber}: Failed to create stand inventory`);
            continue;
          }

          // Create development_stand link if development selected
          let devStandId: string | null = null;
          if (developmentId) {
            const { data: devStand, error: devStandError } = await supabase
              .from("development_stands")
              .upsert({
                development_id: developmentId,
                stand_inventory_id: standInv.id,
                client_name: stand.agentCode ? `${stand.agentCode}` : null,
                agreed_price: stand.totalReceipts,
                status: stand.totalReceipts > 0 ? 'Sold' : 'Available'
              }, { onConflict: "development_id,stand_inventory_id" })
              .select()
              .single();

            if (!devStandError && devStand) {
              devStandId = devStand.id;
            }
          }

          importSummary.standsCreated++;

          // 3. Create payment transactions and track all categories
          for (const tx of stand.transactions) {
            const idempotencyKey = `${upload.id}-${stand.standNumber}-${tx.rawRowIndex}`;
            
            const { error: txError } = await supabase
              .from("payment_transactions")
              .upsert({
                user_id: userId,
                upload_id: upload.id,
                development_id: developmentId || null,
                stand_id: devStandId,
                transaction_date: tx.date,
                amount: tx.amount,
                reference: tx.reference,
                description: `[${tx.sheetName}] ${tx.description}`,
                status: devStandId ? "Matched" : "Unmatched",
                source_row_index: tx.rawRowIndex,
                idempotency_key: idempotencyKey
              }, { onConflict: "idempotency_key" });

            if (!txError) {
              importSummary.transactionsCreated++;
              
              // Track all category totals properly
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
          }

        } catch (standError) {
          importSummary.errors.push(`Stand ${stand.standNumber}: ${standError instanceof Error ? standError.message : 'Unknown error'}`);
        }
      }
    }

    // 4. Mark upload as completed
    await supabase
      .from("uploads")
      .update({
        status: importSummary.errors.length > 0 ? "Completed" : "Completed",
        completed_at: new Date().toISOString()
      })
      .eq("id", upload.id);

    // Round numbers
    importSummary.clientPaymentsTotal = Math.round(importSummary.clientPaymentsTotal * 100) / 100;
    importSummary.developerPaymentsTotal = Math.round(importSummary.developerPaymentsTotal * 100) / 100;
    importSummary.legalFeesTotal = Math.round(importSummary.legalFeesTotal * 100) / 100;
    importSummary.fcFeesTotal = Math.round(importSummary.fcFeesTotal * 100) / 100;
    importSummary.realtorPaymentsTotal = Math.round(importSummary.realtorPaymentsTotal * 100) / 100;

    return NextResponse.json({
      success: true,
      summary: importSummary
    });

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
