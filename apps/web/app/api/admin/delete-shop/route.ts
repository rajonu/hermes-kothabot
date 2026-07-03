import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdminSession } from '@/lib/admin-session';

export async function POST(req: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const { shopId, shopName } = await req.json();
  if (!shopId) return NextResponse.json({ error: 'Missing shopId' }, { status: 400 });

  const db = createAdminClient();

  // Get shop + owner before any deletions
  const { data: shop, error: fetchErr } = await (db as any)
    .from('shops')
    .select('owner_id, ai_config')
    .eq('id', shopId)
    .single();

  if (fetchErr || !shop) {
    return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
  }

  const errors: string[] = [];

  async function wipe(table: string, column = 'shop_id') {
    const { error } = await (db as any).from(table).delete().eq(column, shopId);
    if (error) errors.push(`${table}: ${error.message}`);
  }

  // ── Step 1: Delete child tables first (FK order matters) ────────────────
  // orders reference customers → delete orders before customers
  await wipe('support_tickets');
  await wipe('training_data');
  await wipe('payment_requests');
  await wipe('invoices');
  await wipe('voice_sessions');
  await wipe('orders');        // has FK → customers, delete before customers
  await wipe('customers');
  await wipe('subscriptions');
  await wipe('products');
  await wipe('login_activity');

  // ── Step 2: Delete admin audit log entries for this shop ─────────────────
  // "no trace" — remove all admin actions logged against this shop
  await (db as any)
    .from('admin_audit_log')
    .delete()
    .eq('target_id', shopId);

  // ── Step 3: Delete the shop itself ───────────────────────────────────────
  const { error: shopErr } = await (db as any)
    .from('shops')
    .delete()
    .eq('id', shopId);

  if (shopErr) {
    return NextResponse.json({ error: `Could not delete shop: ${shopErr.message}` }, { status: 500 });
  }

  // ── Step 4: Delete the Supabase auth user ────────────────────────────────
  // This frees the email for re-registration with zero conflicts
  const { error: userErr } = await db.auth.admin.deleteUser(shop.owner_id);
  if (userErr) {
    errors.push(`auth user: ${userErr.message}`);
    console.warn('[delete-shop] auth user delete failed:', userErr.message);
  }

  // Return success even if minor tables had issues — shop + auth user are gone
  return NextResponse.json({
    success: true,
    shopName,
    warnings: errors.length > 0 ? errors : undefined,
  });
}
