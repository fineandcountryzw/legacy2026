import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

// GET /api/transactions - Get transactions for the current user
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const standId = searchParams.get("standId");
    const standInventoryId = searchParams.get("standInventoryId");
    const developmentId = searchParams.get("developmentId");
    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const standalone = searchParams.get("standalone");

    const sql = getDb();

    // Composing the query safely with the sql tag
    const transactions = await sql`
      SELECT 
        t.*,
        si.stand_number as direct_stand_number,
        ds_si.stand_number as linked_stand_number,
        ds.client_name,
        d.name as development_name,
        d.currency
      FROM payment_transactions t
      LEFT JOIN stand_inventory si ON t.stand_inventory_id = si.id
      LEFT JOIN development_stands ds ON t.stand_id = ds.id
      LEFT JOIN stand_inventory ds_si ON ds.stand_inventory_id = ds_si.id
      LEFT JOIN developments d ON t.development_id = d.id
      WHERE t.user_id = ${userId}
      ${standId ? sql`AND t.stand_id = ${standId}` : sql``}
      ${standInventoryId ? sql`AND t.stand_inventory_id = ${standInventoryId}` : sql``}
      ${developmentId ? sql`AND t.development_id = ${developmentId}` : sql``}
      ${status ? sql`AND t.status = ${status}` : sql``}
      ${standalone === "true" ? sql`AND t.development_id IS NULL` : sql``}
      ${startDate ? sql`AND t.transaction_date >= ${startDate}` : sql``}
      ${endDate ? sql`AND t.transaction_date <= ${endDate}` : sql``}
      ORDER BY t.transaction_date DESC
    `;

    const transformedTransactions = transactions.map((t: any) => ({
      id: t.id,
      date: t.transaction_date,
      amount: parseFloat(t.amount || 0),
      reference: t.reference,
      description: t.description,
      category: t.category,
      side: t.side,
      sheetName: t.sheet_name,
      status: t.status,
      standId: t.stand_id,
      standInventoryId: t.stand_inventory_id,
      standNumber: t.linked_stand_number || t.direct_stand_number,
      clientName: t.client_name,
      developmentId: t.development_id,
      developmentName: t.development_name,
      currency: t.currency,
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
    const sql = getDb();

    const results = await sql`
      INSERT INTO payment_transactions (
        user_id, upload_id, development_id, stand_id, stand_inventory_id,
        transaction_date, amount, reference, description, category, side, status,
        idempotency_key
      ) VALUES (
        ${userId}, ${body.uploadId || null}, ${body.developmentId || null}, 
        ${body.standId || null}, ${body.standInventoryId || null},
        ${body.date}, ${body.amount}, ${body.reference}, ${body.description},
        ${body.category}, ${body.side}, ${body.status || "Matched"},
        ${body.idempotencyKey || `${Date.now()}-${body.standId || body.standInventoryId || Math.random()}`}
      ) RETURNING *
    `;

    return NextResponse.json(results[0], { status: 201 });

  } catch (err) {
    console.error("Unexpected error in POST /api/transactions:", err);
    return NextResponse.json({
      error: "Server error",
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}

// PATCH /api/transactions - Assign transactions to a development/stand
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

    const sql = getDb();

    // Case 1: Moving unassigned transactions to a development
    if (developmentId && !standId) {
      // Find all unique stand_inventory_ids involved
      const txs = await sql`
        SELECT DISTINCT stand_inventory_id 
        FROM payment_transactions 
        WHERE id = ANY(${transactionIds}) AND user_id = ${userId}
      `;

      const standInvIds = txs.map(t => t.stand_inventory_id).filter(Boolean);

      for (const invId of standInvIds) {
        // Find or create development_stand for this inventory stand in target development
        const devStandResults = await sql`
          INSERT INTO development_stands (development_id, stand_inventory_id, client_name, status)
          VALUES (${developmentId}, ${invId}, ${clientName || null}, 'Sold')
          ON CONFLICT (development_id, stand_inventory_id) DO UPDATE 
          SET client_name = COALESCE(development_stands.client_name, EXCLUDED.client_name)
          RETURNING id
        `;

        const devStandId = devStandResults[0].id;

        // Update all related transactions
        await sql`
          UPDATE payment_transactions
          SET 
            development_id = ${developmentId},
            stand_id = ${devStandId},
            status = 'Matched'
          WHERE id = ANY(${transactionIds}) AND stand_inventory_id = ${invId} AND user_id = ${userId}
        `;
      }

      return NextResponse.json({ success: true, assigned: transactionIds.length });
    }

    // Case 2: Simple update (setting standId or clearing developmentId)
    const results = await sql`
      UPDATE payment_transactions
      SET
        development_id = ${developmentId || null},
        stand_id = ${standId || null},
        status = ${developmentId ? "Matched" : "Unmatched"}
      WHERE id = ANY(${transactionIds}) AND user_id = ${userId}
      RETURNING id
    `;

    return NextResponse.json({ success: true, assigned: results.length });

  } catch (err) {
    console.error("Unexpected error in PATCH /api/transactions:", err);
    return NextResponse.json({
      error: "Server error",
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}
