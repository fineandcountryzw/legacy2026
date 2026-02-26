import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

// GET /api/brand-profile - Get user's brand profile
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sql = getDb();
    const profiles = await sql`
      SELECT * FROM brand_profiles 
      WHERE user_id = ${userId} 
      AND is_global = true 
      LIMIT 1
    `;

    if (profiles.length === 0) {
      return NextResponse.json(null);
    }

    const profile = profiles[0];
    return NextResponse.json({
      id: profile.id,
      companyName: profile.company_name,
      logoUrl: profile.logo_url,
      primaryColor: profile.primary_color,
      secondaryColor: profile.secondary_color,
      accentColor: profile.accent_color,
      contactDetails: profile.contact_details || {},
    });

  } catch (err) {
    console.error("Error fetching brand profile:", err);
    return NextResponse.json({
      error: "Server error",
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}
