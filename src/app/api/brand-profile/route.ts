import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

function sql() {
  return getDb();
}

/**
 * GET /api/brand-profile
 * Get the brand profile for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const db = getDb();
    
    const result = await db`
      SELECT * FROM brand_profiles WHERE user_id = ${userId}
    `;
    
    if (result.length === 0) {
      return NextResponse.json({ brandProfile: null });
    }
    
    return NextResponse.json({ brandProfile: result[0] });
  } catch (err) {
    console.error("Error in GET /api/brand-profile:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/brand-profile
 * Create or update brand profile
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const body = await request.json();
    const db = getDb();
    
    // Check if profile exists
    const existing = await db`
      SELECT id FROM brand_profiles WHERE user_id = ${userId}
    `;
    
    let result;
    if (existing.length > 0) {
      // Update
      result = await db`
        UPDATE brand_profiles
        SET 
          company_name = ${body.companyName || null},
          logo_url = ${body.logoUrl || null},
          primary_color = ${body.primaryColor || null},
          secondary_color = ${body.secondaryColor || null},
          address = ${body.address || null},
          phone = ${body.phone || null},
          email = ${body.email || null},
          website = ${body.website || null},
          updated_at = NOW()
        WHERE user_id = ${userId}
        RETURNING *
      `;
    } else {
      // Create
      result = await db`
        INSERT INTO brand_profiles (
          user_id,
          company_name,
          logo_url,
          primary_color,
          secondary_color,
          address,
          phone,
          email,
          website
        ) VALUES (
          ${userId},
          ${body.companyName || null},
          ${body.logoUrl || null},
          ${body.primaryColor || null},
          ${body.secondaryColor || null},
          ${body.address || null},
          ${body.phone || null},
          ${body.email || null},
          ${body.website || null}
        )
        RETURNING *
      `;
    }
    
    return NextResponse.json({ brandProfile: result[0] });
  } catch (err) {
    console.error("Error in POST /api/brand-profile:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
