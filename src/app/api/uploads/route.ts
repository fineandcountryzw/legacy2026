import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

function sql() {
  return getDb();
}

/**
 * GET /api/uploads
 * Get all uploads for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    
    const db = getDb();
    
    let query = db`
      SELECT * FROM uploads
      WHERE user_id = ${userId}
    `;
    
    if (type) {
      query = db`${query} AND type = ${type}`;
    }
    
    query = db`
      ${query}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    
    const uploads = await query;
    
    return NextResponse.json({ uploads });
  } catch (err) {
    console.error("Error in GET /api/uploads:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/uploads
 * Create a new upload record
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const body = await request.json();
    const db = getDb();
    
    // Validate required fields
    if (!body.filename || !body.type) {
      return NextResponse.json({ error: "Filename and type are required" }, { status: 400 });
    }
    
    // Create upload record
    const result = await db`
      INSERT INTO uploads (
        user_id,
        filename,
        type,
        status,
        total_rows,
        processed_rows,
        error_count,
        file_size,
        notes
      ) VALUES (
        ${userId},
        ${body.filename},
        ${body.type},
        ${body.status || 'pending'},
        ${body.totalRows || 0},
        ${body.processedRows || 0},
        ${body.errorCount || 0},
        ${body.fileSize || null},
        ${body.notes || null}
      )
      RETURNING *
    `;
    
    return NextResponse.json({ upload: result[0] }, { status: 201 });
  } catch (err) {
    console.error("Error in POST /api/uploads:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
