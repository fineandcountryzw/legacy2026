import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { parseLedgerFile } from "@/lib/import/ledger-parser";

// POST /api/uploads/preview - Preview Excel ledger data
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      return NextResponse.json({ error: "Invalid file type. Only Excel files are allowed." }, { status: 400 });
    }

    // Read file buffer
    const buffer = await file.arrayBuffer();

    // Parse the ledger file
    const result = parseLedgerFile(buffer, file.name);

    return NextResponse.json(result);

  } catch (error) {
    console.error("Preview error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Failed to preview file"
    }, { status: 500 });
  }
}
