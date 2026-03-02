import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

function sql() {
  return getDb();
}

/**
 * GET /api/developments
 * Get all developments for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const includeArchived = searchParams.get("includeArchived") === "true";
    
    const db = getDb();
    
    // Get developments for this user
    let query = db`
      SELECT 
        d.*,
        (SELECT COUNT(*) FROM development_stands WHERE development_id = d.id) as total_stands,
        (SELECT COUNT(*) FROM development_stands WHERE development_id = d.id AND status = 'Available') as available_stands,
        (SELECT COUNT(*) FROM development_stands WHERE development_id = d.id AND status = 'Sold') as sold_stands
      FROM developments d
      WHERE d.user_id = ${userId}
    `;
    
    if (!includeArchived) {
      query = db`
        ${query}
        AND d.status != 'Archived'
      `;
    }
    
    if (search) {
      query = db`
        ${query}
        AND d.name ILIKE ${'%' + search + '%'}
      `;
    }
    
    query = db`
      ${query}
      ORDER BY d.created_at DESC
    `;
    
    const developments = await query;
    
    return NextResponse.json({ developments });
  } catch (err) {
    console.error("Error in GET /api/developments:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/developments
 * Create a new development
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const body = await request.json();
    const db = getDb();
    
    // Validate required fields
    if (!body.name) {
      return NextResponse.json({ error: "Development name is required" }, { status: 400 });
    }
    
    // Create development
    const result = await db`
      INSERT INTO developments (
        user_id,
        name,
        description,
        location,
        currency,
        status,
        pricing_strategy,
        base_price,
        price_per_sqm,
        size_in_sqms,
        payment_plan,
        deposit_percentage,
        installment_months,
        interest_rate
      ) VALUES (
        ${userId},
        ${body.name},
        ${body.description || null},
        ${body.location || null},
        ${body.currency || 'USD'},
        ${body.status || 'Active'},
        ${body.pricingStrategy || 'fixed'},
        ${body.basePrice || null},
        ${body.pricePerSqm || null},
        ${body.sizeInSqms || null},
        ${body.paymentPlan || 'cash'},
        ${body.depositPercentage || null},
        ${body.installmentMonths || null},
        ${body.interestRate || null}
      )
      RETURNING *
    `;
    
    return NextResponse.json({ development: result[0] }, { status: 201 });
  } catch (err) {
    console.error("Error in POST /api/developments:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
