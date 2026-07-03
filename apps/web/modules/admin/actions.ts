'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/admin';
import { revalidatePath } from 'next/cache';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) {
    throw new Error('Unauthorized');
  }
  return user;
}

export async function updateShopModel(shopId: string, model: string) {
  await requireAdmin();
  const db = createAdminClient();

  // Read existing ai_config
  const { data: shop } = await (db as any)
    .from('shops')
    .select('ai_config')
    .eq('id', shopId)
    .single();

  const existingConfig = shop?.ai_config ?? {};

  const { error } = await (db as any)
    .from('shops')
    .update({ ai_config: { ...existingConfig, ai_model: model } })
    .eq('id', shopId);

  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  revalidatePath(`/admin/shops/${shopId}`);
  return { success: true };
}

export async function updateShopTextModel(shopId: string, model: string) {
  await requireAdmin();
  const db = createAdminClient();

  const { data: shop } = await (db as any)
    .from('shops')
    .select('ai_config')
    .eq('id', shopId)
    .single();

  const existingConfig = shop?.ai_config ?? {};

  const { error } = await (db as any)
    .from('shops')
    .update({ ai_config: { ...existingConfig, text_model: model } })
    .eq('id', shopId);

  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  revalidatePath(`/admin/shops/${shopId}`);
  return { success: true };
}

export async function updateShopStatus(shopId: string, isActive: boolean) {
  await requireAdmin();
  const db = createAdminClient();

  const { error } = await (db as any)
    .from('shops')
    .update({ onboarding_done: isActive }) // repurpose to track active state
    .eq('id', shopId);

  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  return { success: true };
}
