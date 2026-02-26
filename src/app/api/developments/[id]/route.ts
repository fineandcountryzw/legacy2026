import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

// PATCH /api/developments/[id] - Update development
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
    const body = await request.json();
    const sql = getDb();

    const results = await sql`
      UPDATE developments
      SET 
        developer_name = ${body.developerName},
        developer_contacts = ${body.developerContacts},
        email = ${body.email},
        phone = ${body.phone},
        address = ${body.address},
        website = ${body.website},
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING *
    `;

    if (results.length === 0) {
      return NextResponse.json({ error: "Development not found" }, { status: 404 });
    }

    return NextResponse.json(results[0]);
  } catch (err) {
    console.error("Unexpected error in PATCH /api/developments/[id]:", err);
    return NextResponse.json({
      error: "Server error",
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}

// GET /api/developments/[id] - Get single development
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

    const results = await sql`
      SELECT * FROM developments 
      WHERE id = ${id} AND user_id = ${userId}
    `;

    if (results.length === 0) {
      return NextResponse.json({ error: "Development not found" }, { status: 404 });
    }

    return NextResponse.json(results[0]);
  } catch (err) {
    console.error("Unexpected error in GET /api/developments/[id]:", err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}
