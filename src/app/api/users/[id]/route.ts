import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { getUserById, updateUser, deleteUser } from "@/lib/services/user-service";

function sql() {
  return getDb();
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/users/:id
 * Get user by ID
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
    
    // Get the requested user
    const targetUser = await getUserById(id);
    
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    return NextResponse.json({ user: targetUser });
  } catch (err) {
    console.error("Error in GET /api/users/[id]:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/users/:id
 * Update user
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
    
    const updatedUser = await updateUser(id, body, userId);
    
    return NextResponse.json({ user: updatedUser });
  } catch (err) {
    console.error("Error in PUT /api/users/[id]:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/users/:id
 * Delete (deactivate) user
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { id } = await params;
    
    await deleteUser(id, userId);
    
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error in DELETE /api/users/[id]:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
