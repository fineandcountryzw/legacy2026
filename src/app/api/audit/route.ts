import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

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

    const supabase = await createClient();

    // Query audit_events table (create this table in your database)
    let query = supabase
      .from("audit_events")
      .select("*")
      .order("timestamp", { ascending: false });

    if (actor) {
      query = query.ilike("actor", `%${actor}%`);
    }

    if (action) {
      query = query.eq("action", action);
    }

    if (entityType) {
      query = query.eq("entity_type", entityType);
    }

    if (startDate) {
      query = query.gte("timestamp", startDate);
    }

    if (endDate) {
      query = query.lte("timestamp", endDate);
    }

    const { data: events, error } = await query;

    if (error) {
      // If table doesn't exist, return empty array
      if (error.code === "42P01") {
        return NextResponse.json({ events: [] });
      }
      console.error("Error fetching audit events:", error);
      return NextResponse.json({ 
        error: "Database error", 
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ events: events || [] });

  } catch (err) {
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
    const supabase = await createClient();
    
    const { data: auditEvent, error } = await supabase
      .from("audit_events")
      .insert({
        actor: userId,
        actor_name: body.actorName || "Unknown",
        action: body.action,
        entity_type: body.entityType,
        entity_id: body.entityId,
        summary: body.summary,
        metadata: body.metadata || {},
      })
      .select()
      .single();

    if (error) {
      // If table doesn't exist, just return success (silently fail)
      if (error.code === "42P01") {
        return NextResponse.json({ 
          id: `audit_${Date.now()}`,
          timestamp: new Date().toISOString(),
          ...body 
        }, { status: 201 });
      }
      console.error("Error creating audit event:", error);
      return NextResponse.json({ 
        error: "Failed to create audit event", 
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json(auditEvent, { status: 201 });

  } catch (err) {
    console.error("Unexpected error in POST /api/audit:", err);
    return NextResponse.json({ 
      error: "Server error", 
      details: err instanceof Error ? err.message : "Unknown error" 
    }, { status: 500 });
  }
}
