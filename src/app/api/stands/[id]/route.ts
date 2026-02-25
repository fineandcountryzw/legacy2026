import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/stands/[id] - Get stand details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const supabase = await createClient();

    const { data: stand, error } = await supabase
      .from("development_stands")
      .select(`
        id,
        agreed_price,
        status,
        client_name,
        stand_inventory:stand_inventory_id (
          stand_number
        ),
        development:development_id (
          id,
          name,
          currency,
          developer_name
        ),
        stand_type:stand_type_id (
          label,
          size_sqm
        )
      `)
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching stand:", error);
      return NextResponse.json({ 
        error: "Stand not found", 
        details: error.message 
      }, { status: 404 });
    }

    // Get transactions for this stand
    const { data: transactions } = await supabase
      .from("payment_transactions")
      .select("*")
      .eq("stand_id", id)
      .order("transaction_date", { ascending: false });

    const totalPaid = transactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
    const agreedPrice = stand.agreed_price || 0;

    const standWithDetails = {
      id: stand.id,
      standNumber: stand.stand_inventory?.stand_number,
      developmentId: stand.development?.id,
      developmentName: stand.development?.name,
      developerName: stand.development?.developer_name,
      currency: stand.development?.currency,
      standTypeLabel: stand.stand_type?.label,
      standSize: stand.stand_type?.size_sqm,
      status: stand.status,
      clientName: stand.client_name,
      agreedPrice,
      totalPaid,
      balance: agreedPrice - totalPaid,
      transactions: transactions || [],
    };

    return NextResponse.json(standWithDetails);

  } catch (err) {
    console.error("Unexpected error in GET /api/stands/[id]:", err);
    return NextResponse.json({ 
      error: "Server error", 
      details: err instanceof Error ? err.message : "Unknown error" 
    }, { status: 500 });
  }
}

// PUT /api/stands/[id] - Update stand
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const supabase = await createClient();

    const { data: stand, error } = await supabase
      .from("development_stands")
      .update({
        agreed_price: body.agreedPrice,
        status: body.status,
        client_name: body.clientName,
        stand_type_id: body.standTypeId,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ 
        error: "Failed to update stand", 
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json(stand);

  } catch (err) {
    console.error("Unexpected error in PUT /api/stands/[id]:", err);
    return NextResponse.json({ 
      error: "Server error", 
      details: err instanceof Error ? err.message : "Unknown error" 
    }, { status: 500 });
  }
}

// DELETE /api/stands/[id] - Delete stand
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const supabase = await createClient();

    const { error } = await supabase
      .from("development_stands")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ 
        error: "Failed to delete stand", 
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("Unexpected error in DELETE /api/stands/[id]:", err);
    return NextResponse.json({ 
      error: "Server error", 
      details: err instanceof Error ? err.message : "Unknown error" 
    }, { status: 500 });
  }
}
