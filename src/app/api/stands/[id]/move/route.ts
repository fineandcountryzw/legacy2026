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
 * POST /api/stands/:id/move
 * Move a stand to a different development
 */
export async function POST(
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
    
    // Validate required fields
    if (!body.newDevelopmentId) {
      return NextResponse.json({ error: "New development ID is required" }, { status: 400 });
    }
    
    // Check if stand exists and belongs to user
    const existing = await db`
      SELECT ds.*, d.user_id FROM development_stands ds
      JOIN developments d ON ds.development_id = d.id
      WHERE ds.id = ${id} AND d.user_id = ${userId}
    `;
    
    if (existing.length === 0) {
      return NextResponse.json({ error: "Stand not found" }, { status: 404 });
    }
    
    // Check if new development exists and belongs to user
    const newDev = await db`
      SELECT id FROM developments WHERE id = ${body.newDevelopmentId} AND user_id = ${userId}
    `;
    
    if (newDev.length === 0) {
      return NextResponse.json({ error: "Target development not found" }, { status: 404 });
    }
    
    // Update stand
    const result = await db`
      UPDATE development_stands
      SET development_id = ${body.newDevelopmentId},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    
    return NextResponse.json({ stand: result[0] });
  } catch (err) {
    console.error("Error in POST /api/stands/[id]/move:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
