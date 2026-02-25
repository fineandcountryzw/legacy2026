import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const results: any = {
    env: {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? "Set" : "Missing",
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? "Set (length: " + (process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0) + ")" : "Missing",
    },
    tests: []
  };

  try {
    // Test 1: Create client directly
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({
        ...results,
        error: "Missing environment variables"
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    results.tests.push({ name: "Client created", status: "ok" });

    // Test 2: Query developments table
    const { data: devs, error: devError } = await supabase
      .from("developments")
      .select("count")
      .limit(1);

    if (devError) {
      results.tests.push({ 
        name: "Developments table", 
        status: "error", 
        error: devError.message,
        code: devError.code
      });
    } else {
      results.tests.push({ name: "Developments table", status: "ok" });
    }

    // Test 3: Query with user_id filter (simulating actual API)
    const { data: userDevs, error: userError } = await supabase
      .from("developments")
      .select("*")
      .eq("user_id", "test_user_id")
      .limit(1);

    if (userError) {
      results.tests.push({ 
        name: "User filter query", 
        status: "error", 
        error: userError.message,
        code: userError.code
      });
    } else {
      results.tests.push({ name: "User filter query", status: "ok", count: userDevs?.length || 0 });
    }

    return NextResponse.json(results);

  } catch (err) {
    return NextResponse.json({
      ...results,
      error: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}
