import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

// GET /api/debug/transactions - Debug endpoint to check transaction data
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sql = getDb();

    // 1. Get total count
    const totalResults = await sql`SELECT COUNT(*) FROM payment_transactions`;
    const totalCount = parseInt(totalResults[0].count);

    // 2. Get count for current user
    const userResults = await sql`SELECT COUNT(*) FROM payment_transactions WHERE user_id = ${userId}`;
    const userCount = parseInt(userResults[0].count);

    // 3. Get transactions with null stand_id
    const nullStandResults = await sql`
      SELECT COUNT(*) FROM payment_transactions 
      WHERE user_id = ${userId} AND stand_id IS NULL
    `;
    const nullStandCount = parseInt(nullStandResults[0].count);

    // 4. Get unique stand_ids from transactions
    const uniqueStandResults = await sql`
      SELECT DISTINCT stand_id FROM payment_transactions 
      WHERE user_id = ${userId} AND stand_id IS NOT NULL
    `;
    const standIdList = uniqueStandResults.map(t => t.stand_id);

    // 5. Get some stands for inspection
    const stands = await sql`
      SELECT ds.id, si.stand_number
      FROM development_stands ds
      JOIN stand_inventory si ON ds.stand_inventory_id = si.id
      LIMIT 20
    `;

    // 6. Get recent transactions
    const recentTransactions = await sql`
      SELECT 
        id, user_id, stand_id, transaction_date, amount, 
        description, status, development_id
      FROM payment_transactions
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 10
    `;

    return NextResponse.json({
      counts: {
        total: totalCount,
        forCurrentUser: userCount,
        withNullStandId: nullStandCount,
        uniqueStandIds: standIdList.length,
      },
      recentTransactions,
      uniqueStandIds: standIdList.slice(0, 20),
      stands,
      currentUserId: userId,
    });

  } catch (err) {
    console.error("Debug endpoint error:", err);
    return NextResponse.json({
      error: "Server error",
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}
