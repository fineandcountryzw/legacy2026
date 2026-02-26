import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

// GET /api/receipts/[id] - Get receipt details
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

    const uploadResults = await sql`
      SELECT 
        u.*,
        d.name as development_name,
        d.currency
      FROM uploads u
      LEFT JOIN developments d ON u.development_id = d.id
      WHERE u.id = ${id} AND u.user_id = ${userId}
    `;

    const upload = uploadResults[0];
    if (!upload) {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
    }

    // Get transactions for this receipt
    const transactions = await sql`
      SELECT 
        tp.*,
        si.stand_number,
        ds.client_name,
        d.name as development_name
      FROM payment_transactions tp
      LEFT JOIN development_stands ds ON tp.stand_id = ds.id
      LEFT JOIN stand_inventory si ON ds.stand_inventory_id = si.id
      LEFT JOIN developments d ON tp.development_id = d.id
      WHERE tp.upload_id = ${id}
    `;

    const receiptWithDetails = {
      id: upload.id,
      receiptNumber: upload.file_name?.replace(/\.[^/.]+$/, ""),
      date: upload.created_at,
      status: upload.status,
      development: {
        name: upload.development_name,
        currency: upload.currency
      },
      rawData: upload.raw_data,
      transactions: transactions || [],
      totalAmount: transactions?.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0) || 0,
    };

    return NextResponse.json(receiptWithDetails);

  } catch (err) {
    console.error("Unexpected error in GET /api/receipts/[id]:", err);
    return NextResponse.json({
      error: "Server error",
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}

// PUT /api/receipts/[id] - Void a receipt (update status)
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

    // Update upload status
    const results = await sql`
      UPDATE uploads
      SET 
        status = ${body.status || "Completed"},
        error_message = ${body.notes || null}
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING *
    `;

    if (results.length === 0) {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
    }

    // If voiding, update related transactions
    if (body.status === "Failed") {
      await sql`
        UPDATE payment_transactions
        SET status = 'Voided'
        WHERE upload_id = ${id}
      `;
    }

    return NextResponse.json(results[0]);

  } catch (err) {
    console.error("Unexpected error in PUT /api/receipts/[id]:", err);
    return NextResponse.json({
      error: "Server error",
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}

// DELETE /api/receipts/[id] - Delete receipt
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

    // First delete related transactions
    await sql`DELETE FROM payment_transactions WHERE upload_id = ${id}`;

    // Then delete the upload (receipt)
    const results = await sql`
      DELETE FROM uploads WHERE id = ${id} AND user_id = ${userId} RETURNING id
    `;

    if (results.length === 0) {
      return NextResponse.json({ error: "Receipt not found or already deleted" }, { status: 404 });
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("Unexpected error in DELETE /api/receipts/[id]:", err);
    return NextResponse.json({
      error: "Server error",
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}
