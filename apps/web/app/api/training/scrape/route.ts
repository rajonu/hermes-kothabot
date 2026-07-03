import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as cheerio from 'cheerio';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { url, shopId } = await request.json();
    if (!url || !shopId) {
      return NextResponse.json({ error: 'Missing URL or shop ID' }, { status: 400 });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    // Fetch the webpage with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; KothaBotScraper/1.0)',
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${response.statusText}` },
        { status: 400 }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove script, style, nav, footer, and other non-content elements
    $('script, style, nav, footer, .footer, .navigation, [role="navigation"]').remove();

    // Extract title
    const title = $('h1').first().text() || $('title').text() || 'Untitled';

    // Extract main content
    let content = '';

    // Try common content selectors
    const selectors = [
      'article',
      'main',
      '.content',
      '.main-content',
      '.post-content',
      '.entry-content',
      'div[class*="container"]',
    ];

    for (const selector of selectors) {
      const element = $(selector).first();
      if (element.length) {
        content = element.text();
        break;
      }
    }

    // Fallback to body text if no content found
    if (!content) {
      content = $('body').text();
    }

    // Clean up text
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim()
      .substring(0, 5000); // Limit to 5000 characters

    if (!content) {
      return NextResponse.json(
        { error: 'No readable content found on page' },
        { status: 400 }
      );
    }

    // Save to database
    const { data, error } = await (supabase as any)
      .from('training_data')
      .insert({
        shop_id: shopId,
        source_type: 'website',
        source_url: url,
        extracted_text: `${title}\n\n${content}`,
      })
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      id: data.id,
      title,
      preview: content.substring(0, 200) + '...',
    });
  } catch (error) {
    console.error('Scrape error:', error);
    return NextResponse.json(
      { error: 'Failed to scrape URL' },
      { status: 500 }
    );
  }
}
