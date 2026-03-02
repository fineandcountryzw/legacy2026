import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { parseLedgerFile } from "@/lib/import/ledger-parser";

function sql() {
  return getDb();
}

/**
 * POST /api/uploads/preview
 * Preview a ledger file before import
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const body = await request.json();
    
    if (!body.fileUrl || !body.filename) {
      return NextResponse.json({ error: "File URL and filename are required" }, { status: 400 });
    }
    
    // Fetch the file from the URL
    const response = await fetch(body.fileUrl);
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch file" }, { status: 400 });
    }
    
    const buffer = await response.arrayBuffer();
    
    // Parse the ledger file
    const preview = parseLedgerFile(buffer, body.filename);
    
    return NextResponse.json({ preview });
  } catch (err) {
    console.error("Error in POST /api/uploads/preview:", err);
    return NextResponse.json(
      { error: "Failed to parse file", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
