"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createDevelopment(formData: FormData) {
  const { userId } = await auth();
  
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const supabase = await createClient();

  const name = formData.get("name") as string;
  const code = formData.get("code") as string;
  const currency = formData.get("currency") as string;
  const developerName = formData.get("developerName") as string;
  const developerContacts = formData.get("developerContacts") as string;
  const commissionRate = parseFloat(formData.get("commissionRate") as string) / 100;

  const { data, error } = await supabase
    .from("developments")
    .insert({
      user_id: userId,
      name,
      code,
      currency: currency || "USD",
      developer_name: developerName,
      developer_contacts: developerContacts,
      commission_rate: commissionRate || 0.05,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/developments");
  return data;
}

export async function updateDevelopment(id: string, formData: FormData) {
  const { userId } = await auth();
  
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("developments")
    .update({
      name: formData.get("name") as string,
      code: formData.get("code") as string,
      currency: formData.get("currency") as string,
      developer_name: formData.get("developerName") as string,
      developer_contacts: formData.get("developerContacts") as string,
      commission_rate: parseFloat(formData.get("commissionRate") as string) / 100,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/developments");
  return data;
}

export async function deleteDevelopment(id: string) {
  const { userId } = await auth();
  
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("developments")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/developments");
}
