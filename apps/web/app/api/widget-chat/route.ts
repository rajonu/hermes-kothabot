import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { runAIReply } from '@/lib/ai-inference';
import { extractAndSaveOrder, isConfirmed, type ShopCategory } from '@/lib/order-extraction';

// ── Off-topic detection for text chat ─────────────────────────────────────
const OFF_TOPIC_KEYWORDS = [
  /\b(sing|song|গান|গাও)\b/i,
  /\b(joke|funny|হাসি|জোক)\b/i,
  /\b(poem|poetry|কবিতা)\b/i,
  /\b(story|stories|গল্প)\b/i,
  /\b(game|play|খেলা)\b/i,
  /\b(politics|রাজনীতি)\b/i,
  /\b(religion|ধর্ম)\b/i,
  /\b(homework|assignment|হোমওয়ার্ক)\b/i,
  /\b(code|coding|programming)\b/i,
  /\b(what do you eat|তুমি কি খাও|আপনি কি খান)\b/i,
  /\b(who (are|r) (you|u)|তুমি কে)\b/i,
  /\b(tell me about yourself)\b/i,
  /\b(weather|আবহাওয়া)\b/i,
  /\b(news|খবর)\b/i,
];

// Max messages per text chat session (prevents indefinite chatting)
const MAX_CHAT_MESSAGES = 30;

export async function POST(req: NextRequest) {
  const { shopId, message, history, leadId, leadPhone } = await req.json();
  if (!shopId || !message?.trim()) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // ── Guard: max message limit ─────────────────────────────────────────────
  if (history && history.length >= MAX_CHAT_MESSAGES) {
    return NextResponse.json({
      reply: history.some((m: any) => m.text && /bn|বাংলা/.test(m.text))
        ? 'সেশনের বার্তা সীমা শেষ হয়েছে। নতুন চ্যাট শুরু করুন।'
        : 'Message limit reached for this session. Please start a new chat.',
    });
  }

  const db = createAdminClient();
  const { data: shopRaw } = await (db as any).from('shops').select('*').eq('id', shopId).single();
  if (!shopRaw) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
  const shop = shopRaw as any;

  // Check subscription status
  const { data: subData } = await (db as any)
    .from('subscriptions')
    .select('status')
    .eq('shop_id', shopId)
    .maybeSingle();

  if (subData?.status === 'past_due') {
    return NextResponse.json({ error: 'Subscription unpaid' }, { status: 402 });
  }

  const category: ShopCategory = (shop.category ?? 'other') as ShopCategory;

  try {
    const reply = await runAIReply({ shop, history: history ?? [], message });

    // If AI just confirmed something, extract + save in background.
    // Guard: skip if a previous AI message in THIS conversation already had a
    // confirmation pattern — prevents creating two appointments from two
    // confirm-style replies in the same chat ("Yes, confirmed!" + "Have a great day!").
    if (isConfirmed(reply)) {
      const priorConfirmed = (history ?? []).some(
        (m: any) => m.role === 'assistant' && typeof m.text === 'string' && isConfirmed(m.text)
      );
      if (!priorConfirmed) {
        const fullHistory = [...(history ?? []), { role: 'user', text: message }, { role: 'assistant', text: reply }];
        extractAndSaveOrder(shopId, category, fullHistory, db as any, 'widget_chat', leadId, leadPhone);
      } else {
        console.log('[widget-chat] skip — confirmation already saved earlier in this chat');
      }
    }

    return NextResponse.json({ reply });
  } catch (err: any) {
    console.error('[widget-chat] Gemini error:', err?.message);
    return NextResponse.json({ error: 'AI unavailable' }, { status: 500 });
  }
}
