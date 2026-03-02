import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

function sql() {
  return getDb();
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/clients/:id
 * Get a specific client
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { id } = await params;
    const db = getDb();
    
    const result = await db`
      SELECT * FROM clients
      WHERE id = ${id} AND user_id = ${userId}
    `;
    
    if (result.length === 0) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    
    return NextResponse.json({ client: result[0] });
  } catch (err) {
    console.error("Error in GET /api/clients/[id]:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/clients/:id
 * Update a client
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { id } = await params;
    const body = await request.json();
    const db = getDb();
    
    // Check ownership
    const existing = await db`
      SELECT id FROM clients WHERE id = ${id} AND user_id = ${userId}
    `;
    
    if (existing.length === 0) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    
    // Update client
    const result = await db`
      UPDATE clients
      SET 
        name = ${body.name},
        email = ${body.email || null},
        phone = ${body.phone || null},
        address = ${body.address || null},
        id_number = ${body.idNumber || null},
        notes = ${body.notes || null},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    
    return NextResponse.json({ client: result[0] });
  } catch (err) {
    console.error("Error in PUT /api/clients/[id]:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/clients/:id
 * Delete a client
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { id } = await params;
    const db = getDb();
    
    // Check ownership
    const existing = await db`
      SELECT id FROM clients WHERE id = ${id} AND user_id = ${userId}
    `;
    
    if (existing.length === 0) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    
    // Delete client
    await db`
      DELETE FROM clients WHERE id = ${id}
    `;
    
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error in DELETE /api/clients/[id]:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
