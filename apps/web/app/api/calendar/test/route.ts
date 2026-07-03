import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getIntegration, getValidToken, createCalendarEvent } from '@/lib/google-calendar';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: shop } = await (supabase as any)
    .from('shops').select('id, name').eq('owner_id', user.id).single();
  if (!shop) return NextResponse.json({ error: 'No shop' }, { status: 404 });

  const integration = await getIntegration(shop.id);
  if (!integration) return NextResponse.json({ error: 'Calendar not connected' }, { status: 400 });

  try {
    const accessToken = await getValidToken(integration);
    const now = new Date();
    const start = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    const end   = new Date(start.getTime() + 60 * 60 * 1000);

    const event = await createCalendarEvent(accessToken, integration.calendar_id, {
      summary:     `✅ KothaBot Test Event — ${shop.name}`,
      description: `This is a test event from KothaBot.\nIf you see this in your Google Calendar, the integration is working correctly.\n\nConnected account: ${integration.google_email}`,
      location:    shop.name,
      start: { dateTime: start.toISOString(), timeZone: 'Asia/Dhaka' },
      end:   { dateTime: end.toISOString(),   timeZone: 'Asia/Dhaka' },
    });

    return NextResponse.json({
      success: true,
      event_link: (event as any).htmlLink ?? null,
      message: 'Test event created in your Google Calendar.',
    });
  } catch (err: any) {
    console.error('[calendar/test]', err?.message);
    return NextResponse.json({ error: err?.message ?? 'Failed to create test event' }, { status: 500 });
  }
}
