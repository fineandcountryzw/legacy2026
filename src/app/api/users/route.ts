import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

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

    const sql = getDb();

    // Query org_users table using sql tag
    const users = await sql`
      SELECT * FROM org_users
      WHERE 1=1
      ${role ? sql`AND role = ${role}` : sql``}
      ${status ? sql`AND status = ${status}` : sql``}
      ORDER BY created_at DESC
    `;

    return NextResponse.json({ users: users || [] });

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

    const sql = getDb();

    // Check for duplicate email
    const existing = await sql`SELECT id FROM org_users WHERE email = ${body.email}`;

    if (existing.length > 0) {
      return NextResponse.json({
        error: "User already exists",
        details: "A user with this email already exists"
      }, { status: 409 });
    }

    // Create new user
    const results = await sql`
      INSERT INTO org_users (
        email, first_name, last_name, role, status, invited_by
      ) VALUES (
        ${body.email}, ${body.firstName || ""}, ${body.lastName || ""}, 
        ${body.role}, 'pending', ${userId}
      ) RETURNING *
    `;

    return NextResponse.json(results[0], { status: 201 });

  } catch (err) {
    console.error("Unexpected error in POST /api/users:", err);
    return NextResponse.json({
      error: "Server error",
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}
