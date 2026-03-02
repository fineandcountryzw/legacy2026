import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit";

function sql() {
  return getDb();
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/users/:id/permissions
 * Get user permissions
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
    
    // Get user permissions
    const permissions = await db`
      SELECT up.*, u.first_name || ' ' || u.last_name as granted_by_name
      FROM user_permissions up
      LEFT JOIN users u ON up.granted_by = u.id
      WHERE up.user_id = ${id}
    `;
    
    return NextResponse.json({ permissions });
  } catch (err) {
    console.error("Error in GET /api/users/[id]/permissions:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/users/:id/permissions
 * Update user permissions
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
    
    const { permissions } = body;
    
    if (!Array.isArray(permissions)) {
      return NextResponse.json({ error: "Permissions must be an array" }, { status: 400 });
    }
    
    // Delete existing permissions
    await db`DELETE FROM user_permissions WHERE user_id = ${id}`;
    
    // Add new permissions
    for (const permission of permissions) {
      await db`
        INSERT INTO user_permissions (user_id, permission, granted_by)
        VALUES (${id}, ${permission}, ${userId})
      `;
    }
    
    // Log audit
    await logAudit({
      action: AUDIT_ACTIONS.PERMISSION_GRANTED,
      entityType: 'USER',
      entityId: id,
      newValues: { permissions },
      performedBy: userId,
      reason: 'User permissions updated'
    });
    
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error in PUT /api/users/[id]/permissions:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
