import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { getStandHistory } from "@/lib/services/stand-lifecycle-service";

function sql() {
  return getDb();
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/stands/:id/history
 * Get complete history for a stand
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { id: standId } = await params;
    
    const history = await getStandHistory(standId);
    
    return NextResponse.json({ history });
  } catch (error) {
    console.error("Error fetching stand history:", error);
    
    if ((error as Error).message === "Stand not found") {
      return NextResponse.json({ error: "Stand not found" }, { status: 404 });
    }
    
    return NextResponse.json(
      { error: "Failed to fetch stand history", details: (error as Error).message },
      { status: 500 }
    );
  }
}
