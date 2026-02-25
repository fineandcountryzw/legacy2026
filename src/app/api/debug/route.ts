import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const supabase = await createClient();
    
    // Test: Check if we can query developments
    const { data: developments, error: devError } = await supabase
      .from("developments")
      .select("*")
      .limit(5);
    
    return NextResponse.json({
      authenticated: true,
      clerkUserId: userId,
      supabaseQuery: {
        success: !devError,
        count: developments?.length || 0,
        error: devError?.message || null,
        code: devError?.code || null,
        sample: developments?.[0] || null
      },
      env: {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? "Set" : "Missing",
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? "Set" : "Missing"
      }
    });
    
  } catch (err) {
    return NextResponse.json({
      error: "Debug endpoint failed",
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}
