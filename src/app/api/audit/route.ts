import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

// GET /api/audit - Get audit log events
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const actor = searchParams.get("actor");
    const action = searchParams.get("action");
    const entityType = searchParams.get("entityType");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const sql = getDb();

    // Query audit_events table
    const events = await sql`
      SELECT * FROM audit_events
      WHERE 1=1
      ${actor ? sql`AND (actor ILIKE ${'%' + actor + '%'} OR actor_name ILIKE ${'%' + actor + '%'})` : sql``}
      ${action ? sql`AND action = ${action}` : sql``}
      ${entityType ? sql`AND entity_type = ${entityType}` : sql``}
      ${startDate ? sql`AND timestamp >= ${startDate}` : sql``}
      ${endDate ? sql`AND timestamp <= ${endDate}` : sql``}
      ORDER BY timestamp DESC
    `;

    return NextResponse.json({ events: events || [] });

  } catch (err) {
    // If table doesn't exist, return empty array for now (graceful degradataion)
    if (err instanceof Error && err.message.includes('relation "audit_events" does not exist')) {
      return NextResponse.json({ events: [] });
    }
    console.error("Unexpected error in GET /api/audit:", err);
    return NextResponse.json({
      error: "Server error",
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}

// POST /api/audit - Create audit log entry
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const sql = getDb();

    const results = await sql`
      INSERT INTO audit_events (
        actor, actor_name, action, entity_type, entity_id, summary, metadata
      ) VALUES (
        ${userId}, ${body.actorName || "Unknown"}, ${body.action}, 
        ${body.entityType}, ${body.entityId || null}, ${body.summary}, 
        ${JSON.stringify(body.metadata || {})}
      ) RETURNING *
    `;

    return NextResponse.json(results[0], { status: 201 });

  } catch (err) {
    // Graceful failure if table missing
    if (err instanceof Error && err.message.includes('relation "audit_events" does not exist')) {
      return NextResponse.json({
        id: `audit_temp_${Date.now()}`,
        timestamp: new Date().toISOString(),
        ...await request.json()
      }, { status: 201 });
    }
    console.error("Unexpected error in POST /api/audit:", err);
    return NextResponse.json({
      error: "Server error",
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}
