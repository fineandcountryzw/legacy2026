import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/receipts - Get all receipts for the current user
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const developmentId = searchParams.get("developmentId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const receiptNumber = searchParams.get("receiptNumber");
    const standNumber = searchParams.get("standNumber");
    const clientName = searchParams.get("clientName");

    const supabase = await createClient();

    // First get user's uploads (receipts are tied to uploads)
    let query = supabase
      .from("uploads")
      .select(`
        id,
        file_name,
        created_at,
        status,
        user_id,
        development:development_id (
          name
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (developmentId) {
      query = query.eq("development_id", developmentId);
    }

    if (startDate) {
      query = query.gte("created_at", startDate);
    }

    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    const { data: uploads, error } = await query;

    if (error) {
      console.error("Error fetching receipts:", error);
      return NextResponse.json({ 
        error: "Database error", 
        details: error.message 
      }, { status: 500 });
    }

    // Get transactions for each upload to build receipt data
    const receiptsWithDetails = await Promise.all(
      (uploads || []).map(async (upload: any) => {
        const { data: transactions } = await supabase
          .from("payment_transactions")
          .select(`
            *,
            stand:stand_id (
              stand_inventory:stand_inventory_id (
                stand_number
              ),
              client_name
            )
          `)
          .eq("upload_id", upload.id);

        const totalAmount = transactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

        return {
          id: upload.id,
          receiptNumber: upload.file_name?.replace(/\.[^/.]+$/, ""), // Remove extension
          date: upload.created_at,
          client: transactions?.[0]?.stand?.client_name || "N/A",
          stand: transactions?.[0]?.stand?.stand_inventory?.stand_number || "N/A",
          development: upload.development?.name,
          amount: totalAmount,
          status: upload.status,
          createdBy: upload.user_id,
          transactionCount: transactions?.length || 0,
        };
      })
    );

    // Apply additional filters
    let filteredReceipts = receiptsWithDetails;
    
    if (receiptNumber) {
      filteredReceipts = filteredReceipts.filter(r => 
        r.receiptNumber?.toLowerCase().includes(receiptNumber.toLowerCase())
      );
    }

    if (standNumber) {
      filteredReceipts = filteredReceipts.filter(r => 
        r.stand?.toLowerCase().includes(standNumber.toLowerCase())
      );
    }

    if (clientName) {
      filteredReceipts = filteredReceipts.filter(r => 
        r.client?.toLowerCase().includes(clientName.toLowerCase())
      );
    }

    return NextResponse.json({ receipts: filteredReceipts });

  } catch (err) {
    console.error("Unexpected error in GET /api/receipts:", err);
    return NextResponse.json({ 
      error: "Server error", 
      details: err instanceof Error ? err.message : "Unknown error" 
    }, { status: 500 });
  }
}

// POST /api/receipts - Create a new receipt
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const supabase = await createClient();

    // Check for duplicate receipt number
    const { data: existing } = await supabase
      .from("uploads")
      .select("id")
      .eq("file_name", `${body.receiptNumber}.json`)
      .eq("user_id", userId)
      .single();

    if (existing) {
      return NextResponse.json({ 
        error: "Duplicate receipt number", 
        details: "A receipt with this number already exists" 
      }, { status: 409 });
    }

    // Create upload record (receipts are stored as uploads)
    const { data: upload, error: uploadError } = await supabase
      .from("uploads")
      .insert({
        user_id: userId,
        development_id: body.developmentId,
        file_name: `${body.receiptNumber}.json`,
        file_path: `receipts/${userId}/${body.receiptNumber}.json`,
        file_size: 0,
        status: "Completed",
        stands_detected: 1,
        transactions_detected: 1,
        raw_data: { receiptNumber: body.receiptNumber, notes: body.notes },
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (uploadError) {
      console.error("Error creating receipt:", uploadError);
      return NextResponse.json({ 
        error: "Failed to create receipt", 
        details: uploadError.message 
      }, { status: 500 });
    }

    // Create payment transaction for the receipt
    const { data: transaction, error: txError } = await supabase
      .from("payment_transactions")
      .insert({
        user_id: userId,
        upload_id: upload.id,
        development_id: body.developmentId,
        stand_id: body.standId,
        transaction_date: body.receiptDate,
        amount: body.amount,
        reference: body.receiptNumber,
        description: body.notes || `Receipt ${body.receiptNumber}`,
        status: "Matched",
        idempotency_key: `${upload.id}-${body.standId}-receipt`,
      })
      .select()
      .single();

    if (txError) {
      console.error("Error creating transaction:", txError);
      // Don't fail - receipt is created, transaction can be added later
    }

    return NextResponse.json({ 
      receipt: upload, 
      transaction 
    }, { status: 201 });

  } catch (err) {
    console.error("Unexpected error in POST /api/receipts:", err);
    return NextResponse.json({ 
      error: "Server error", 
      details: err instanceof Error ? err.message : "Unknown error" 
    }, { status: 500 });
  }
}
