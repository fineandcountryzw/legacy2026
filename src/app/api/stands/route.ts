import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

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
    const includeStandalone = searchParams.get("standalone") !== "false"; // default: include standalone

    const supabase = await createClient();

    // --- Part 1: Linked stands (via development_stands) ---
    let linkedQuery = supabase
      .from("development_stands")
      .select(`
        id,
        agreed_price,
        status,
        client_name,
        stand_inventory:stand_inventory_id (
          id,
          stand_number
        ),
        development:development_id (
          id,
          name,
          currency
        ),
        stand_type:stand_type_id (
          label
        )
      `);

    if (developmentId) {
      linkedQuery = linkedQuery.eq("development_id", developmentId);
    }

    // Filter by user's developments
    const { data: userDevelopments } = await supabase
      .from("developments")
      .select("id")
      .eq("user_id", userId);

    const developmentIds = userDevelopments?.map(d => d.id) || [];
    if (developmentIds.length > 0) {
      linkedQuery = linkedQuery.in("development_id", developmentIds);
    } else {
      // User has no developments — skip linked stands
      linkedQuery = linkedQuery.in("development_id", ['__none__']);
    }

    const { data: linkedStands, error: linkedError } = await linkedQuery.order("created_at", { ascending: false });

    if (linkedError) {
      console.error("Error fetching linked stands:", linkedError);
      return NextResponse.json({ error: "Database error", details: linkedError.message }, { status: 500 });
    }

    // Calculate totals for linked stands
    const linkedWithTotals = await Promise.all(
      (linkedStands || []).map(async (stand: any) => {
        const { data: transactions } = await supabase
          .from("payment_transactions")
          .select("amount")
          .eq("stand_id", stand.id);

        const totalPaid = transactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
        const agreedPrice = stand.agreed_price || 0;
        const standInventory = Array.isArray(stand.stand_inventory) ? stand.stand_inventory[0] : stand.stand_inventory;
        const development = Array.isArray(stand.development) ? stand.development[0] : stand.development;
        const standType = Array.isArray(stand.stand_type) ? stand.stand_type[0] : stand.stand_type;

        return {
          id: stand.id,
          standInventoryId: standInventory?.id,
          standNumber: standInventory?.stand_number,
          developmentId: development?.id,
          developmentName: development?.name,
          currency: development?.currency,
          standTypeLabel: standType?.label,
          status: stand.status,
          clientName: stand.client_name,
          agreedPrice,
          totalPaid,
          balance: agreedPrice - totalPaid,
          isStandalone: false,
        };
      })
    );

    // --- Part 2: Standalone stands (in stand_inventory but NOT in development_stands) ---
    let standaloneStands: any[] = [];

    if (includeStandalone && !developmentId) {
      // Get stand_inventory ids that are already linked to a development
      const linkedInvIds = linkedWithTotals
        .map(s => s.standInventoryId)
        .filter(Boolean);

      // Get all stand_inventory that have transactions for this user but no dev link
      const { data: standaloneInventory } = await supabase
        .from("stand_inventory")
        .select("id, stand_number, canonical_stand_key")
        .not("id", 'in', linkedInvIds.length > 0 ? `(${linkedInvIds.join(',')})` : '(__none__)');

      if (standaloneInventory && standaloneInventory.length > 0) {
        // Only show those that have transactions belonging to this user
        standaloneStands = await Promise.all(
          standaloneInventory.map(async (inv: any) => {
            const { data: transactions } = await supabase
              .from("payment_transactions")
              .select("amount, category")
              .eq("stand_inventory_id", inv.id)
              .eq("user_id", userId);

            if (!transactions || transactions.length === 0) return null;

            const totalPaid = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);

            return {
              id: `standalone-${inv.id}`,
              standInventoryId: inv.id,
              standNumber: inv.stand_number,
              developmentId: null,
              developmentName: null,
              currency: "USD",
              standTypeLabel: null,
              status: "Unassigned",
              clientName: null,
              agreedPrice: 0,
              totalPaid,
              balance: -totalPaid,
              isStandalone: true,
            };
          })
        );
        standaloneStands = standaloneStands.filter(Boolean);
      }
    }

    let allStands = [...linkedWithTotals, ...standaloneStands];

    // Apply search filter
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
    const supabase = await createClient();

    // First create stand inventory
    const { data: standInv, error: invError } = await supabase
      .from("stand_inventory")
      .insert({
        canonical_stand_key: `${body.developmentId}:${body.standNumber}`,
        stand_number: body.standNumber,
      })
      .select()
      .single();

    if (invError) {
      return NextResponse.json({
        error: "Failed to create stand inventory",
        details: invError.message
      }, { status: 500 });
    }

    // Then create development stand (if development provided)
    if (body.developmentId) {
      const { data: stand, error: standError } = await supabase
        .from("development_stands")
        .insert({
          development_id: body.developmentId,
          stand_inventory_id: standInv.id,
          stand_type_id: body.standTypeId,
          agreed_price: body.agreedPrice,
          status: body.status || "Available",
          client_name: body.clientName,
        })
        .select()
        .single();

      if (standError) {
        return NextResponse.json({
          error: "Failed to create development stand",
          details: standError.message
        }, { status: 500 });
      }

      return NextResponse.json(stand, { status: 201 });
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
