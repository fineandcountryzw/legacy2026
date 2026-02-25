import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/transactions - Get all transactions for the current user
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const standId = searchParams.get("standId");
    const developmentId = searchParams.get("developmentId");
    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const supabase = await createClient();

    let query = supabase
      .from("payment_transactions")
      .select(`
        *,
        stand:stand_id (
          stand_inventory:stand_inventory_id (
            stand_number
          ),
          client_name
        ),
        development:development_id (
          name,
          currency
        )
      `)
      .eq("user_id", userId)
      .order("transaction_date", { ascending: false });

    if (standId) {
      query = query.eq("stand_id", standId);
    }

    if (developmentId) {
      query = query.eq("development_id", developmentId);
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (startDate) {
      query = query.gte("transaction_date", startDate);
    }

    if (endDate) {
      query = query.lte("transaction_date", endDate);
    }

    const { data: transactions, error } = await query;

    if (error) {
      console.error("Error fetching transactions:", error);
      return NextResponse.json({ 
        error: "Database error", 
        details: error.message 
      }, { status: 500 });
    }

    const transformedTransactions = (transactions || []).map((t: any) => ({
      id: t.id,
      date: t.transaction_date,
      amount: t.amount,
      reference: t.reference,
      description: t.description,
      status: t.status,
      standId: t.stand_id,
      standNumber: t.stand?.stand_inventory?.stand_number,
      clientName: t.stand?.client_name,
      developmentId: t.development_id,
      developmentName: t.development?.name,
      currency: t.development?.currency,
      sourceRowIndex: t.source_row_index,
    }));

    return NextResponse.json({ transactions: transformedTransactions });

  } catch (err) {
    console.error("Unexpected error in GET /api/transactions:", err);
    return NextResponse.json({ 
      error: "Server error", 
      details: err instanceof Error ? err.message : "Unknown error" 
    }, { status: 500 });
  }
}

// POST /api/transactions - Create a new transaction
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const supabase = await createClient();

    const { data: transaction, error } = await supabase
      .from("payment_transactions")
      .insert({
        user_id: userId,
        upload_id: body.uploadId,
        development_id: body.developmentId,
        stand_id: body.standId,
        transaction_date: body.date,
        amount: body.amount,
        reference: body.reference,
        description: body.description,
        status: body.status || "Matched",
        idempotency_key: body.idempotencyKey || `${Date.now()}-${body.standId}`,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating transaction:", error);
      return NextResponse.json({ 
        error: "Failed to create transaction", 
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json(transaction, { status: 201 });

  } catch (err) {
    console.error("Unexpected error in POST /api/transactions:", err);
    return NextResponse.json({ 
      error: "Server error", 
      details: err instanceof Error ? err.message : "Unknown error" 
    }, { status: 500 });
  }
}
