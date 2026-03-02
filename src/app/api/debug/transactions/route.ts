import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

function sql() {
  return getDb();
}

/**
 * GET /api/debug/transactions
 * Debug endpoint to view raw transaction data
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    // Allow in development mode only
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Not available in production" }, { status: 403 });
    }
    
    const { searchParams } = new URL(request.url);
    const developmentId = searchParams.get("developmentId");
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    
    const db = getDb();
    
    let query = db`
      SELECT * FROM customer_payments
    `;
    
    if (developmentId) {
      query = db`
        ${query}
        WHERE development_id = ${developmentId}
      `;
    }
    
    query = db`
      ${query}
      ORDER BY payment_date DESC
      LIMIT ${limit}
    `;
    
    const transactions = await query;
    
    return NextResponse.json({ transactions });
  } catch (err) {
    console.error("Error in GET /api/debug/transactions:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
