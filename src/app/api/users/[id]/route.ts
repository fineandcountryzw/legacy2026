import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

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
    const supabase = await createClient();

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

    const { data: updatedUser, error } = await supabase
      .from("org_users")
      .update({
        role: body.role,
        status: body.status,
        first_name: body.firstName,
        last_name: body.lastName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "42P01") {
        return NextResponse.json({ 
          error: "Users table not found", 
          details: "Please run database migrations" 
        }, { status: 500 });
      }
      if (error.code === "PGRST116") {
        return NextResponse.json({ 
          error: "User not found" 
        }, { status: 404 });
      }
      console.error("Error updating user:", error);
      return NextResponse.json({ 
        error: "Failed to update user", 
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json(updatedUser);

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

    const supabase = await createClient();

    const { error } = await supabase
      .from("org_users")
      .delete()
      .eq("id", id);

    if (error) {
      if (error.code === "42P01") {
        return NextResponse.json({ 
          error: "Users table not found", 
          details: "Please run database migrations" 
        }, { status: 500 });
      }
      console.error("Error deleting user:", error);
      return NextResponse.json({ 
        error: "Failed to delete user", 
        details: error.message 
      }, { status: 500 });
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
