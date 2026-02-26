import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { processExcelUpload } from "@/lib/import/importer";

// GET /api/uploads - List upload history
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sql = getDb();

    // Fetch uploads and join with development name if exists
    const uploads = await sql`
      SELECT 
        u.*, 
        d.name as development_name
      FROM uploads u
      LEFT JOIN developments d ON u.development_id = d.id
      WHERE u.user_id = ${userId}
      ORDER BY u.created_at DESC
    `;

    // Transform to match frontend types
    const transformed = uploads.map((u: any) => ({
      id: u.id,
      fileName: u.file_name,
      developmentName: u.development_name || undefined,
      date: u.created_at,
      standsDetected: u.stands_detected,
      transactionsDetected: u.transactions_detected,
      status: u.status
    }));

    return NextResponse.json(transformed);
  } catch (err) {
    console.error("Unexpected error in GET /api/uploads:", err);
    return NextResponse.json({
      error: "Server error",
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}

// POST /api/uploads - Process new upload
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const developmentId = formData.get("developmentId") as string | null;
    const developmentCode = formData.get("developmentCode") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      return NextResponse.json({ error: "Invalid file type. Only Excel files are allowed." }, { status: 400 });
    }

    // Read file buffer
    const buffer = await file.arrayBuffer();

    // Process the upload
    const result = await processExcelUpload(buffer, file.name, {
      userId,
      developmentId: developmentId || undefined,
      developmentCode: developmentCode || undefined,
      autoMatchStands: true
    });

    if (result.errors.length > 0) {
      return NextResponse.json({
        success: false,
        uploadId: result.uploadId,
        standsProcessed: result.standsProcessed,
        transactionsCreated: result.transactionsCreated,
        errors: result.errors
      }, { status: 207 }); // 207 Multi-Status for partial success
    }

    return NextResponse.json({
      success: true,
      uploadId: result.uploadId,
      standsProcessed: result.standsProcessed,
      transactionsCreated: result.transactionsCreated
    }, { status: 201 });

  } catch (err) {
    console.error("Unexpected error in POST /api/uploads:", err);
    return NextResponse.json({
      error: "Server error",
      details: err instanceof Error ? err.message : "Failed to process upload"
    }, { status: 500 });
  }
}
