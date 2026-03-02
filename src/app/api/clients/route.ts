import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

function sql() {
  return getDb();
}

/**
 * GET /api/clients
 * Get all clients for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    
    const db = getDb();
    
    let query = db`
      SELECT * FROM clients
      WHERE user_id = ${userId}
    `;
    
    if (search) {
      query = db`
        ${query}
        AND (
          name ILIKE ${'%' + search + '%'}
          OR email ILIKE ${'%' + search + '%'}
          OR phone ILIKE ${'%' + search + '%'}
        )
      `;
    }
    
    query = db`
      ${query}
      ORDER BY created_at DESC
    `;
    
    const clients = await query;
    
    return NextResponse.json({ clients });
  } catch (err) {
    console.error("Error in GET /api/clients:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clients
 * Create a new client
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
    if (!body.name) {
      return NextResponse.json({ error: "Client name is required" }, { status: 400 });
    }
    
    // Create client
    const result = await db`
      INSERT INTO clients (
        user_id,
        name,
        email,
        phone,
        address,
        id_number,
        notes
      ) VALUES (
        ${userId},
        ${body.name},
        ${body.email || null},
        ${body.phone || null},
        ${body.address || null},
        ${body.idNumber || null},
        ${body.notes || null}
      )
      RETURNING *
    `;
    
    return NextResponse.json({ client: result[0] }, { status: 201 });
  } catch (err) {
    console.error("Error in POST /api/clients:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
