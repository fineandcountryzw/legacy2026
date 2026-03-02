import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

function sql() {
  return getDb();
}

/**
 * POST /api/admin/repair-transactions
 * Repair transactions by recalculating stand balances
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
    
    const body = await request.json();
    const developmentId = body.developmentId;
    
    if (!developmentId) {
      return NextResponse.json({ error: "Development ID is required" }, { status: 400 });
    }
    
    // Get all stands for this development
    const stands = await db`
      SELECT ds.id, ds.stand_number FROM development_stands ds
      WHERE ds.development_id = ${developmentId}
    `;
    
    let repaired = 0;
    
    for (const stand of stands) {
      // Recalculate totals for this stand
      const payments = await db`
        SELECT COALESCE(SUM(amount), 0) as total FROM customer_payments
        WHERE stand_id = ${stand.id}
      `;
      
      const deductions = await db`
        SELECT COALESCE(SUM(amount), 0) as total FROM deductions
        WHERE stand_id = ${stand.id}
      `;
      
      const totalPayments = Number(payments[0]?.total || 0);
      const totalDeductions = Number(deductions[0]?.total || 0);
      const balance = totalPayments - totalDeductions;
      
      // Update stand
      await db`
        UPDATE development_stands
        SET 
          total_payments = ${totalPayments},
          total_deductions = ${totalDeductions},
          balance = ${balance},
          updated_at = NOW()
        WHERE id = ${stand.id}
      `;
      
      repaired++;
    }
    
    return NextResponse.json({ 
      success: true,
      standsRepaired: repaired
    });
  } catch (err) {
    console.error("Error in POST /api/admin/repair-transactions:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
