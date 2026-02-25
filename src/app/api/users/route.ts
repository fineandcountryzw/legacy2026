import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// Mock users - in production this would come from Clerk Organization API
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

// GET /api/users - Get all organization users
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");
    const status = searchParams.get("status");

    let users = [...mockUsers];

    if (role) {
      users = users.filter(u => u.role === role);
    }

    if (status) {
      users = users.filter(u => u.status === status);
    }

    return NextResponse.json({ users });

  } catch (err) {
    console.error("Unexpected error in GET /api/users:", err);
    return NextResponse.json({ 
      error: "Server error", 
      details: err instanceof Error ? err.message : "Unknown error" 
    }, { status: 500 });
  }
}

// POST /api/users - Invite a new user
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.email || !body.role) {
      return NextResponse.json({ 
        error: "Missing required fields", 
        details: "Email and role are required" 
      }, { status: 400 });
    }

    // Validate role
    const validRoles = ["admin", "finance", "agent", "auditor"];
    if (!validRoles.includes(body.role)) {
      return NextResponse.json({ 
        error: "Invalid role", 
        details: `Role must be one of: ${validRoles.join(", ")}` 
      }, { status: 400 });
    }

    // Check for duplicate email
    const existingUser = mockUsers.find(u => u.email === body.email);
    if (existingUser) {
      return NextResponse.json({ 
        error: "User already exists", 
        details: "A user with this email already exists" 
      }, { status: 409 });
    }

    // Create new user (mock)
    const newUser = {
      id: `user_${Date.now()}`,
      email: body.email,
      firstName: body.firstName || "",
      lastName: body.lastName || "",
      role: body.role,
      status: "pending", // Pending until they accept invitation
      lastActiveAt: null,
      createdAt: new Date().toISOString(),
    };

    // In production, this would call Clerk's Organization API to invite the user

    return NextResponse.json(newUser, { status: 201 });

  } catch (err) {
    console.error("Unexpected error in POST /api/users:", err);
    return NextResponse.json({ 
      error: "Server error", 
      details: err instanceof Error ? err.message : "Unknown error" 
    }, { status: 500 });
  }
}
