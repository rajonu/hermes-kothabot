
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerClient } from '@/lib/supabase/server'; // Using createServerClient for server-side operations
import type { Shop } from '@/lib/supabase/types'; // Import Shop type for better type safety

const KB_TTL_MS = 60_000; // 60 seconds
const kbCache = new Map<string, { value: string | undefined; expiresAt: number }>();

// Clear expired cache entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of kbCache.entries()) if (v.expiresAt < now) kbCache.delete(k);
  }, 5 * 60_000);
}

/** Drop the cached KB for a shop — call after editing training data / products. */
export function invalidateKnowledgeBase(shopId: string) {
  kbCache.delete(shopId);
}

/**
 * Builds the AI knowledge-base text for a shop using the new business_profile approach.
 * This replaces the old buildTrainingData function which queried multiple tables.
 * Now we only need to read the business_profile column + products cache + schedule cache.
 *
 * This is the cached entry point for the knowledge base.
 */
export async function buildKnowledgeBase(
  supabase: ReturnType<typeof createServerClient>, // Use the correct Supabase client type
  shopId: string,
  shopName: string,
  shopCategory?: string,
): Promise<string | undefined> {
  const hit = kbCache.get(shopId);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const value = await buildKnowledgeBaseUncached(supabase, shopId, shopName, shopCategory);
  kbCache.set(shopId, { value, expiresAt: Date.now() + KB_TTL_MS });
  return value;
}

/**
 * Uncached function to build the AI knowledge-base text for a shop.
 * Fetches data directly from the database.
 */
async function buildKnowledgeBaseUncached(
  supabase: ReturnType<typeof createServerClient>,
  shopId: string,
  shopName: string,
  shopCategory?: string,
): Promise<string | undefined> {
  // 1. Get the business profile (our new compact knowledge base)
  const { data: shopData, error: shopError } = await supabase
    .from('shops')
    .select('business_profile, widget_config, ai_config')
    .eq('id', shopId)
    .single();

  if (shopError) {
    console.error('Error fetching shop data:', shopError);
    return undefined;
  }

  const businessProfile = (shopData as Shop).business_profile; // Cast to Shop type

  // 2. Get products (used as cache for Sheets sync)
  const { data: productRows, error: productError } = await supabase
    .from('products')
    .select('name,description,price,category,is_available,unit,stock_qty,metadata')
    .eq('shop_id', shopId)
    .order('category')
    .order('name');

  if (productError) {
    console.error('Error fetching products:', productError);
    // Continue without products rather than failing completely
  }

  // 3. Build the knowledge base parts
  const knowledgeParts: string[] = [];

  // Add business profile if it exists
  if (businessProfile && businessProfile.trim().length > 0) {
    knowledgeParts.push(businessProfile.trim());
  }

  // Add products/services information
  if (productRows && productRows.length > 0) {
    const isClinic = shopCategory === 'clinic';

    if (isClinic) {
      // Handle clinic-specific product categorization
      const doctors = productRows.filter((p: any) => p.metadata?.product_type === 'doctor');
      const apptTypes = productRows.filter((p: any) => p.metadata?.product_type === 'service');
      const diagnostics = productRows.filter((p: any) => p.metadata?.product_type === 'test');

      if (doctors.length > 0) {
        const doctorLines = doctors.map((p: any) => {
          const m = p.metadata ?? {}; // Define m within scope
          const parts = [`- ${p.name}`];
          if (m.specialization)   parts.push(`(${m.specialization})`);
          if (m.department)       parts.push(`Dept: ${m.department}`);
          if (m.consultation_fee) parts.push(`Fee: ${m.consultation_fee}`);
          if (m.duration_min)     parts.push(`${m.duration_min}min slots`);
          if (!p.is_available)    parts.push('[UNAVAILABLE]');
          return parts.join(' ');
        }).join('\n');
        knowledgeParts.push(`## Doctors at ${shopName}\n${doctorLines}`);
      }

      if (apptTypes.length > 0) {
        const apptLines = apptTypes.map((p: any) => {
          const m = p.metadata ?? {}; // Define m within scope
          const parts = [`- ${p.name}`];
          if (p.price)         parts.push(String(p.price));
          if (m.duration_min)  parts.push(`${m.duration_min}min`);
          if (!p.is_available) parts.push('[UNAVAILABLE]');
          if (p.description)   parts.push(`— ${p.description}`);
          return parts.join(' ');
        }).join('\n');
        knowledgeParts.push(`## Appointment Types at ${shopName}\n${apptLines}`);
      }

      if (diagnostics.length > 0) {
        const diagLines = diagnostics.map((p: any) => {
          const m = p.metadata ?? {}; // Define m within scope
          const parts = [`- ${p.name}`];
          if (p.price)              parts.push(String(p.price));
          if (m.sample_type)        parts.push(`Sample: ${m.sample_type}`);
          if (m.turnaround_time)    parts.push(`Result: ${m.turnaround_time}`);
          if (m.preparation)        parts.push(`Prep: ${m.preparation}`);
          if (!p.is_available)      parts.push('[UNAVAILABLE]');
          if (p.description)        parts.push(`— ${p.description}`);
          return parts.join(' ');
        }).join('\n');
        knowledgeParts.push(`## Diagnostic Tests at ${shopName}\n${diagLines}`);
      }
    } else {
      // Non-clinic: simple product list
      const productLines = productRows.map((p: any) => {
        const parts = [`- ${p.name}`];
        if (p.category)           parts.push(`(${p.category})`);
        if (p.price)              parts.push(String(p.price));
        if (p.unit)               parts.push(`per ${p.unit}`);
        if (p.stock_qty !== null) parts.push(`stock: ${p.stock_qty}`);
        if (!p.is_available)      parts.push('[UNAVAILABLE]');
        if (p.description)        parts.push(`— ${p.description}`);
        return parts.join(' ');
      }).join('\n');
      knowledgeParts.push(`## ${shopName} — Products & Services\n${productLines}`);
    }
  }

  // Return combined parts if any exist
  return knowledgeParts.length > 0 ? knowledgeParts.join('\n\n') : undefined;
}
