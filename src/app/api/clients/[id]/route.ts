import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/clients/[id] - Get client details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createClient();

    const { data: client, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error("Error fetching client:", error);
      return NextResponse.json({ 
        error: "Client not found", 
        details: error.message 
      }, { status: 404 });
    }

    // Get stands for this client
    const { data: stands } = await supabase
      .from("development_stands")
      .select(`
        id,
        agreed_price,
        status,
        development:development_id (
          name,
          currency
        ),
        stand_inventory:stand_inventory_id (
          stand_number
        )
      `)
      .eq("client_id", id);

    // Get receipts/payments for this client
    const { data: receipts } = await supabase
      .from("payment_transactions")
      .select(`
        *,
        stand:stand_id (
          stand_inventory:stand_inventory_id (
            stand_number
          )
        )
      `)
      .eq("client_id", id)
      .order("transaction_date", { ascending: false });

    const standsWithBalances = (stands || []).map((stand: any) => {
      const standReceipts = receipts?.filter(r => r.stand_id === stand.id) || [];
      const totalPaid = standReceipts.reduce((sum, r) => sum + (r.amount || 0), 0);
      return {
        id: stand.id,
        standNumber: stand.stand_inventory?.stand_number,
        developmentName: stand.development?.name,
        currency: stand.development?.currency,
        status: stand.status,
        agreedPrice: stand.agreed_price,
        totalPaid,
        balance: (stand.agreed_price || 0) - totalPaid,
      };
    });

    const totalPaid = standsWithBalances.reduce((sum, s) => sum + s.totalPaid, 0);
    const totalBalance = standsWithBalances.reduce((sum, s) => sum + s.balance, 0);

    const clientWithDetails = {
      ...client,
      stands: standsWithBalances,
      receipts: receipts || [],
      totalPaid,
      totalBalance,
    };

    return NextResponse.json(clientWithDetails);

  } catch (err) {
    console.error("Unexpected error in GET /api/clients/[id]:", err);
    return NextResponse.json({ 
      error: "Server error", 
      details: err instanceof Error ? err.message : "Unknown error" 
    }, { status: 500 });
  }
}

// PUT /api/clients/[id] - Update client
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const supabase = await createClient();

    const { data: client, error } = await supabase
      .from("clients")
      .update({
        name: body.name,
        email: body.email,
        phone: body.phone,
        id_number: body.idNumber,
      })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ 
        error: "Failed to update client", 
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json(client);

  } catch (err) {
    console.error("Unexpected error in PUT /api/clients/[id]:", err);
    return NextResponse.json({ 
      error: "Server error", 
      details: err instanceof Error ? err.message : "Unknown error" 
    }, { status: 500 });
  }
}

// DELETE /api/clients/[id] - Delete client
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createClient();

    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      return NextResponse.json({ 
        error: "Failed to delete client", 
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("Unexpected error in DELETE /api/clients/[id]:", err);
    return NextResponse.json({ 
      error: "Server error", 
      details: err instanceof Error ? err.message : "Unknown error" 
    }, { status: 500 });
  }
}
