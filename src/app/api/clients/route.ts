import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

// GET /api/clients - Get all clients for the current user
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");

    const sql = getDb();

    // Optimize with a single query using subqueries for aggregates
    // This avoids N+1 query problem and is much faster
    const clients = await sql`
      SELECT 
        c.*,
        COALESCE(s.stands_count, 0) as stands_count,
        COALESCE(s.total_agreed, 0) as total_agreed,
        COALESCE(s.total_paid, 0) as total_paid
      FROM clients c
      LEFT JOIN (
        SELECT 
          ds.client_id,
          COUNT(ds.id) as stands_count,
          SUM(ds.agreed_price) as total_agreed,
          SUM(COALESCE(tp.total_paid, 0)) as total_paid
        FROM development_stands ds
        LEFT JOIN (
          SELECT stand_id, SUM(amount) as total_paid
          FROM payment_transactions
          GROUP BY stand_id
        ) tp ON ds.id = tp.stand_id
        GROUP BY ds.client_id
      ) s ON c.id = s.client_id
      WHERE c.user_id = ${userId}
      ${search ? sql`AND (c.name ILIKE ${'%' + search + '%'} OR c.phone ILIKE ${'%' + search + '%'} OR c.id_number ILIKE ${'%' + search + '%'})` : sql``}
      ORDER BY c.created_at DESC
    `;

    const transformedClients = clients.map((client: any) => ({
      ...client,
      standsCount: parseInt(client.stands_count || 0),
      totalPaid: parseFloat(client.total_paid || 0),
      totalAgreed: parseFloat(client.total_agreed || 0),
      balance: parseFloat(client.total_agreed || 0) - parseFloat(client.total_paid || 0),
    }));

    return NextResponse.json({ clients: transformedClients });

  } catch (err) {
    console.error("Unexpected error in GET /api/clients:", err);
    return NextResponse.json({
      error: "Server error",
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}

// POST /api/clients - Create a new client
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const sql = getDb();

    const results = await sql`
      INSERT INTO clients (
        user_id, name, email, phone, id_number
      ) VALUES (
        ${userId}, ${body.name}, ${body.email || null}, 
        ${body.phone || null}, ${body.idNumber || null}
      ) RETURNING *
    `;

    return NextResponse.json(results[0], { status: 201 });

  } catch (err) {
    console.error("Unexpected error in POST /api/clients:", err);
    return NextResponse.json({
      error: "Server error",
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}
