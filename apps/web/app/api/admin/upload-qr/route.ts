import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdminSession } from '@/lib/admin-session';

export async function POST(req: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const formData = await req.formData();
  const file   = formData.get('file') as File | null;
  const method = formData.get('method') as string | null;

  if (!file || !method) return NextResponse.json({ error: 'Missing file or method' }, { status: 400 });

  // Upload to Supabase Storage (bucket: 'qr-codes')
  const db = createAdminClient();
  const ext  = file.name.split('.').pop() ?? 'png';
  const path = `payment-qr/${method}-${Date.now()}.${ext}`;
  const bytes = await file.arrayBuffer();

  const { data: uploaded, error } = await (db.storage as any)
    .from('qr-codes')
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: { publicUrl } } = (db.storage as any).from('qr-codes').getPublicUrl(path);

  return NextResponse.json({ url: publicUrl });
}
