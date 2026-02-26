"use server"

import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function createDevelopment(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const sql = getDb();
  const name = formData.get("name") as string;
  const code = formData.get("code") as string;
  const currency = formData.get("currency") as string;
  const developerName = formData.get("developerName") as string;
  const developerContacts = formData.get("developerContacts") as string;
  const commissionFixed = parseFloat(formData.get("commissionFixed") as string) || 0;

  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const address = formData.get("address") as string;
  const website = formData.get("website") as string;

  const primaryColor = formData.get("primaryColor") as string || "#0f172a";
  const secondaryColor = formData.get("secondaryColor") as string || "#2563eb";
  const accentColor = formData.get("accentColor") as string || "#3b82f6";

  // Validation
  if (!name || name.trim() === "") {
    throw new Error("Development name is required");
  }
  if (!code || code.trim() === "") {
    throw new Error("Development code is required");
  }

  // Check for duplicate code
  const existing = await sql`
    SELECT id FROM developments 
    WHERE user_id = ${userId} AND code = ${code.trim()}
  `;
  
  if (existing.length > 0) {
    throw new Error(`A development with code "${code.trim()}" already exists. Please use a different code.`);
  }

  const results = await sql`
    INSERT INTO developments (
      user_id, name, code, currency, developer_name, 
      developer_contacts, commission_rate,
      email, phone, address, website,
      primary_color, secondary_color, accent_color
    ) VALUES (
      ${userId}, ${name.trim()}, ${code.trim()}, ${currency || "USD"}, 
      ${developerName?.trim() || null}, ${developerContacts?.trim() || null}, ${commissionFixed},
      ${email?.trim() || null}, ${phone?.trim() || null}, ${address?.trim() || null}, ${website?.trim() || null},
      ${primaryColor}, ${secondaryColor}, ${accentColor}
    ) RETURNING *
  `;

  const dev = results[0];

  const standTypesRaw = formData.get("standTypes");
  if (standTypesRaw) {
    const types = JSON.parse(standTypesRaw as string);
    for (const st of types) {
      await sql`
        INSERT INTO development_stand_types (development_id, label, size_sqm, base_price)
        VALUES (${dev.id}, ${st.label}, ${st.sizeSqm}, ${st.basePrice})
      `;
    }
  }

  const costsRaw = formData.get("costs");
  if (costsRaw) {
    const costs = JSON.parse(costsRaw as string);
    for (const c of costs) {
      // Normalize pay_to value
      let payTo = c.payTo;
      if (payTo === 'Fine & Country') payTo = 'fine_country';
      if (payTo === 'Developer') payTo = 'developer';
      if (payTo === 'Third Party') payTo = 'third_party';
      
      await sql`
        INSERT INTO development_cost_items (development_id, name, cost_type, value, applies_to, pay_to)
        VALUES (${dev.id}, ${c.name}, ${c.type}, ${c.value}, ${c.appliesTo || "all"}, ${payTo})
      `;
    }
  }

  revalidatePath("/dashboard/developments");
  return dev;
}

export async function updateDevelopment(id: string, formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // Debug: Log all form data entries
  console.log("=== UPDATE DEVELOPMENT ===");
  console.log("ID:", id);
  for (const [key, value] of formData.entries()) {
    console.log(`  ${key}: "${value}"`);
  }

  const sql = getDb();
  const commissionFixed = parseFloat(formData.get("commissionFixed") as string) || 0;

  const name = formData.get("name") as string;
  const code = formData.get("code") as string;
  
  console.log("Extracted - name:", name, "code:", code);
  const currency = formData.get("currency") as string;
  const developerName = formData.get("developerName") as string;
  const developerContacts = formData.get("developerContacts") as string;

  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const address = formData.get("address") as string;
  const website = formData.get("website") as string;

  const primaryColor = formData.get("primaryColor") as string;
  const secondaryColor = formData.get("secondaryColor") as string;
  const accentColor = formData.get("accentColor") as string;

  // Validation
  if (!name || name.trim() === "") {
    throw new Error("Development name is required");
  }
  if (!code || code.trim() === "") {
    throw new Error("Development code is required");
  }

  // Check for duplicate code (excluding current development)
  const existing = await sql`
    SELECT id FROM developments 
    WHERE user_id = ${userId} AND code = ${code.trim()} AND id != ${id}
  `;
  
  if (existing.length > 0) {
    throw new Error(`A development with code "${code.trim()}" already exists. Please use a different code.`);
  }

  const results = await sql`
    UPDATE developments
    SET
      name = ${name.trim()},
      code = ${code.trim()},
      currency = ${currency},
      developer_name = ${developerName?.trim() || null},
      developer_contacts = ${developerContacts?.trim() || null},
      commission_rate = ${commissionFixed},
      email = ${email?.trim() || null},
      phone = ${phone?.trim() || null},
      address = ${address?.trim() || null},
      website = ${website?.trim() || null},
      primary_color = ${primaryColor},
      secondary_color = ${secondaryColor},
      accent_color = ${accentColor},
      updated_at = NOW()
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING *
  `;

  if (results.length === 0) throw new Error("Development not found");

  const standTypesRaw = formData.get("standTypes");
  if (standTypesRaw) {
    const types = JSON.parse(standTypesRaw as string);
    await sql`DELETE FROM development_stand_types WHERE development_id = ${id}`;
    for (const st of types) {
      await sql`
        INSERT INTO development_stand_types (development_id, label, size_sqm, base_price)
        VALUES (${id}, ${st.label}, ${st.sizeSqm}, ${st.basePrice})
      `;
    }
  }

  const costsRaw = formData.get("costs");
  if (costsRaw) {
    const costs = JSON.parse(costsRaw as string);
    await sql`DELETE FROM development_cost_items WHERE development_id = ${id}`;
    for (const c of costs) {
      // Normalize pay_to value
      let payTo = c.payTo;
      if (payTo === 'Fine & Country') payTo = 'fine_country';
      if (payTo === 'Developer') payTo = 'developer';
      if (payTo === 'Third Party') payTo = 'third_party';
      
      await sql`
        INSERT INTO development_cost_items (development_id, name, cost_type, value, applies_to, pay_to)
        VALUES (${id}, ${c.name}, ${c.type}, ${c.value}, ${c.appliesTo || "all"}, ${payTo})
      `;
    }
  }

  revalidatePath("/dashboard/developments");
  return results[0];
}

export async function deleteDevelopment(id: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const sql = getDb();
  await sql`DELETE FROM developments WHERE id = ${id} AND user_id = ${userId}`;

  revalidatePath("/dashboard/developments");
}
