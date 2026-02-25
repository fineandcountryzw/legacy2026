import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/developments
export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    // Simple query first - just developments
    const { data: developments, error } = await supabase
      .from("developments")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching developments:", error);
      return NextResponse.json({ 
        error: "Database error", 
        details: error.message,
        code: error.code 
      }, { status: 500 });
    }

    // Fetch related data separately to avoid join issues
    const developmentIds = developments?.map(d => d.id) || [];
    
    let standTypes: any[] = [];
    let costItems: any[] = [];
    
    if (developmentIds.length > 0) {
      const { data: sts } = await supabase
        .from("development_stand_types")
        .select("*")
        .in("development_id", developmentIds);
      standTypes = sts || [];
      
      const { data: cis } = await supabase
        .from("development_cost_items")
        .select("*")
        .in("development_id", developmentIds);
      costItems = cis || [];
    }

    // Transform to match frontend types
    const transformed = developments?.map((dev: any) => ({
      id: dev.id,
      name: dev.name,
      code: dev.code,
      currency: dev.currency,
      developerName: dev.developer_name,
      developerContacts: dev.developer_contacts,
      commissionRate: dev.commission_rate,
      totalStands: 0,
      soldStands: 0,
      availableStands: 0,
      totalReceived: 0,
      developerPayable: 0,
      fineCountryRetain: 0,
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
    })) || [];

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
    const supabase = await createClient();

    // Insert development
    const { data: development, error: devError } = await supabase
      .from("developments")
      .insert({
        user_id: userId,
        name: body.name,
        code: body.code,
        currency: body.currency || "USD",
        developer_name: body.developerName,
        developer_contacts: body.developerContacts,
        commission_rate: body.commissionRate || 0.05,
      })
      .select()
      .single();

    if (devError) {
      console.error("Error creating development:", devError);
      return NextResponse.json({ 
        error: "Failed to create development", 
        details: devError.message,
        code: devError.code 
      }, { status: 500 });
    }

    // Insert stand types if provided
    if (body.standTypes?.length > 0) {
      const { error: stError } = await supabase
        .from("development_stand_types")
        .insert(
          body.standTypes.map((st: any) => ({
            development_id: development.id,
            label: st.label,
            size_sqm: st.sizeSqm,
            base_price: st.basePrice,
            is_active: st.isActive ?? true,
          }))
        );

      if (stError) {
        console.error("Error creating stand types:", stError);
      }
    }

    // Insert cost items if provided
    if (body.costs?.length > 0) {
      const { error: costError } = await supabase
        .from("development_cost_items")
        .insert(
          body.costs.map((c: any) => ({
            development_id: development.id,
            name: c.name,
            cost_type: c.type,
            value: c.value,
            applies_to: c.appliesTo || "all",
            pay_to: c.payTo,
            is_variable: c.isVariable ?? false,
            is_active: c.isActive ?? true,
          }))
        );

      if (costError) {
        console.error("Error creating cost items:", costError);
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
