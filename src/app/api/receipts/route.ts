import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

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

    const sql = getDb();

    // Optimize with a single query joining uploads and transactions
    const receipts = await sql`
      SELECT 
        u.id,
        u.file_name as receipt_number,
        u.created_at as date,
        u.status,
        u.user_id as created_by,
        d.name as development_name,
        COALESCE(t.total_amount, 0) as amount,
        COALESCE(t.tx_count, 0) as transaction_count,
        t.client_name,
        t.stand_number
      FROM uploads u
      LEFT JOIN developments d ON u.development_id = d.id
      LEFT JOIN (
        SELECT 
          tp.upload_id,
          SUM(tp.amount) as total_amount,
          COUNT(tp.id) as tx_count,
          MAX(ds.client_name) as client_name,
          MAX(si.stand_number) as stand_number
        FROM payment_transactions tp
        LEFT JOIN development_stands ds ON tp.stand_id = ds.id
        LEFT JOIN stand_inventory si ON tp.stand_inventory_id = si.id
        GROUP BY tp.upload_id
      ) t ON u.id = t.upload_id
      WHERE u.user_id = ${userId}
      -- Filter by 'receipts' (which are stored as uploads with .json extension or specifically marked)
      -- In this app, manually created receipts follow a specific naming convention or we can filter by raw_data presence
      AND (u.file_name ILIKE '%.json' OR u.raw_data->>'receiptNumber' IS NOT NULL)
      ${developmentId ? sql`AND u.development_id = ${developmentId}` : sql``}
      ${startDate ? sql`AND u.created_at >= ${startDate}` : sql``}
      ${endDate ? sql`AND u.created_at <= ${endDate}` : sql``}
      ${receiptNumber ? sql`AND u.file_name ILIKE ${'%' + receiptNumber + '%'}` : sql``}
      ${standNumber ? sql`AND t.stand_number ILIKE ${'%' + standNumber + '%'}` : sql``}
      ${clientName ? sql`AND t.client_name ILIKE ${'%' + clientName + '%'}` : sql``}
      ORDER BY u.created_at DESC
    `;

    const transformedReceipts = receipts.map((r: any) => ({
      id: r.id,
      receiptNumber: r.receipt_number?.replace(/\.[^/.]+$/, ""),
      date: r.date,
      client: r.client_name || "N/A",
      stand: r.stand_number || "N/A",
      development: r.development_name,
      amount: parseFloat(r.amount || 0),
      status: r.status,
      createdBy: r.created_by,
      transactionCount: parseInt(r.transaction_count || 0),
    }));

    return NextResponse.json({ receipts: transformedReceipts });

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
    const sql = getDb();

    // Check for duplicate receipt number
    const existing = await sql`
      SELECT id FROM uploads 
      WHERE file_name = ${body.receiptNumber + '.json'} AND user_id = ${userId}
    `;

    if (existing.length > 0) {
      return NextResponse.json({
        error: "Duplicate receipt number",
        details: "A receipt with this number already exists"
      }, { status: 409 });
    }

    // Create upload record
    const uploadResults = await sql`
      INSERT INTO uploads (
        user_id, development_id, file_name, file_path, 
        file_size, status, stands_detected, transactions_detected, raw_data,
        completed_at
      ) VALUES (
        ${userId}, ${body.developmentId}, ${body.receiptNumber + '.json'}, 
        ${`receipts/${userId}/${body.receiptNumber}.json`}, 0, 
        'Completed', 1, 1, 
        ${JSON.stringify({ receiptNumber: body.receiptNumber, notes: body.notes })},
        NOW()
      ) RETURNING *
    `;

    const upload = uploadResults[0];

    // Create payment transaction for the receipt
    const txResults = await sql`
      INSERT INTO payment_transactions (
        user_id, upload_id, development_id, stand_id, transaction_date,
        amount, reference, description, status, idempotency_key
      ) VALUES (
        ${userId}, ${upload.id}, ${body.developmentId}, ${body.standId},
        ${body.receiptDate}, ${body.amount}, ${body.receiptNumber},
        ${body.notes || `Receipt ${body.receiptNumber}`}, 'Matched',
        ${upload.id + '-' + body.standId + '-receipt'}
      ) RETURNING *
    `;

    return NextResponse.json({
      receipt: upload,
      transaction: txResults[0]
    }, { status: 201 });

  } catch (err) {
    console.error("Unexpected error in POST /api/receipts:", err);
    return NextResponse.json({
      error: "Server error",
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}
