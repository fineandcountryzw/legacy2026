import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

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

    const supabase = await createClient();

    // Query org_users table (create this table in your database)
    let query = supabase
      .from("org_users")
      .select("*")
      .order("created_at", { ascending: false });

    if (role) {
      query = query.eq("role", role);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data: users, error } = await query;

    if (error) {
      // If table doesn't exist, return empty array
      if (error.code === "42P01") {
        return NextResponse.json({ users: [] });
      }
      console.error("Error fetching users:", error);
      return NextResponse.json({ 
        error: "Database error", 
        details: error.message 
      }, { status: 500 });
    }

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

    const supabase = await createClient();

    // Check for duplicate email
    const { data: existing } = await supabase
      .from("org_users")
      .select("id")
      .eq("email", body.email)
      .single();

    if (existing) {
      return NextResponse.json({ 
        error: "User already exists", 
        details: "A user with this email already exists" 
      }, { status: 409 });
    }

    // Create new user
    const { data: newUser, error } = await supabase
      .from("org_users")
      .insert({
        email: body.email,
        first_name: body.firstName || "",
        last_name: body.lastName || "",
        role: body.role,
        status: "pending",
        invited_by: userId,
      })
      .select()
      .single();

    if (error) {
      // If table doesn't exist
      if (error.code === "42P01") {
        return NextResponse.json({ 
          error: "Users table not found", 
          details: "Please run database migrations" 
        }, { status: 500 });
      }
      console.error("Error creating user:", error);
      return NextResponse.json({ 
        error: "Failed to create user", 
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json(newUser, { status: 201 });

  } catch (err) {
    console.error("Unexpected error in POST /api/users:", err);
    return NextResponse.json({ 
      error: "Server error", 
      details: err instanceof Error ? err.message : "Unknown error" 
    }, { status: 500 });
  }
}
