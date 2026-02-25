import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/clients - Get all clients for the current user
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");

    const supabase = await createClient();

    let query = supabase
      .from("clients")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,id_number.ilike.%${search}%`);
    }

    const { data: clients, error } = await query;

    if (error) {
      console.error("Error fetching clients:", error);
      return NextResponse.json({ 
        error: "Database error", 
        details: error.message 
      }, { status: 500 });
    }

    // Get stands count and totals for each client
    const clientsWithDetails = await Promise.all(
      (clients || []).map(async (client: any) => {
        const { data: stands } = await supabase
          .from("development_stands")
          .select("id, agreed_price")
          .eq("client_id", client.id);

        const standsCount = stands?.length || 0;
        
        // Get total paid across all client stands
        const standIds = stands?.map(s => s.id) || [];
        let totalPaid = 0;
        
        if (standIds.length > 0) {
          const { data: transactions } = await supabase
            .from("payment_transactions")
            .select("amount")
            .in("stand_id", standIds);
          
          totalPaid = transactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
        }

        const totalAgreed = stands?.reduce((sum, s) => sum + (s.agreed_price || 0), 0) || 0;

        return {
          ...client,
          standsCount,
          totalPaid,
          balance: totalAgreed - totalPaid,
        };
      })
    );

    return NextResponse.json({ clients: clientsWithDetails });

  } catch (err) {
    console.error("Unexpected error in GET /api/clients:", err);
    return NextResponse.json({ 
      error: "Server error", 
      details: err instanceof Error ? err.message : "Unknown error" 
    }, { status: 500 });
  }
}

// POST /api/clients - Create a new client
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const supabase = await createClient();

    const { data: client, error } = await supabase
      .from("clients")
      .insert({
        user_id: userId,
        name: body.name,
        email: body.email,
        phone: body.phone,
        id_number: body.idNumber,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating client:", error);
      return NextResponse.json({ 
        error: "Failed to create client", 
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json(client, { status: 201 });

  } catch (err) {
    console.error("Unexpected error in POST /api/clients:", err);
    return NextResponse.json({ 
      error: "Server error", 
      details: err instanceof Error ? err.message : "Unknown error" 
    }, { status: 500 });
  }
}
