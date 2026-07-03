import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as cheerio from 'cheerio';
import { generateText } from '@/lib/gemini';

const EXTRACTION_PROMPT = `You are a business knowledge extraction AI for KothaBot AI voice assistant.

Analyze the following website content and extract ONLY important business information.

RULES:
- Use simple, factual language only
- Remove all duplicate information
- Ignore blog posts, news articles, and unrelated content
- Do not include HTML, code, navigation menus, or website boilerplate
- Keep the final output under 1,000 words
- Organize into clear sections
- Only include information useful for answering customer questions
- If a section has no relevant data, skip it entirely

OUTPUT FORMAT (use these exact section headers):

BUSINESS OVERVIEW
[Business name, industry, and 2-3 sentence description of what the business does]

PRODUCTS & SERVICES
[List all products and services offered]

PRICING & PACKAGES
[Pricing details, packages, and promotions if available]

BUSINESS HOURS
[Opening hours and working days]

CONTACT INFORMATION
[Phone numbers, email addresses, WhatsApp, social media links]

LOCATIONS
[Office address, branches, service areas, delivery coverage]

POLICIES
[Delivery, booking, refund, return policies]

CUSTOMER FAQ
[2-4 common customer questions with brief answers based on the content]

VOICE ASSISTANT SUMMARY
[A short 3-5 sentence AI-friendly summary covering who the business is, what they offer, how to contact them, and key policies. This is used directly in the AI voice assistant.]

Website content to analyze:`;

async function fetchAndClean(url: string): Promise<{ title: string; content: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KothaBotScraper/1.0; +https://kothabot.ai)' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    const $ = cheerio.load(html);

    // Remove only definite noise — be conservative to avoid losing content
    $('script, style, iframe, noscript').remove();
    // Remove nav/footer only if they are standalone elements, not content wrappers
    $('nav, footer').each((_: any, el: any) => {
      const text = $(el).text().trim();
      if (text.length < 300) $(el).remove(); // small nav/footer = noise
    });

    // Extract title — try multiple sources
    const title = $('h1').first().text().trim()
      || $('meta[property="og:title"]').attr('content')?.trim()
      || $('title').text().trim()
      || new URL(url).hostname;

    // Collect ALL meaningful text blocks from the page
    const textBlocks: string[] = [];
    $('h1, h2, h3, h4, p, li, td, th, span, div, section, main, article, header').each((_: any, el: any) => {
      const text = $(el).clone().children().remove().end().text().trim();
      if (text.length > 15 && text.length < 500) {
        textBlocks.push(text);
      }
    });

    // Deduplicate and join
    const seen = new Set<string>();
    const uniqueBlocks = textBlocks.filter(t => {
      const key = t.toLowerCase().replace(/\s+/g, ' ');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    let content = uniqueBlocks.join('\n').trim().substring(0, 8000);

    // Fallback: just use all body text
    if (content.length < 100) {
      content = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 8000);
    }

    return { title, content };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { shopId, websiteUrl, adminOverride } = await req.json();
    if (!shopId || !websiteUrl) {
      return NextResponse.json({ error: 'Missing shopId or websiteUrl' }, { status: 400 });
    }

    try { new URL(websiteUrl); } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    const db = supabase as any;

    // Check one-time limit (unless admin override)
    if (!adminOverride) {
      const { data: existing } = await db
        .from('knowledge_sources')
        .select('id, extraction_status')
        .eq('shop_id', shopId)
        .eq('website_status', 'completed')
        .single();

      if (existing) {
        return NextResponse.json({
          error: 'Knowledge already imported. Contact support to refresh.',
          alreadyExtracted: true,
        }, { status: 409 });
      }
    }

    // Create/update knowledge_sources record
    let sourceId: string;
    const { data: src } = await db
      .from('knowledge_sources')
      .select('id')
      .eq('shop_id', shopId)
      .single();

    if (src) {
      sourceId = src.id;
      await db.from('knowledge_sources').update({
        website_url: websiteUrl,
        extraction_status: 'processing',
        website_status: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      }).eq('id', sourceId);
    } else {
      const { data: newSrc } = await db.from('knowledge_sources').insert({
        shop_id: shopId,
        website_url: websiteUrl,
        extraction_status: 'processing',
        extracted_by: adminOverride ? 'admin' : 'system',
      }).select('id').single();
      sourceId = newSrc.id;
    }

    // Fetch & clean website
    let fetchedContent: { title: string; content: string };
    try {
      fetchedContent = await fetchAndClean(websiteUrl);
    } catch (err: any) {
      await db.from('knowledge_sources').update({
        extraction_status: 'failed',
        website_status: 'failed',
        error_message: err.message ?? 'Failed to fetch website',
        updated_at: new Date().toISOString(),
      }).eq('id', sourceId);
      return NextResponse.json({ error: 'Failed to fetch website. Check URL and try again.' }, { status: 400 });
    }

    if (!fetchedContent.content || fetchedContent.content.length < 30) {
      await db.from('knowledge_sources').update({
        extraction_status: 'failed',
        website_status: 'failed',
        error_message: 'Not enough content found on page',
        updated_at: new Date().toISOString(),
      }).eq('id', sourceId);
      return NextResponse.json({ error: 'Not enough content found on the website.' }, { status: 400 });
    }

    // Gemini extraction
    let structuredKnowledge: string;
    try {
      structuredKnowledge = await generateText(
        `${EXTRACTION_PROMPT}\n\nWebsite: ${websiteUrl}\nTitle: ${fetchedContent.title}\n\nContent:\n${fetchedContent.content}`
      );
    } catch (err: any) {
      // Fall back to raw content if Gemini fails
      structuredKnowledge = `BUSINESS: ${fetchedContent.title}\nSOURCE: ${websiteUrl}\n\n${fetchedContent.content.substring(0, 1000)}`;
    }

    const wordCount = structuredKnowledge.split(/\s+/).length;

    // Delete old website chunks for this shop
    await db.from('knowledge_chunks').delete()
      .eq('shop_id', shopId)
      .eq('source_type', 'website');

    // Store knowledge chunk
    await db.from('knowledge_chunks').insert({
      shop_id: shopId,
      source_type: 'website',
      chunk_type: 'business_summary',
      content: structuredKnowledge,
      word_count: wordCount,
    });

    // Mark complete
    await db.from('knowledge_sources').update({
      extraction_status: 'completed',
      website_status: 'completed',
      website_url: websiteUrl,
      extracted_at: new Date().toISOString(),
      extracted_by: adminOverride ? 'admin' : 'system',
      updated_at: new Date().toISOString(),
    }).eq('id', sourceId);

    return NextResponse.json({
      success: true,
      wordCount,
      preview: structuredKnowledge.substring(0, 300),
      fullContent: structuredKnowledge,
    });
  } catch (err: any) {
    console.error('Extract website error:', err);
    return NextResponse.json({ error: err.message ?? 'Extraction failed' }, { status: 500 });
  }
}
