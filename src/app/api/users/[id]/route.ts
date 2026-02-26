import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

// PUT /api/users/[id] - Update user role or status
export async function PUT(
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

    // Validate role if provided
    if (body.role) {
      const validRoles = ["admin", "finance", "agent", "auditor"];
      if (!validRoles.includes(body.role)) {
        return NextResponse.json({
          error: "Invalid role",
          details: `Role must be one of: ${validRoles.join(", ")}`
        }, { status: 400 });
      }
    }

    // Validate status if provided
    if (body.status) {
      const validStatuses = ["active", "inactive", "pending"];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json({
          error: "Invalid status",
          details: `Status must be one of: ${validStatuses.join(", ")}`
        }, { status: 400 });
      }
    }

    // Prevent self-deactivation
    if (id === userId && body.status === "inactive") {
      return NextResponse.json({
        error: "Cannot deactivate yourself",
        details: "You cannot deactivate your own account"
      }, { status: 400 });
    }

    const results = await sql`
      UPDATE org_users
      SET 
        role = ${body.role || null},
        status = ${body.status || null},
        first_name = ${body.firstName || ""},
        last_name = ${body.lastName || ""},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (results.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(results[0]);

  } catch (err) {
    console.error("Unexpected error in PUT /api/users/[id]:", err);
    return NextResponse.json({
      error: "Server error",
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}

// DELETE /api/users/[id] - Remove user from organization
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Prevent self-deletion
    if (id === userId) {
      return NextResponse.json({
        error: "Cannot delete yourself",
        details: "You cannot remove yourself from the organization"
      }, { status: 400 });
    }

    const sql = getDb();

    const results = await sql`DELETE FROM org_users WHERE id = ${id} RETURNING id`;

    if (results.length === 0) {
      return NextResponse.json({ error: "User not found or already deleted" }, { status: 404 });
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("Unexpected error in DELETE /api/users/[id]:", err);
    return NextResponse.json({
      error: "Server error",
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}
