import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/transactions - Get transactions for the current user
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const standId = searchParams.get("standId");           // development_stands.id
    const standInventoryId = searchParams.get("standInventoryId"); // stand_inventory.id (standalone)
    const developmentId = searchParams.get("developmentId");
    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const standalone = searchParams.get("standalone");     // "true" = only unmatched

    const supabase = await createClient();

    let query = supabase
      .from("payment_transactions")
      .select(`
        *,
        stand:stand_id (
          stand_inventory:stand_inventory_id (
            stand_number
          ),
          client_name,
          development:development_id (
            name,
            currency
          )
        ),
        stand_inventory:stand_inventory_id (
          stand_number
        )
      `)
      .eq("user_id", userId)
      .order("transaction_date", { ascending: false });

    // Filter by development_stands.id (linked stands)
    if (standId) {
      query = query.eq("stand_id", standId);
    }

    // Filter by stand_inventory.id (standalone/unlinked stands)
    if (standInventoryId) {
      query = query.eq("stand_inventory_id", standInventoryId);
    }

    if (developmentId) {
      query = query.eq("development_id", developmentId);
    }

    if (status) {
      query = query.eq("status", status);
    }

    // Only return unmatched (standalone) transactions
    if (standalone === "true") {
      query = query.is("development_id", null);
    }

    if (startDate) {
      query = query.gte("transaction_date", startDate);
    }

    if (endDate) {
      query = query.lte("transaction_date", endDate);
    }

    const { data: transactions, error } = await query;

    console.log(`[Transactions API] standId=${standId}, standInventoryId=${standInventoryId}, userId=${userId}`);
    console.log(`[Transactions API] Found ${transactions?.length || 0} transactions`);

    if (error) {
      console.error("Error fetching transactions:", error);
      return NextResponse.json({
        error: "Database error",
        details: error.message
      }, { status: 500 });
    }

    const transformedTransactions = (transactions || []).map((t: any) => {
      // Resolve stand number: prefer linked stand, fall back to direct stand_inventory link
      const linkedStandInventory = Array.isArray(t.stand?.stand_inventory)
        ? t.stand?.stand_inventory[0]
        : t.stand?.stand_inventory;
      const directStandInventory = Array.isArray(t.stand_inventory)
        ? t.stand_inventory[0]
        : t.stand_inventory;
      const development = Array.isArray(t.stand?.development)
        ? t.stand?.development[0]
        : t.stand?.development;

      return {
        id: t.id,
        date: t.transaction_date,
        amount: t.amount,
        reference: t.reference,
        description: t.description,
        category: t.category,
        side: t.side,
        sheetName: t.sheet_name,
        status: t.status,
        standId: t.stand_id,
        standInventoryId: t.stand_inventory_id,
        standNumber: linkedStandInventory?.stand_number || directStandInventory?.stand_number,
        clientName: t.stand?.client_name,
        developmentId: t.development_id,
        developmentName: development?.name,
        currency: development?.currency,
        sourceRowIndex: t.source_row_index,
      };
    });

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
        development_id: body.developmentId || null,
        stand_id: body.standId,
        stand_inventory_id: body.standInventoryId,
        transaction_date: body.date,
        amount: body.amount,
        reference: body.reference,
        description: body.description,
        category: body.category,
        side: body.side,
        status: body.status || "Matched",
        idempotency_key: body.idempotencyKey || `${Date.now()}-${body.standId || body.standInventoryId}`,
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

// PATCH /api/transactions - Assign transactions to a development/stand (deferred assignment)
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { transactionIds, developmentId, standId, clientName } = body;

    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json({ error: "transactionIds array required" }, { status: 400 });
    }

    const supabase = await createClient();

    // If standId is provided, resolve or create the development_stands link
    let devStandId = standId || null;

    if (developmentId && !standId) {
      // Find or create a development_stands record for each unique stand_inventory_id
      // Get all unique stand_inventory_ids from selected transactions
      const { data: txs } = await supabase
        .from("payment_transactions")
        .select("stand_inventory_id")
        .in("id", transactionIds)
        .eq("user_id", userId);

      const uniqueStandInvIds = [...new Set((txs || []).map((t: any) => t.stand_inventory_id).filter(Boolean))];

      for (const invId of uniqueStandInvIds) {
        const { data: devStand } = await supabase
          .from("development_stands")
          .upsert({
            development_id: developmentId,
            stand_inventory_id: invId,
            client_name: clientName || null,
            status: 'Sold'
          }, { onConflict: "development_id,stand_inventory_id" })
          .select()
          .single();

        if (devStand) {
          // Update transactions for this specific stand
          await supabase
            .from("payment_transactions")
            .update({
              development_id: developmentId,
              stand_id: devStand.id,
              status: "Matched"
            })
            .in("id", transactionIds)
            .eq("stand_inventory_id", invId)
            .eq("user_id", userId);
        }
      }

      return NextResponse.json({ success: true, assigned: transactionIds.length });
    }

    // Simple update: just set development_id / stand_id
    const { error } = await supabase
      .from("payment_transactions")
      .update({
        development_id: developmentId || null,
        stand_id: devStandId,
        status: developmentId ? "Matched" : "Unmatched"
      })
      .in("id", transactionIds)
      .eq("user_id", userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, assigned: transactionIds.length });

  } catch (err) {
    console.error("Unexpected error in PATCH /api/transactions:", err);
    return NextResponse.json({
      error: "Server error",
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}
