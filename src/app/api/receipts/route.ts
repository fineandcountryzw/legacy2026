import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

function sql() {
  return getDb();
}

/**
 * GET /api/receipts
 * Get all receipts for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const standId = searchParams.get("standId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    
    const db = getDb();
    
    let query = db`
      SELECT 
        r.*,
        ds.stand_number,
        d.name as development_name,
        c.name as client_name
      FROM receipts r
      LEFT JOIN development_stands ds ON r.stand_id = ds.id
      LEFT JOIN developments d ON ds.development_id = d.id
      LEFT JOIN clients c ON ds.client_id = c.id
      WHERE r.user_id = ${userId}
    `;
    
    if (standId) {
      query = db`${query} AND r.stand_id = ${standId}`;
    }
    
    if (dateFrom) {
      query = db`${query} AND r.receipt_date >= ${dateFrom}`;
    }
    
    if (dateTo) {
      query = db`${query} AND r.receipt_date <= ${dateTo}`;
    }
    
    query = db`
      ${query}
      ORDER BY r.receipt_date DESC, r.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    const receipts = await query;
    
    return NextResponse.json({ receipts });
  } catch (err) {
    console.error("Error in GET /api/receipts:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/receipts
 * Create a new receipt
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const body = await request.json();
    const db = getDb();
    
    // Validate required fields
    if (!body.standId || !body.amount || !body.receiptDate) {
      return NextResponse.json({ error: "Stand ID, amount, and receipt date are required" }, { status: 400 });
    }
    
    // Create receipt
    const result = await db`
      INSERT INTO receipts (
        user_id,
        stand_id,
        receipt_number,
        receipt_date,
        amount,
        payment_type,
        payment_method,
        reference,
        notes
      ) VALUES (
        ${userId},
        ${body.standId},
        ${body.receiptNumber || null},
        ${body.receiptDate},
        ${body.amount},
        ${body.paymentType || 'deposit'},
        ${body.paymentMethod || null},
        ${body.reference || null},
        ${body.notes || null}
      )
      RETURNING *
    `;
    
    return NextResponse.json({ receipt: result[0] }, { status: 201 });
  } catch (err) {
    console.error("Error in POST /api/receipts:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
