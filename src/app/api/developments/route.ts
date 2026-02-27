import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

// GET /api/developments
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sql = getDb();

    // 1. Fetch developments for this user
    const developments = await sql`
      SELECT * FROM developments 
      WHERE user_id = ${userId} 
      ORDER BY created_at DESC
    `;

    if (developments.length === 0) {
      return NextResponse.json([]);
    }

    const developmentIds = developments.map(d => d.id);

    // 2. Fetch related data
    const standTypes = await sql`
      SELECT * FROM development_stand_types 
      WHERE development_id = ANY(${developmentIds})
    `;

    const costItems = await sql`
      SELECT * FROM development_cost_items 
      WHERE development_id = ANY(${developmentIds})
    `;

    // 3. Fetch stands with their payment totals
    const standsData = await sql`
      SELECT 
        ds.development_id,
        ds.id as stand_id,
        ds.status,
        COALESCE(SUM(pt.amount), 0) as total_received
      FROM development_stands ds
      LEFT JOIN payment_transactions pt ON ds.id = pt.stand_id
      WHERE ds.development_id = ANY(${developmentIds})
      GROUP BY ds.development_id, ds.id, ds.status
    `;

    // 4. Transform to match frontend types
    const transformed = developments.map((dev: any) => {
      // Get stands for this development
      const devStands = standsData.filter((s: any) => s.development_id === dev.id);
      
      // Calculate totals
      const totalStands = devStands.length;
      const soldStands = devStands.filter((s: any) => s.status === 'Sold').length;
      const availableStands = devStands.filter((s: any) => s.status === 'Available').length;
      const totalReceived = devStands.reduce((sum: number, s: any) => sum + parseFloat(s.total_received || 0), 0);
      
      // Calculate developer payable (totalReceived - commission)
      const commissionRate = parseFloat(dev.commission_rate || 0);
      const commissionAmount = Math.min(commissionRate, totalReceived); // Don't exceed total received
      const developerPayable = Math.max(0, totalReceived - commissionAmount);
      const fineCountryRetain = commissionAmount;

      return {
        id: dev.id,
        name: dev.name,
        code: dev.code,
        currency: dev.currency,
        developerName: dev.developer_name,
        developerContacts: dev.developer_contacts,
        commissionFixed: dev.commission_rate,
        totalStands,
        soldStands,
        availableStands,
        totalReceived,
        developerPayable,
        fineCountryRetain,
        standTypes: standTypes
          .filter((st: any) => st.development_id === dev.id)
          .map((st: any) => ({
            id: st.id,
            label: st.label,
            sizeSqm: st.size_sqm,
            basePrice: st.base_price,
            isActive: st.is_active,
          })) || [],
        costs: costItems
          .filter((c: any) => c.development_id === dev.id)
          .map((c: any) => ({
            id: c.id,
            name: c.name,
            type: c.cost_type,
            value: c.value,
            appliesTo: c.applies_to,
            payTo: c.pay_to,
            isVariable: c.is_variable,
            isActive: c.is_active,
          })) || [],
      };
    });

    return NextResponse.json(transformed);

  } catch (err) {
    console.error("Unexpected error in GET /api/developments:", err);
    return NextResponse.json({
      error: "Server error",
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}

// POST /api/developments
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const sql = getDb();

    // Validation
    if (!body.name || body.name.trim() === "") {
      return NextResponse.json({ error: "Development name is required" }, { status: 400 });
    }
    if (!body.code || body.code.trim() === "") {
      return NextResponse.json({ error: "Development code is required" }, { status: 400 });
    }

    // Check for duplicate code
    const existing = await sql`
      SELECT id FROM developments 
      WHERE user_id = ${userId} AND code = ${body.code.trim()}
    `;
    
    if (existing.length > 0) {
      return NextResponse.json({ 
        error: `A development with code "${body.code.trim()}" already exists. Please use a different code.` 
      }, { status: 409 });
    }

    // 1. Insert development
    const results = await sql`
      INSERT INTO developments (
        user_id, name, code, currency, 
        developer_name, developer_contacts, commission_rate
      ) VALUES (
        ${userId}, ${body.name.trim()}, ${body.code.trim()}, ${body.currency || "USD"},
        ${body.developerName?.trim() || null}, ${body.developerContacts?.trim() || null}, ${body.commissionFixed || 0}
      ) RETURNING *
    `;

    const development = results[0];

    // 2. Insert stand types if provided
    if (body.standTypes?.length > 0) {
      for (const st of body.standTypes) {
        await sql`
          INSERT INTO development_stand_types (
            development_id, label, size_sqm, base_price, is_active
          ) VALUES (
            ${development.id}, ${st.label}, ${st.sizeSqm}, ${st.basePrice}, ${st.isActive ?? true}
          )
        `;
      }
    }

    // 3. Insert cost items if provided
    if (body.costs?.length > 0) {
      for (const c of body.costs) {
        // Normalize pay_to value
        let payTo = c.payTo;
        if (payTo === 'Fine & Country') payTo = 'fine_country';
        if (payTo === 'Developer') payTo = 'developer';
        if (payTo === 'Third Party') payTo = 'third_party';
        
        // Validate pay_to
        const validPayTo = ['fine_country', 'developer', 'third_party'];
        if (!validPayTo.includes(payTo)) {
          return NextResponse.json({ 
            error: `Invalid pay_to value: ${c.payTo}. Must be one of: fine_country, developer, third_party` 
          }, { status: 400 });
        }
        
        await sql`
          INSERT INTO development_cost_items (
            development_id, name, cost_type, value, applies_to, pay_to, is_variable, is_active
          ) VALUES (
            ${development.id}, ${c.name}, ${c.type}, ${c.value}, ${c.appliesTo || "all"}, 
            ${payTo}, ${c.isVariable ?? false}, ${c.isActive ?? true}
          )
        `;
      }
    }

    return NextResponse.json(development, { status: 201 });
  } catch (err) {
    console.error("Unexpected error in POST /api/developments:", err);
    return NextResponse.json({
      error: "Server error",
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}
