import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

function sql() {
  return getDb();
}

/**
 * GET /api/transactions
 * Get all payment transactions for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const standId = searchParams.get("standId");
    const type = searchParams.get("type");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    
    const db = getDb();
    
    let query = db`
      SELECT 
        pt.*,
        ds.stand_number,
        d.name as development_name,
        c.name as client_name
      FROM payment_transactions pt
      LEFT JOIN development_stands ds ON pt.stand_id = ds.id
      LEFT JOIN developments d ON ds.development_id = d.id
      LEFT JOIN clients c ON ds.client_id = c.id
      WHERE pt.user_id = ${userId}
    `;
    
    if (standId) {
      query = db`${query} AND pt.stand_id = ${standId}`;
    }
    
    if (type) {
      query = db`${query} AND pt.type = ${type}`;
    }
    
    if (dateFrom) {
      query = db`${query} AND pt.date >= ${dateFrom}`;
    }
    
    if (dateTo) {
      query = db`${query} AND pt.date <= ${dateTo}`;
    }
    
    query = db`
      ${query}
      ORDER BY pt.date DESC, pt.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    const transactions = await query;
    
    return NextResponse.json({ transactions });
  } catch (err) {
    console.error("Error in GET /api/transactions:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/transactions
 * Create a new payment transaction
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
    if (!body.standId || !body.amount || !body.date) {
      return NextResponse.json({ error: "Stand ID, amount, and date are required" }, { status: 400 });
    }
    
    // Create transaction
    const result = await db`
      INSERT INTO payment_transactions (
        user_id,
        stand_id,
        type,
        amount,
        date,
        reference,
        description,
        payment_method,
        receipt_number
      ) VALUES (
        ${userId},
        ${body.standId},
        ${body.type || 'payment'},
        ${body.amount},
        ${body.date},
        ${body.reference || null},
        ${body.description || null},
        ${body.paymentMethod || null},
        ${body.receiptNumber || null}
      )
      RETURNING *
    `;
    
    return NextResponse.json({ transaction: result[0] }, { status: 201 });
  } catch (err) {
    console.error("Error in POST /api/transactions:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
