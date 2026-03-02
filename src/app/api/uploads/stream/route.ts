import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { parseLedgerFile } from "@/lib/import/ledger-parser";

function sql() {
  return getDb();
}

/**
 * POST /api/uploads/stream
 * Stream parse a ledger file with progress updates
 */
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    
    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    // Send initial progress
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Stage 1: Reading file
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ stage: 'reading', message: 'Reading file', current: 10, total: 100 })}\n\n`));
          
          // Read file content
          const arrayBuffer = await file.arrayBuffer();
          
          // Stage 2: Parsing sheets
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ stage: 'parsing_sheets', message: 'Parsing sheets', current: 30, total: 100 })}\n\n`));
          
          // Parse the ledger file using the full parser
          const result = parseLedgerFile(arrayBuffer, file.name);
          
          // Stage 3: Detecting stands
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ stage: 'detecting_stands', message: 'Detecting stands', current: 50, total: 100, details: `Found ${result.metadata.totalStands} stands` })}\n\n`));
          
          // Stage 4: Processing transactions
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ stage: 'processing_transactions', message: 'Processing transactions', current: 70, total: 100, details: `Processing ${result.metadata.totalTransactions} transactions` })}\n\n`));
          
          // Stage 5: Aggregating
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ stage: 'aggregating', message: 'Aggregating data', current: 85, total: 100 })}\n\n`));
          
          // Stage 6: Complete
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ stage: 'complete', message: 'Complete', current: 100, total: 100 })}\n\n`));
          
          // Send final result
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ stage: 'complete', details: JSON.stringify(result) })}\n\n`));
          controller.close();
        } catch (err) {
          console.error("Stream error:", err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ stage: 'error', message: 'Failed to process file', details: err instanceof Error ? err.message : 'Unknown error' })}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    console.error("Error in POST /api/uploads/stream:", err);
    return NextResponse.json(
      { error: "Failed to process file", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
