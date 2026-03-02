import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { calculateNetPayout } from "@/lib/services/payout-service";

/**
 * GET /api/payouts/calculate
 * Calculate net payout amount for a stand
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const standId = searchParams.get("standId");
    
    if (!standId) {
      return NextResponse.json({ error: "Stand ID is required" }, { status: 400 });
    }
    
    const calculation = await calculateNetPayout(standId);
    
    return NextResponse.json({ calculation });
  } catch (err) {
    console.error("Error in GET /api/payouts/calculate:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
