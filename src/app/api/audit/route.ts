import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

// Mock audit events table - in production this would be a real table
const mockAuditEvents = [
  {
    id: "1",
    timestamp: "2024-02-25T10:30:00Z",
    actor: "user_admin_001",
    actorName: "Admin User",
    action: "STATEMENT_DOWNLOADED",
    entityType: "stand",
    entityId: "stand_001",
    summary: "Downloaded statement for Stand 101",
    metadata: { standNumber: "101", clientName: "John Doe" },
  },
  {
    id: "2",
    timestamp: "2024-02-25T09:15:00Z",
    actor: "user_finance_001",
    actorName: "Finance User",
    action: "RECEIPT_CREATED",
    entityType: "receipt",
    entityId: "receipt_001",
    summary: "Created receipt REC-2024-001",
    metadata: { receiptNumber: "REC-2024-001", amount: 5000 },
  },
  {
    id: "3",
    timestamp: "2024-02-24T16:45:00Z",
    actor: "user_admin_001",
    actorName: "Admin User",
    action: "DEVELOPMENT_CREATED",
    entityType: "development",
    entityId: "dev_001",
    summary: "Created development 'Green Valley Estate'",
    metadata: { developmentName: "Green Valley Estate", code: "GVE" },
  },
];

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

    // Filter mock events
    let events = [...mockAuditEvents];

    if (actor) {
      events = events.filter(e => e.actor?.includes(actor));
    }

    if (action) {
      events = events.filter(e => e.action === action);
    }

    if (entityType) {
      events = events.filter(e => e.entityType === entityType);
    }

    if (startDate) {
      events = events.filter(e => e.timestamp >= startDate);
    }

    if (endDate) {
      events = events.filter(e => e.timestamp <= endDate);
    }

    // Sort by timestamp descending
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({ events });

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
    
    // In production, this would insert into a real audit_events table
    const auditEvent = {
      id: `audit_${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor: userId,
      actorName: body.actorName || "Unknown",
      action: body.action,
      entityType: body.entityType,
      entityId: body.entityId,
      summary: body.summary,
      metadata: body.metadata || {},
    };

    // Mock: just return the event (in production, save to DB)
    return NextResponse.json(auditEvent, { status: 201 });

  } catch (err) {
    console.error("Unexpected error in POST /api/audit:", err);
    return NextResponse.json({ 
      error: "Server error", 
      details: err instanceof Error ? err.message : "Unknown error" 
    }, { status: 500 });
  }
}
