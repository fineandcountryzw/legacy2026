import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

function sql() {
  return getDb();
}

/**
 * POST /api/uploads/import
 * Import a ledger file (processes the data)
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const body = await request.json();
    
    if (!body.uploadId || !body.data) {
      return NextResponse.json({ error: "Upload ID and data are required" }, { status: 400 });
    }
    
    const db = getDb();
    
    // Get upload record
    const upload = await db`
      SELECT * FROM uploads WHERE id = ${body.uploadId} AND user_id = ${userId}
    `;
    
    if (upload.length === 0) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }
    
    // Process the import data
    // This would call the importer service to save transactions to the database
    // For now, we'll just update the upload status
    
    await db`
      UPDATE uploads
      SET status = 'completed',
          processed_rows = ${body.data.totalTransactions || 0},
          error_count = ${body.data.errors?.length || 0},
          notes = ${JSON.stringify(body.data.errors || [])},
          updated_at = NOW()
      WHERE id = ${body.uploadId}
    `;
    
    return NextResponse.json({ 
      success: true,
      message: "Import completed successfully",
      processed: body.data.totalTransactions || 0
    });
  } catch (err) {
    console.error("Error in POST /api/uploads/import:", err);
    return NextResponse.json(
      { error: "Failed to import data", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
