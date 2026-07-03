import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdminSession } from '@/lib/admin-session';

export async function GET(req: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  try {
    const db = createAdminClient();
    const { data } = await (db as any)
      .from('email_templates')
      .select('*')
      .order('name');

    return NextResponse.json(data || []);
  } catch (err) {
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const { id, name, subject, html } = await req.json();

  if (!id || !name || !subject || !html) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await (db as any)
    .from('email_templates')
    .upsert({ id, name, subject, html, updated_at: new Date().toISOString() })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
