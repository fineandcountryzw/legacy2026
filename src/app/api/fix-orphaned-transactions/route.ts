import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

// POST /api/fix-orphaned-transactions - Link orphaned transactions to stands
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { uploadId } = await request.json();
    const sql = getDb();

    // 1. Get all orphaned transactions for this user/upload
    const orphanedTxs = await sql`
      SELECT id, description, upload_id FROM payment_transactions
      WHERE user_id = ${userId} AND stand_id IS NULL
      ${uploadId ? sql`AND upload_id = ${uploadId}` : sql``}
    `;

    // 2. Extract stand numbers from descriptions (format: "[SheetName] description Stand number XXXX")
    const fixed: string[] = [];
    const failed: string[] = [];

    for (const tx of orphanedTxs) {
      // Extract stand number from description like "[Kumvura] Deposit Stand number 3524"
      const match = tx.description?.match(/Stand number (\d+)/i);
      if (!match) {
        failed.push(`TX ${tx.id}: No stand number in description`);
        continue;
      }

      const standNumber = match[1];

      // Find development_stand with this stand number
      const standResults = await sql`
        SELECT ds.id 
        FROM development_stands ds
        JOIN stand_inventory si ON ds.stand_inventory_id = si.id
        WHERE si.stand_number = ${standNumber}
        LIMIT 1
      `;

      const stand = standResults[0];

      if (!stand) {
        failed.push(`TX ${tx.id}: Stand ${standNumber} not found`);
        continue;
      }

      // Update transaction with stand_id
      await sql`
        UPDATE payment_transactions
        SET 
          stand_id = ${stand.id},
          status = 'Matched'
        WHERE id = ${tx.id}
      `;

      fixed.push(`TX ${tx.id} -> Stand ${standNumber} (${stand.id})`);
    }

    return NextResponse.json({
      success: true,
      totalOrphaned: orphanedTxs.length,
      fixed: fixed.length,
      failed: failed.length,
      details: { fixed, failed }
    });

  } catch (err) {
    console.error("Fix error:", err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}

// GET /api/fix-orphaned-transactions - Check orphaned count
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sql = getDb();

    const results = await sql`
      SELECT COUNT(*) FROM payment_transactions
      WHERE user_id = ${userId} AND stand_id IS NULL
    `;

    return NextResponse.json({
      orphanedTransactions: parseInt(results[0].count || 0)
    });

  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}
