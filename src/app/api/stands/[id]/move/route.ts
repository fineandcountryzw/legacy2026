import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

// POST /api/stands/[id]/move - Move/link stand to development
export async function POST(
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
    const { developmentId, clientName, agreedPrice } = body;

    if (!developmentId) {
      return NextResponse.json({ error: "developmentId is required" }, { status: 400 });
    }

    const sql = getDb();

    // Verify target development exists and belongs to user
    const targetDev = await sql`
      SELECT id FROM developments 
      WHERE id = ${developmentId} AND user_id = ${userId}
    `;

    if (targetDev.length === 0) {
      return NextResponse.json({ error: "Target development not found or unauthorized" }, { status: 404 });
    }

    // Handle standalone stands (not yet linked to any development)
    if (id.startsWith("standalone-")) {
      const inventoryId = id.replace("standalone-", "");
      
      // Verify the stand inventory exists and has transactions for this user
      const standInv = await sql`
        SELECT si.id, si.stand_number 
        FROM stand_inventory si
        JOIN payment_transactions pt ON si.id = pt.stand_inventory_id
        WHERE si.id = ${inventoryId} AND pt.user_id = ${userId}
        LIMIT 1
      `;
      
      if (standInv.length === 0) {
        return NextResponse.json({ error: "Stand not found" }, { status: 404 });
      }

      // Check if already linked to this development
      const existing = await sql`
        SELECT id FROM development_stands
        WHERE development_id = ${developmentId} AND stand_inventory_id = ${inventoryId}
      `;

      if (existing.length > 0) {
        return NextResponse.json({ error: "Stand already linked to this development" }, { status: 400 });
      }

      // Create the link - insert into development_stands
      const results = await sql`
        INSERT INTO development_stands (
          development_id, stand_inventory_id, client_name, status, agreed_price
        ) VALUES (
          ${developmentId}, ${inventoryId}, ${clientName || null}, 'Sold', ${agreedPrice || 0}
        ) RETURNING *
      `;

      const newDevStand = results[0];

      // Update transactions to point to new development and stand
      await sql`
        UPDATE payment_transactions
        SET 
          development_id = ${developmentId},
          stand_id = ${newDevStand.id}
        WHERE stand_inventory_id = ${inventoryId} AND user_id = ${userId}
      `;

      return NextResponse.json(newDevStand);
    }

    // Handle existing linked stands (moving to different development)
    // Verify ownership of current stand
    const ownership = await sql`
      SELECT ds.id, ds.stand_inventory_id 
      FROM development_stands ds
      JOIN developments d ON ds.development_id = d.id
      WHERE ds.id = ${id} AND d.user_id = ${userId}
    `;

    if (ownership.length === 0) {
      return NextResponse.json({ error: "Unauthorized or stand not found" }, { status: 404 });
    }

    const standInvId = ownership[0].stand_inventory_id;

    // Check if stand already exists in target development
    const existing = await sql`
      SELECT id FROM development_stands
      WHERE development_id = ${developmentId} AND stand_inventory_id = ${standInvId}
    `;

    if (existing.length > 0) {
      return NextResponse.json({ error: "Stand already exists in target development" }, { status: 400 });
    }

    // Move the stand
    const results = await sql`
      UPDATE development_stands
      SET 
        development_id = ${developmentId},
        client_name = ${clientName || null}
      WHERE id = ${id}
      RETURNING *
    `;

    // Update transactions to point to new development
    await sql`
      UPDATE payment_transactions
      SET development_id = ${developmentId}
      WHERE stand_id = ${id}
    `;

    return NextResponse.json(results[0]);

  } catch (err) {
    console.error("Unexpected error in POST /api/stands/[id]/move:", err);
    return NextResponse.json({
      error: "Server error",
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}
