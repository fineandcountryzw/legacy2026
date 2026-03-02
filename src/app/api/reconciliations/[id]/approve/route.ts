import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { approveReconciliation } from "@/lib/services/reconciliation-service";
import { hasPermission, type UserRole, type Permission } from "@/lib/auth/rbac";

function sql() {
  return getDb();
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/reconciliations/:id/approve
 * Approve a reconciled reconciliation
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
    
    // Get user from database
    const userResult = await sql()`
      SELECT u.id, u.role, 
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
    
    // Check permission - need MANAGE_RECONCILIATIONS
    if (!hasPermission(user.role as UserRole, userPermissions, "MANAGE_RECONCILIATIONS")) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }
    
    // Parse body
    const body = await request.json();
    
    // Get IP address
    const ipAddress = request.headers.get("x-forwarded-for") || 
                      request.headers.get("x-real-ip") || 
                      "unknown";
    
    // Approve the reconciliation
    const reconciliation = await approveReconciliation(
      id,
      user.id,
      body.notes,
      ipAddress
    );
    
    return NextResponse.json({
      success: true,
      reconciliation,
      message: "Reconciliation approved successfully",
    });
  } catch (error) {
    console.error("Error approving reconciliation:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
