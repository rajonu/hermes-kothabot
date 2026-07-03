import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildTrainingData } from '@/lib/widget-training';

/**
 * Returns the AI knowledge-base text for the logged-in user's shop.
 * Called lazily by the dashboard VoiceWidget when a call/chat starts,
 * so the dashboard layout doesn't have to fetch this on every navigation.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: shop } = await (supabase as any)
    .from('shops')
    .select('id, name, category')
    .eq('owner_id', user.id)
    .single();
  if (!shop) return NextResponse.json({ error: 'No shop' }, { status: 404 });

  const trainingData = await buildTrainingData(supabase, shop.id, shop.name, shop.category);
  return NextResponse.json({ trainingData: trainingData ?? null });
}
