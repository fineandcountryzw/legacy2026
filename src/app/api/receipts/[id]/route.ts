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
 * GET /api/receipts/:id
 * Get a specific receipt
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
      SELECT 
        r.*,
        ds.stand_number,
        d.name as development_name,
        c.name as client_name
      FROM receipts r
      LEFT JOIN development_stands ds ON r.stand_id = ds.id
      LEFT JOIN developments d ON ds.development_id = d.id
      LEFT JOIN clients c ON ds.client_id = c.id
      WHERE r.id = ${id} AND r.user_id = ${userId}
    `;
    
    if (result.length === 0) {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
    }
    
    return NextResponse.json({ receipt: result[0] });
  } catch (err) {
    console.error("Error in GET /api/receipts/[id]:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/receipts/:id
 * Delete a receipt
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
      SELECT id FROM receipts WHERE id = ${id} AND user_id = ${userId}
    `;
    
    if (existing.length === 0) {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
    }
    
    // Delete receipt
    await db`DELETE FROM receipts WHERE id = ${id}`;
    
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error in DELETE /api/receipts/[id]:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
