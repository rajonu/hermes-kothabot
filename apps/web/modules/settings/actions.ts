"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateShopSettings(formData: FormData) {
  const supabase = await createClient();
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const name         = formData.get("name")         as string;
  const systemPrompt = formData.get("systemPrompt") as string;
  const language     = formData.get("language")     as string;
  const personality  = formData.get("personality")  as string;
  const greeting     = formData.get("greeting")     as string;
  const primaryColor = formData.get("primaryColor") as string;

  // collect_fields from checkboxes (hidden inputs, '1' = checked)
  const collectName    = formData.get("collect_name")    !== '0';
  const collectPhone   = formData.get("collect_phone")   !== '0';
  const collectAddress = formData.get("collect_address") !== '0';
  const enableVoice    = formData.get("enable_voice")    !== '0';
  const enableChat     = formData.get("enable_chat")     !== '0';

  const { data: shop } = await db.from("shops")
    .select("id, ai_config, widget_config")
    .eq("owner_id", user.id).single();
  if (!shop) return { error: "Shop not found" };

  const { error } = await db.from("shops").update({
    name: name || shop.name,
    // NOTE: category is intentionally NOT updated here — locked after registration
    ai_config: {
      ...shop.ai_config,
      systemPrompt: systemPrompt ?? shop.ai_config?.systemPrompt ?? "",
      language:     language    || "auto",
      personality:  personality || "professional",
      collect_fields: {
        name:    true,           // name is always required
        phone:   collectPhone,
        address: collectAddress,
      },
    },
    widget_config: {
      ...shop.widget_config,
      greeting:     greeting     || shop.widget_config?.greeting,
      primaryColor: primaryColor || shop.widget_config?.primaryColor,
      enableVoice,
      enableChat,
    },
  }).eq("id", shop.id);

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { success: true };
}

export async function updateTelephonySettings(shopId: string, telephony: any) {
  const supabase = await createClient();
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: shop } = await db.from("shops")
    .select("id, ai_config")
    .eq("id", shopId).single();

  if (!shop) return { error: "Shop not found" };

  const updatedAiConfig = {
    ...shop.ai_config,
    telephony: telephony ? {
      number: telephony.number,
      host: telephony.host || 'managed',
      username: telephony.username || telephony.number,
      password: telephony.password || '',
      channels: telephony.channels ? parseInt(telephony.channels) : 3,
      status: "active",
      updatedAt: new Date().toISOString()
    } : null
  };

  const { error } = await db.from("shops").update({
    ai_config: updatedAiConfig
  }).eq("id", shopId);

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { success: true };
}

