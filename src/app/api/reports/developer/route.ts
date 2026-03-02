import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

function sql() {
  return getDb();
}

/**
 * GET /api/reports/developer
 * Get developer payout report
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const developer = searchParams.get("developer");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    
    const db = getDb();
    
    let query = db`
      SELECT 
        dp.developer_name,
        COUNT(*) as total_payouts,
        COUNT(CASE WHEN dp.status = 'PENDING' THEN 1 END) as pending_count,
        COUNT(CASE WHEN dp.status = 'APPROVED' THEN 1 END) as approved_count,
        COUNT(CASE WHEN dp.status = 'PAID' THEN 1 END) as paid_count,
        COALESCE(SUM(CASE WHEN dp.status = 'PENDING' THEN dp.amount END), 0) as pending_amount,
        COALESCE(SUM(CASE WHEN dp.status = 'APPROVED' THEN dp.amount END), 0) as approved_amount,
        COALESCE(SUM(CASE WHEN dp.status = 'PAID' THEN dp.amount END), 0) as paid_amount
      FROM developer_payouts dp
      JOIN development_stands ds ON dp.stand_id = ds.id
      JOIN developments d ON ds.development_id = d.id
      WHERE d.user_id = ${userId}
    `;
    
    if (developer) {
      query = db`${query} AND dp.developer_name = ${developer}`;
    }
    
    if (dateFrom) {
      query = db`${query} AND dp.requested_at >= ${dateFrom}`;
    }
    
    if (dateTo) {
      query = db`${query} AND dp.requested_at <= ${dateTo}`;
    }
    
    query = db`
      ${query}
      GROUP BY dp.developer_name
      ORDER BY dp.developer_name
    `;
    
    const report = await query;
    
    return NextResponse.json({ report });
  } catch (err) {
    console.error("Error in GET /api/reports/developer:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
