import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

function sql() {
  return getDb();
}

/**
 * POST /api/fix-orphaned-transactions
 * Fix transactions that have been imported but not linked to stands
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const db = getDb();
    
    // Get user role
    const userResult = await db`
      SELECT role FROM users WHERE id = ${userId}
    `;
    
    if (userResult.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    // Only admins can run this
    if (userResult[0].role !== 'ADMIN') {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    
    // Find orphaned transactions (where stand_id is null but development_id exists)
    const orphaned = await db`
      SELECT * FROM customer_payments
      WHERE stand_id IS NULL AND development_id IS NOT NULL
    `;
    
    // Try to link them to stands based on stand_number and development_id
    let fixed = 0;
    for (const tx of orphaned) {
      // Find matching stand
      const stand = await db`
        SELECT ds.id FROM development_stands ds
        WHERE ds.development_id = ${tx.development_id}
          AND ds.stand_number = ${tx.stand_number}
      `;
      
      if (stand.length > 0) {
        // Update the transaction with the correct stand_id
        await db`
          UPDATE customer_payments
          SET stand_id = ${stand[0].id}
          WHERE id = ${tx.id}
        `;
        fixed++;
      }
    }
    
    return NextResponse.json({ 
      success: true,
      orphanedCount: orphaned.length,
      fixedCount: fixed
    });
  } catch (err) {
    console.error("Error in POST /api/fix-orphaned-transactions:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
