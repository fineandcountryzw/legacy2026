import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  // Log key length for debugging (don't log the actual key)
  console.log("Supabase URL:", supabaseUrl);
  console.log("Service Role Key length:", serviceRoleKey.length);
  console.log("Key starts with:", serviceRoleKey.substring(0, 10) + "...");

  return createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
