import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

// GET /api/clients/[id] - Get client details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const sql = getDb();

    // 1. Fetch client metadata
    const clientResults = await sql`
      SELECT * FROM clients
      WHERE id = ${id} AND user_id = ${userId}
    `;

    const client = clientResults[0];
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // 2. Fetch stands for this client with balances
    const standsWithBalances = await sql`
      SELECT 
        ds.id,
        ds.agreed_price,
        ds.status,
        d.name as development_name,
        d.currency,
        si.stand_number,
        COALESCE(tp.total_paid, 0) as total_paid
      FROM development_stands ds
      JOIN developments d ON ds.development_id = d.id
      JOIN stand_inventory si ON ds.stand_inventory_id = si.id
      LEFT JOIN (
        SELECT stand_id, SUM(amount) as total_paid
        FROM payment_transactions
        GROUP BY stand_id
      ) tp ON ds.id = tp.stand_id
      WHERE ds.client_id = ${id}
    `;

    const parsedStands = standsWithBalances.map((s: any) => ({
      id: s.id,
      standNumber: s.stand_number,
      developmentName: s.development_name,
      currency: s.currency,
      status: s.status,
      agreedPrice: parseFloat(s.agreed_price || 0),
      totalPaid: parseFloat(s.total_paid || 0),
      balance: parseFloat(s.agreed_price || 0) - parseFloat(s.total_paid || 0),
    }));

    // 3. Fetch receipts/payments for this client
    const receipts = await sql`
      SELECT 
        t.*,
        si.stand_number
      FROM payment_transactions t
      LEFT JOIN development_stands ds ON t.stand_id = ds.id
      LEFT JOIN stand_inventory si ON ds.stand_inventory_id = si.id
      WHERE t.client_id = ${id}
      ORDER BY t.transaction_date DESC
    `;

    const totalPaid = parsedStands.reduce((sum, s) => sum + s.totalPaid, 0);
    const totalBalance = parsedStands.reduce((sum, s) => sum + s.balance, 0);

    const clientWithDetails = {
      ...client,
      stands: parsedStands,
      receipts: receipts || [],
      totalPaid,
      totalBalance,
    };

    return NextResponse.json(clientWithDetails);

  } catch (err) {
    console.error("Unexpected error in GET /api/clients/[id]:", err);
    return NextResponse.json({
      error: "Server error",
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}

// PUT /api/clients/[id] - Update client
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const sql = getDb();

    const results = await sql`
      UPDATE clients
      SET
        name = ${body.name},
        email = ${body.email || null},
        phone = ${body.phone || null},
        id_number = ${body.idNumber || null},
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING *
    `;

    if (results.length === 0) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return NextResponse.json(results[0]);

  } catch (err) {
    console.error("Unexpected error in PUT /api/clients/[id]:", err);
    return NextResponse.json({
      error: "Server error",
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}

// DELETE /api/clients/[id] - Delete client
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const sql = getDb();

    const results = await sql`
      DELETE FROM clients WHERE id = ${id} AND user_id = ${userId} RETURNING id
    `;

    if (results.length === 0) {
      return NextResponse.json({ error: "Client not found or already deleted" }, { status: 404 });
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("Unexpected error in DELETE /api/clients/[id]:", err);
    return NextResponse.json({
      error: "Server error",
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}
