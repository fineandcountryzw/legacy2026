import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

// GET /api/stands - Get all stands for the current user (linked + standalone)
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const developmentId = searchParams.get("developmentId");
    const search = searchParams.get("search");
    const includeStandalone = searchParams.get("standalone") !== "false";

    const sql = getDb();

    // 1. Fetch linked stands for this user
    let linkedStandsQuery;
    if (developmentId) {
      linkedStandsQuery = sql`
        SELECT 
          ds.id, ds.agreed_price, ds.status, ds.client_name, ds.client_id,
          ds.stand_inventory_id, si.stand_number,
          d.id as development_id, d.name as development_name, d.currency,
          st.label as stand_type_label, st.base_price as stand_type_base_price,
          c.phone as client_phone, c.email as client_email,
          COALESCE(SUM(pt.amount), 0) as total_paid
        FROM development_stands ds
        JOIN stand_inventory si ON ds.stand_inventory_id = si.id
        JOIN developments d ON ds.development_id = d.id
        LEFT JOIN development_stand_types st ON ds.stand_type_id = st.id
        LEFT JOIN clients c ON ds.client_id = c.id
        LEFT JOIN payment_transactions pt ON ds.id = pt.stand_id
        WHERE d.user_id = ${userId} AND d.id = ${developmentId}
        GROUP BY ds.id, si.stand_number, d.id, d.name, d.currency, st.label, st.base_price, c.phone, c.email
      `;
    } else {
      linkedStandsQuery = sql`
        SELECT 
          ds.id, ds.agreed_price, ds.status, ds.client_name, ds.client_id,
          ds.stand_inventory_id, si.stand_number,
          d.id as development_id, d.name as development_name, d.currency,
          st.label as stand_type_label, st.base_price as stand_type_base_price,
          c.phone as client_phone, c.email as client_email,
          COALESCE(SUM(pt.amount), 0) as total_paid
        FROM development_stands ds
        JOIN stand_inventory si ON ds.stand_inventory_id = si.id
        JOIN developments d ON ds.development_id = d.id
        LEFT JOIN development_stand_types st ON ds.stand_type_id = st.id
        LEFT JOIN clients c ON ds.client_id = c.id
        LEFT JOIN payment_transactions pt ON ds.id = pt.stand_id
        WHERE d.user_id = ${userId}
        GROUP BY ds.id, si.stand_number, d.id, d.name, d.currency, st.label, st.base_price, c.phone, c.email
      `;
    }

    const linkedStands = await linkedStandsQuery;

    const linkedWithTotals = linkedStands.map((stand: any) => {
      // Use agreed_price if set, otherwise fall back to stand type base_price
      const agreedPrice = parseFloat(stand.agreed_price || 0) > 0 
        ? parseFloat(stand.agreed_price || 0)
        : parseFloat(stand.stand_type_base_price || 0);
      const totalPaid = parseFloat(stand.total_paid || 0);
      
      return {
        id: stand.id,
        standInventoryId: stand.stand_inventory_id,
        standNumber: stand.stand_number,
        developmentId: stand.development_id,
        developmentName: stand.development_name,
        currency: stand.currency,
        standTypeLabel: stand.stand_type_label,
        status: stand.status,
        clientName: stand.client_name,
        clientPhone: stand.client_phone,
        clientEmail: stand.client_email,
        agreedPrice: agreedPrice,
        totalPaid: totalPaid,
        balance: agreedPrice - totalPaid,
        isStandalone: false,
      };
    });

    // 2. Fetch standalone stands (unassigned but have transactions)
    let standaloneStands: any[] = [];
    if (includeStandalone && !developmentId) {
      const standaloneResults = await sql`
        SELECT 
          si.id as stand_inventory_id,
          si.stand_number,
          COALESCE(SUM(pt.amount), 0) as total_paid
        FROM stand_inventory si
        JOIN payment_transactions pt ON si.id = pt.stand_inventory_id
        WHERE pt.user_id = ${userId} AND pt.stand_id IS NULL
        GROUP BY si.id, si.stand_number
      `;

      standaloneStands = standaloneResults.map((inv: any) => ({
        id: `standalone-${inv.stand_inventory_id}`,
        standInventoryId: inv.stand_inventory_id,
        standNumber: inv.stand_number,
        developmentId: null,
        developmentName: null,
        currency: "USD",
        standTypeLabel: null,
        status: "Unassigned",
        clientName: null,
        agreedPrice: 0,
        totalPaid: parseFloat(inv.total_paid || 0),
        balance: -parseFloat(inv.total_paid || 0),
        isStandalone: true,
      }));
    }

    let allStands = [...linkedWithTotals, ...standaloneStands];

    // 3. Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      allStands = allStands.filter(s =>
        s.standNumber?.toLowerCase().includes(searchLower) ||
        s.developmentName?.toLowerCase().includes(searchLower) ||
        s.clientName?.toLowerCase().includes(searchLower)
      );
    }

    return NextResponse.json({ stands: allStands });

  } catch (err) {
    console.error("Unexpected error in GET /api/stands:", err);
    return NextResponse.json({
      error: "Server error",
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}

// POST /api/stands - Create a new stand
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const sql = getDb();

    // 1. Create or get stand inventory
    // Note: This logic assumes developmentId:standNumber is unique if using dev link
    const standKey = body.developmentId
      ? `${body.developmentId}:${body.standNumber}`
      : `standalone:${userId}:${Date.now()}:${body.standNumber}`;

    const invResults = await sql`
      INSERT INTO stand_inventory (canonical_stand_key, stand_number)
      VALUES (${standKey}, ${body.standNumber})
      ON CONFLICT (canonical_stand_key) DO UPDATE 
      SET stand_number = EXCLUDED.stand_number
      RETURNING *
    `;
    const standInv = invResults[0];

    // 2. Create development stand (if development provided)
    if (body.developmentId) {
      const devStandResults = await sql`
        INSERT INTO development_stands (
          development_id, stand_inventory_id, stand_type_id,
          agreed_price, status, client_name
        ) VALUES (
          ${body.developmentId}, ${standInv.id}, ${body.standTypeId},
          ${body.agreedPrice}, ${body.status || "Available"}, ${body.clientName}
        ) RETURNING *
      `;
      return NextResponse.json(devStandResults[0], { status: 201 });
    }

    return NextResponse.json(standInv, { status: 201 });

  } catch (err) {
    console.error("Unexpected error in POST /api/stands:", err);
    return NextResponse.json({
      error: "Server error",
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}
