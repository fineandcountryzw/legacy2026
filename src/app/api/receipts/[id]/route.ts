import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/receipts/[id] - Get receipt details
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

    const { data: upload, error } = await supabase
      .from("uploads")
      .select(`
        *,
        development:development_id (
          name,
          currency
        )
      `)
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error("Error fetching receipt:", error);
      return NextResponse.json({ 
        error: "Receipt not found", 
        details: error.message 
      }, { status: 404 });
    }

    // Get transactions for this receipt
    const { data: transactions } = await supabase
      .from("payment_transactions")
      .select(`
        *,
        stand:stand_id (
          stand_inventory:stand_inventory_id (
            stand_number
          ),
          client_name,
          development:development_id (
            name
          )
        )
      `)
      .eq("upload_id", id);

    const receiptWithDetails = {
      id: upload.id,
      receiptNumber: upload.file_name?.replace(/\.[^/.]+$/, ""),
      date: upload.created_at,
      status: upload.status,
      development: upload.development,
      rawData: upload.raw_data,
      transactions: transactions || [],
      totalAmount: transactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0,
    };

    return NextResponse.json(receiptWithDetails);

  } catch (err) {
    console.error("Unexpected error in GET /api/receipts/[id]:", err);
    return NextResponse.json({ 
      error: "Server error", 
      details: err instanceof Error ? err.message : "Unknown error" 
    }, { status: 500 });
  }
}

// PUT /api/receipts/[id] - Void a receipt (update status)
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

    // Update upload status
    const { data: upload, error } = await supabase
      .from("uploads")
      .update({
        status: body.status || "Completed",
        error_message: body.notes || null,
      })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ 
        error: "Failed to update receipt", 
        details: error.message 
      }, { status: 500 });
    }

    // If voiding, update related transactions
    if (body.status === "Failed") {
      await supabase
        .from("payment_transactions")
        .update({ status: "Voided" })
        .eq("upload_id", id);
    }

    return NextResponse.json(upload);

  } catch (err) {
    console.error("Unexpected error in PUT /api/receipts/[id]:", err);
    return NextResponse.json({ 
      error: "Server error", 
      details: err instanceof Error ? err.message : "Unknown error" 
    }, { status: 500 });
  }
}

// DELETE /api/receipts/[id] - Delete receipt
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

    // First delete related transactions
    await supabase
      .from("payment_transactions")
      .delete()
      .eq("upload_id", id);

    // Then delete the upload (receipt)
    const { error } = await supabase
      .from("uploads")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      return NextResponse.json({ 
        error: "Failed to delete receipt", 
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("Unexpected error in DELETE /api/receipts/[id]:", err);
    return NextResponse.json({ 
      error: "Server error", 
      details: err instanceof Error ? err.message : "Unknown error" 
    }, { status: 500 });
  }
}
