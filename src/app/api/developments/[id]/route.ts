import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

function sql() {
  return getDb();
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/developments/:id
 * Get a specific development
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
    
    const { id } = await params;
    const db = getDb();
    
    const result = await db`
      SELECT d.*,
        (SELECT COUNT(*) FROM development_stands WHERE development_id = d.id) as total_stands,
        (SELECT COUNT(*) FROM development_stands WHERE development_id = d.id AND status = 'Available') as available_stands,
        (SELECT COUNT(*) FROM development_stands WHERE development_id = d.id AND status = 'Sold') as sold_stands
      FROM developments d
      WHERE d.id = ${id} AND d.user_id = ${userId}
    `;
    
    if (result.length === 0) {
      return NextResponse.json({ error: "Development not found" }, { status: 404 });
    }
    
    return NextResponse.json({ development: result[0] });
  } catch (err) {
    console.error("Error in GET /api/developments/[id]:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/developments/:id
 * Update a development
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { id } = await params;
    const body = await request.json();
    const db = getDb();
    
    // Check ownership
    const existing = await db`
      SELECT id FROM developments WHERE id = ${id} AND user_id = ${userId}
    `;
    
    if (existing.length === 0) {
      return NextResponse.json({ error: "Development not found" }, { status: 404 });
    }
    
    // Update development
    const result = await db`
      UPDATE developments
      SET 
        name = ${body.name},
        description = ${body.description || null},
        location = ${body.location || null},
        currency = ${body.currency || 'USD'},
        status = ${body.status || 'Active'},
        pricing_strategy = ${body.pricingStrategy || 'fixed'},
        base_price = ${body.basePrice || null},
        price_per_sqm = ${body.pricePerSqm || null},
        size_in_sqms = ${body.sizeInSqms || null},
        payment_plan = ${body.paymentPlan || 'cash'},
        deposit_percentage = ${body.depositPercentage || null},
        installment_months = ${body.installmentMonths || null},
        interest_rate = ${body.interestRate || null},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    
    return NextResponse.json({ development: result[0] });
  } catch (err) {
    console.error("Error in PUT /api/developments/[id]:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/developments/:id
 * Delete a development
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { id } = await params;
    const db = getDb();
    
    // Check ownership
    const existing = await db`
      SELECT id FROM developments WHERE id = ${id} AND user_id = ${userId}
    `;
    
    if (existing.length === 0) {
      return NextResponse.json({ error: "Development not found" }, { status: 404 });
    }
    
    // Delete development (cascade will handle stands)
    await db`
      DELETE FROM developments WHERE id = ${id}
    `;
    
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error in DELETE /api/developments/[id]:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
