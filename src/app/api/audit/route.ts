import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { getAuditLog } from "@/lib/audit";
import { hasPermission, type UserRole, type Permission } from "@/lib/auth/rbac";

function sql() {
  return getDb();
}

/**
 * GET /api/audit
 * Get audit log entries with filters
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Get user from database
    const userResult = await sql()`
      SELECT u.role, 
        COALESCE(
          json_agg(DISTINCT up.permission) FILTER (WHERE up.permission IS NOT NULL),
          '[]'
        ) as permissions
      FROM users u
      LEFT JOIN user_permissions up ON u.id = up.user_id
      WHERE u.id = ${userId}
      GROUP BY u.id
    `;
    
    if (userResult.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    const user = userResult[0];
    const userPermissions: Permission[] = (user.permissions || []) as Permission[];
    
    // Check permission - need VIEW_AUDIT_LOG
    if (!hasPermission(user.role as UserRole, userPermissions, "VIEW_AUDIT_LOG")) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }
    
    const { searchParams } = new URL(request.url);
    const filters = {
      action: searchParams.get("action") || undefined,
      entityType: searchParams.get("entityType") || undefined,
      entityId: searchParams.get("entityId") || undefined,
      developmentId: searchParams.get("developmentId") || undefined,
      performedBy: searchParams.get("performedBy") || undefined,
      dateFrom: searchParams.get("dateFrom") || undefined,
      dateTo: searchParams.get("dateTo") || undefined,
    };
    
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    
    const result = await getAuditLog(filters, { limit, offset });
    
    return NextResponse.json(result);
  } catch (err) {
    console.error("Error in GET /api/audit:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
