import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

// GET /api/stands/[id] - Get stand details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: rawId } = await params;
    const sql = getDb();

    let standWithDetails;

    if (rawId.startsWith("standalone-")) {
      const inventoryId = rawId.replace("standalone-", "");

      // Fetch standalone stand details
      const invResults = await sql`
        SELECT id, stand_number, canonical_stand_key
        FROM stand_inventory
        WHERE id = ${inventoryId}
      `;

      const standInv = invResults[0];
      if (!standInv) {
        return NextResponse.json({ error: "Standalone stand not found" }, { status: 404 });
      }

      // Get transactions for this standalone stand for THIS user
      const transactions = await sql`
        SELECT * FROM payment_transactions
        WHERE stand_inventory_id = ${standInv.id} AND user_id = ${userId} AND stand_id IS NULL
        ORDER BY transaction_date DESC
      `;

      const totalPaid = transactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

      standWithDetails = {
        id: rawId,
        standNumber: standInv.stand_number,
        developmentId: null,
        developmentName: null,
        developerName: null,
        currency: "USD",
        standTypeLabel: null,
        standSize: null,
        status: "Unassigned",
        clientName: null,
        agreedPrice: 0,
        totalPaid,
        balance: -totalPaid,
        transactions: transactions || [],
      };
    } else {
      // Fetch linked stand details
      const standResults = await sql`
        SELECT 
          ds.id, ds.agreed_price, ds.status, ds.client_name, ds.client_id,
          si.stand_number,
          d.id as development_id, d.name as development_name, d.currency, d.developer_name,
          st.label as stand_type_label, st.size_sqm, st.base_price as stand_type_base_price,
          c.phone as client_phone, c.email as client_email
        FROM development_stands ds
        JOIN stand_inventory si ON ds.stand_inventory_id = si.id
        JOIN developments d ON ds.development_id = d.id
        LEFT JOIN development_stand_types st ON ds.stand_type_id = st.id
        LEFT JOIN clients c ON ds.client_id = c.id
        WHERE ds.id = ${rawId} AND d.user_id = ${userId}
      `;

      const stand = standResults[0];
      if (!stand) {
        return NextResponse.json({ error: "Stand not found" }, { status: 404 });
      }

      // Get transactions for this stand
      const transactions = await sql`
        SELECT * FROM payment_transactions
        WHERE stand_id = ${stand.id}
        ORDER BY transaction_date DESC
      `;

      const totalPaid = transactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
      // Use agreed_price if set, otherwise fall back to stand type base_price
      const standAgreedPrice = parseFloat(stand.agreed_price || 0);
      const standTypeBasePrice = parseFloat(stand.stand_type_base_price || 0);
      const agreedPrice = standAgreedPrice > 0 ? standAgreedPrice : standTypeBasePrice;

      standWithDetails = {
        id: stand.id,
        standNumber: stand.stand_number,
        developmentId: stand.development_id,
        developmentName: stand.development_name,
        developerName: stand.developer_name,
        currency: stand.currency,
        standTypeLabel: stand.stand_type_label,
        standSize: stand.size_sqm,
        status: stand.status,
        clientName: stand.client_name,
        clientPhone: stand.client_phone,
        clientEmail: stand.client_email,
        agreedPrice,
        totalPaid,
        balance: agreedPrice - totalPaid,
        transactions: transactions || [],
      };
    }

    return NextResponse.json(standWithDetails);

  } catch (err) {
    console.error("Unexpected error in GET /api/stands/[id]:", err);
    return NextResponse.json({
      error: "Server error",
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}

// PATCH /api/stands/[id] - Partial update stand
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    if (id.startsWith("standalone-")) {
      return NextResponse.json({ error: "Cannot directly update unassigned stands. Link them to a development first." }, { status: 400 });
    }

    const body = await request.json();
    const sql = getDb();

    // Verify ownership via development
    const ownership = await sql`
      SELECT ds.id FROM development_stands ds
      JOIN developments d ON ds.development_id = d.id
      WHERE ds.id = ${id} AND d.user_id = ${userId}
    `;

    if (ownership.length === 0) {
      return NextResponse.json({ error: "Unauthorized or stand not found" }, { status: 404 });
    }

    // Build dynamic update using sql template
    const updates: any[] = [];

    if (body.agreedPrice !== undefined) {
      updates.push(sql`agreed_price = ${body.agreedPrice}`);
    }
    if (body.status !== undefined) {
      updates.push(sql`status = ${body.status}`);
    }
    if (body.clientName !== undefined) {
      updates.push(sql`client_name = ${body.clientName}`);
    }
    if (body.clientId !== undefined) {
      updates.push(sql`client_id = ${body.clientId}`);
    }
    if (body.standTypeId !== undefined) {
      updates.push(sql`stand_type_id = ${body.standTypeId}`);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    // Simple update for client assignment (most common case)
    if (body.clientName !== undefined && updates.length === 1) {
      const results = await sql`
        UPDATE development_stands
        SET client_name = ${body.clientName}, updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
      return NextResponse.json(results[0]);
    }

    // For multiple fields, update individually
    if (body.agreedPrice !== undefined) {
      await sql`UPDATE development_stands SET agreed_price = ${body.agreedPrice} WHERE id = ${id}`;
    }
    if (body.status !== undefined) {
      await sql`UPDATE development_stands SET status = ${body.status} WHERE id = ${id}`;
    }
    if (body.clientName !== undefined) {
      await sql`UPDATE development_stands SET client_name = ${body.clientName} WHERE id = ${id}`;
    }
    if (body.clientId !== undefined) {
      await sql`UPDATE development_stands SET client_id = ${body.clientId} WHERE id = ${id}`;
    }
    if (body.standTypeId !== undefined) {
      await sql`UPDATE development_stands SET stand_type_id = ${body.standTypeId} WHERE id = ${id}`;
    }

    // Return updated record
    const results = await sql`SELECT * FROM development_stands WHERE id = ${id}`;
    return NextResponse.json(results[0]);

  } catch (err) {
    console.error("Unexpected error in PATCH /api/stands/[id]:", err);
    return NextResponse.json({
      error: "Server error",
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}

// PUT /api/stands/[id] - Update stand (full update)
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

    if (id.startsWith("standalone-")) {
      return NextResponse.json({ error: "Cannot directly update unassigned stands. Link them to a development first." }, { status: 400 });
    }

    const body = await request.json();
    const sql = getDb();

    // Verify ownership via development
    const ownership = await sql`
      SELECT ds.id FROM development_stands ds
      JOIN developments d ON ds.development_id = d.id
      WHERE ds.id = ${id} AND d.user_id = ${userId}
    `;

    if (ownership.length === 0) {
      return NextResponse.json({ error: "Unauthorized or stand not found" }, { status: 404 });
    }

    const results = await sql`
      UPDATE development_stands
      SET 
        agreed_price = ${body.agreedPrice},
        status = ${body.status},
        client_name = ${body.clientName},
        stand_type_id = ${body.standTypeId}
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json(results[0]);

  } catch (err) {
    console.error("Unexpected error in PUT /api/stands/[id]:", err);
    return NextResponse.json({
      error: "Server error",
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}

// DELETE /api/stands/[id] - Delete stand
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

    if (id.startsWith("standalone-")) {
      return NextResponse.json({ error: "Cannot delete inventory-level stands." }, { status: 400 });
    }

    // Verify ownership 
    const ownership = await sql`
      SELECT ds.id FROM development_stands ds
      JOIN developments d ON ds.development_id = d.id
      WHERE ds.id = ${id} AND d.user_id = ${userId}
    `;

    if (ownership.length === 0) {
      return NextResponse.json({ error: "Unauthorized or stand not found" }, { status: 404 });
    }

    await sql`DELETE FROM development_stands WHERE id = ${id}`;

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("Unexpected error in DELETE /api/stands/[id]:", err);
    return NextResponse.json({
      error: "Server error",
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}
