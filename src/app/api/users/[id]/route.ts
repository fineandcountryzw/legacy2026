import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// Mock users database
const mockUsers = [
  {
    id: "user_admin_001",
    email: "admin@fineandcountry.com",
    firstName: "Admin",
    lastName: "User",
    role: "admin",
    status: "active",
    lastActiveAt: "2024-02-25T10:30:00Z",
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "user_finance_001",
    email: "finance@fineandcountry.com",
    firstName: "Finance",
    lastName: "User",
    role: "finance",
    status: "active",
    lastActiveAt: "2024-02-25T09:15:00Z",
    createdAt: "2024-01-15T00:00:00Z",
  },
  {
    id: "user_agent_001",
    email: "agent@fineandcountry.com",
    firstName: "Agent",
    lastName: "User",
    role: "agent",
    status: "active",
    lastActiveAt: "2024-02-24T16:45:00Z",
    createdAt: "2024-02-01T00:00:00Z",
  },
  {
    id: "user_auditor_001",
    email: "auditor@fineandcountry.com",
    firstName: "Auditor",
    lastName: "User",
    role: "auditor",
    status: "active",
    lastActiveAt: "2024-02-20T11:00:00Z",
    createdAt: "2024-02-10T00:00:00Z",
  },
];

// PUT /api/users/[id] - Update user role or status
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();

    // Find user
    const userIndex = mockUsers.findIndex(u => u.id === id);
    if (userIndex === -1) {
      return NextResponse.json({ 
        error: "User not found" 
      }, { status: 404 });
    }

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

    // Update user (mock)
    const updatedUser = {
      ...mockUsers[userIndex],
      role: body.role || mockUsers[userIndex].role,
      status: body.status || mockUsers[userIndex].status,
      firstName: body.firstName || mockUsers[userIndex].firstName,
      lastName: body.lastName || mockUsers[userIndex].lastName,
    };

    // In production, this would call Clerk's API to update the user

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
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    // Find user
    const userIndex = mockUsers.findIndex(u => u.id === id);
    if (userIndex === -1) {
      return NextResponse.json({ 
        error: "User not found" 
      }, { status: 404 });
    }

    // Prevent self-deletion
    if (id === userId) {
      return NextResponse.json({ 
        error: "Cannot delete yourself", 
        details: "You cannot remove yourself from the organization" 
      }, { status: 400 });
    }

    // In production, this would call Clerk's API to remove the user

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("Unexpected error in DELETE /api/users/[id]:", err);
    return NextResponse.json({ 
      error: "Server error", 
      details: err instanceof Error ? err.message : "Unknown error" 
    }, { status: 500 });
  }
}
