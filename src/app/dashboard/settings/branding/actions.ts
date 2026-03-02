"use server"

import { auth } from "@clerk/nextjs/server"
import { getDb } from "@/lib/db"
import { revalidatePath } from "next/cache"

export async function getBrandProfile() {
    const session = await auth()
    if (!userId) throw new Error("Unauthorized")

    const sql = getDb()
    const profiles = await sql`
        SELECT * FROM brand_profiles 
        WHERE user_id = ${userId} 
        AND is_global = true 
        LIMIT 1
    `
    return profiles[0] || null
}

export async function saveBrandProfile(formData: {
    companyName: string
    primaryColor: string
    secondaryColor: string
    accentColor: string
    address: string
    email: string
    website: string
    logoUrl?: string | null
}) {
    const session = await auth()
    if (!userId) throw new Error("Unauthorized")

    const sql = getDb()

    // Check if profile exists
    const existing = await sql`
        SELECT id FROM brand_profiles 
        WHERE user_id = ${userId} AND is_global = true 
        LIMIT 1
    `

    const contactDetails = JSON.stringify({
        address: formData.address,
        email: formData.email,
        website: formData.website
    })

    let results
    if (existing.length > 0) {
        results = await sql`
            UPDATE brand_profiles
            SET
                company_name = ${formData.companyName},
                primary_color = ${formData.primaryColor},
                secondary_color = ${formData.secondaryColor},
                accent_color = ${formData.accentColor},
                logo_url = ${formData.logoUrl || null},
                contact_details = ${contactDetails},
                updated_at = NOW()
            WHERE id = ${existing[0].id}
            RETURNING *
        `
    } else {
        results = await sql`
            INSERT INTO brand_profiles (
                user_id, company_name, primary_color, secondary_color, 
                accent_color, logo_url, contact_details, is_global
            ) VALUES (
                ${userId}, ${formData.companyName}, ${formData.primaryColor}, 
                ${formData.secondaryColor}, ${formData.accentColor}, 
                ${formData.logoUrl || null}, ${contactDetails}, true
            ) RETURNING *
        `
    }

    revalidatePath("/dashboard/settings/branding")
    return results[0]
}
