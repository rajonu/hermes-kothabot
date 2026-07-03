import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime  = 'nodejs';

// CORS: widgets are embedded on third-party sites
function corsHeaders(req: NextRequest) {
  return {
    'Access-Control-Allow-Origin':  req.headers.get('origin') ?? '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  } as Record<string, string>;
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

// Normalize phone — strip everything but digits.
// For BD: must be 11 digits starting with 01.
// For others: 7-15 digits.
function validatePhone(raw: string, country: string): { ok: boolean; phone?: string; reason?: string } {
  const digits = raw.replace(/\D+/g, '');
  if (country === 'BD') {
    if (digits.length !== 11) return { ok: false, reason: 'Bangladesh number must be 11 digits' };
    if (!digits.startsWith('01')) return { ok: false, reason: 'Bangladesh number must start with 01' };
  } else {
    if (digits.length < 7 || digits.length > 15) return { ok: false, reason: 'Phone number must be 7–15 digits' };
  }
  return { ok: true, phone: digits };
}

export async function POST(req: NextRequest) {
  try {
    const { shopId, phone, country, source } = await req.json() as {
      shopId?: string;
      phone?: string;
      country?: string;
      source?: 'widget_voice' | 'widget_chat';
    };

    if (!shopId || !phone) {
      return NextResponse.json({ error: 'shopId and phone required' }, { status: 400, headers: corsHeaders(req) });
    }

    const c = (country || 'BD').toUpperCase();
    const v = validatePhone(phone, c);
    if (!v.ok) {
      return NextResponse.json({ error: v.reason }, { status: 400, headers: corsHeaders(req) });
    }

    const supabase = createAdminClient();

    // Upsert by (shop_id, phone) — same number returning doesn't create dupes
    const { data, error } = await (supabase as any)
      .from('leads')
      .upsert(
        {
          shop_id: shopId,
          phone:   v.phone,
          country: c,
          source:  source ?? 'widget',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'shop_id,phone' }
      )
      .select('id')
      .single();

    if (error) {
      console.error('[widget-lead] upsert error:', error);
      return NextResponse.json({ error: 'failed to save lead' }, { status: 500, headers: corsHeaders(req) });
    }

    return NextResponse.json({ leadId: data?.id, phone: v.phone }, { headers: corsHeaders(req) });
  } catch (err: any) {
    console.error('[widget-lead] exception:', err);
    return NextResponse.json({ error: err?.message ?? 'failed' }, { status: 500, headers: corsHeaders(req) });
  }
}
