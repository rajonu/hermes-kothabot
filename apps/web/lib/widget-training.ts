/**
 * Builds the AI knowledge-base text (Layer 4) for a shop:
 * knowledge chunks (website/facebook) + manual training entries + product list.
 * For clinic category, also injects doctor schedules so the AI knows working hours.
 */
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ── In-process KB cache ──────────────────────────────────────────────────────
// buildTrainingData runs 3–5 DB queries and is called on EVERY widget-chat
// message + every widget-context fetch. The KB rarely changes mid-conversation,
// so cache the built string per shop for a short TTL. Same accepted pattern as
// lib/api-rate-limit.ts. Single-instance only (kothabot-web runs one PM2 process).
// ponytail: in-process Map cache, 60s TTL; move to Redis if web goes multi-instance.
const KB_TTL_MS = 60_000;
const kbCache = new Map<string, { value: string | undefined; expiresAt: number }>();

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of kbCache.entries()) if (v.expiresAt < now) kbCache.delete(k);
  }, 5 * 60_000);
}

/** Drop the cached KB for a shop — call after editing training data / products. */
export function invalidateTrainingData(shopId: string) {
  kbCache.delete(shopId);
}

/**
 * Cached entry point used by all hot paths. Rebuilds at most once per shop per
 * KB_TTL_MS. Falls through to the uncached builder on a miss.
 */
export async function buildTrainingData(
  supabase: any,
  shopId: string,
  shopName: string,
  shopCategory?: string,
): Promise<string | undefined> {
  const hit = kbCache.get(shopId);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const value = await buildTrainingDataUncached(supabase, shopId, shopName, shopCategory);
  kbCache.set(shopId, { value, expiresAt: Date.now() + KB_TTL_MS });
  return value;
}

export async function buildTrainingDataUncached(
  supabase: any,
  shopId: string,
  shopName: string,
  shopCategory?: string,
): Promise<string | undefined> {
  const isClinic = shopCategory === 'clinic';

  const queries: Promise<any>[] = [
    supabase.from('training_data').select('extracted_text').eq('shop_id', shopId).order('created_at', { ascending: true }),
    supabase.from('products').select('name,description,price,category,is_available,unit,stock_qty,metadata').eq('shop_id', shopId).order('category').order('name'),
    supabase.from('knowledge_chunks').select('content, source_type').eq('shop_id', shopId).order('source_type'),
  ];

  if (isClinic) {
    queries.push(
      supabase.from('clinic_schedules').select('doctor_id, location_id, weekday, start_time, end_time').eq('shop_id', shopId),
      supabase.from('clinic_locations').select('id, name').eq('shop_id', shopId),
      supabase.from('clinic_doctor_locations').select('doctor_id, location_id').eq('shop_id', shopId),
    );
  }

  const results = await Promise.all(queries);
  const [{ data: trainingRows }, { data: productRows }, { data: knowledgeChunks }] = results;
  const scheduleRows: any[] = isClinic ? (results[3]?.data ?? []) : [];
  const locationRows: any[] = isClinic ? (results[4]?.data ?? []) : [];
  const doctorLocationRows: any[] = isClinic ? (results[5]?.data ?? []) : [];
  const locationNameById = new Map<string, string>(locationRows.map((l: any) => [l.id, l.name]));

  const trainingParts: string[] = [];

  // Knowledge chunks (website/facebook/wordpress — highest priority)
  if ((knowledgeChunks ?? []).length > 0) {
    const websiteChunk = (knowledgeChunks as any[]).find(c => c.source_type === 'website');
    const fbChunk      = (knowledgeChunks as any[]).find(c => c.source_type === 'facebook');
    const wpChunk      = (knowledgeChunks as any[]).find(c => c.source_type === 'wordpress');
    if (websiteChunk) trainingParts.push(`## Business Knowledge (from website)\n${websiteChunk.content}`);
    if (fbChunk)      trainingParts.push(`## Additional Info (from Facebook)\n${fbChunk.content}`);
    if (wpChunk)      trainingParts.push(`## Business Knowledge (from WordPress)\n${wpChunk.content}`);
  }

  // Manual training entries
  if ((trainingRows ?? []).length > 0) {
    trainingParts.push((trainingRows as any[]).map((r: any) => r.extracted_text).join('\n\n'));
  }

  // Products / services list
  if ((productRows ?? []).length > 0) {
    const allProducts = productRows as any[];

    if (isClinic) {
      // product_type='doctor' (or unset legacy) → doctors in Scheduling
      // product_type='service' → appointment types in Scheduling
      // product_type='test' (or any other) → diagnostic tests from Tests panel
      const doctors       = allProducts.filter(p => p.metadata?.product_type === 'doctor');
      const apptTypes     = allProducts.filter(p => p.metadata?.product_type === 'service');
      const diagnostics   = allProducts.filter(p => p.metadata?.product_type === 'test');

      if (doctors.length > 0) {
        const lines = doctors.map((p: any) => {
          const m = p.metadata ?? {};
          const parts = [`- ${p.name}`];
          if (m.specialization)   parts.push(`(${m.specialization})`);
          if (m.department)       parts.push(`Dept: ${m.department}`);
          if (m.consultation_fee) parts.push(`Fee: ${m.consultation_fee}`);
          if (m.duration_min)     parts.push(`${m.duration_min}min slots`);
          const docLocations = doctorLocationRows
            .filter((dl: any) => dl.doctor_id === p.id)
            .map((dl: any) => locationNameById.get(dl.location_id))
            .filter(Boolean);
          if (docLocations.length > 0) parts.push(`Location: ${docLocations.join(', ')}`);
          if (!p.is_available)    parts.push('[UNAVAILABLE]');
          return parts.join(' ');
        }).join('\n');
        trainingParts.push(`## Doctors at ${shopName}\n${lines}`);
      }

      if (apptTypes.length > 0) {
        const lines = apptTypes.map((p: any) => {
          const m = p.metadata ?? {};
          const parts = [`- ${p.name}`];
          if (p.price)         parts.push(String(p.price));
          if (m.duration_min)  parts.push(`${m.duration_min}min`);
          if (!p.is_available) parts.push('[UNAVAILABLE]');
          if (p.description)   parts.push(`— ${p.description}`);
          return parts.join(' ');
        }).join('\n');
        trainingParts.push(`## Appointment Types at ${shopName}\n${lines}`);
      }

      if (diagnostics.length > 0) {
        const lines = diagnostics.map((p: any) => {
          const m = p.metadata ?? {};
          const parts = [`- ${p.name}`];
          if (p.price)              parts.push(String(p.price));
          if (m.sample_type)        parts.push(`Sample: ${m.sample_type}`);
          if (m.turnaround_time)    parts.push(`Result: ${m.turnaround_time}`);
          if (m.preparation)        parts.push(`Prep: ${m.preparation}`);
          if (!p.is_available)      parts.push('[UNAVAILABLE]');
          if (p.description)        parts.push(`— ${p.description}`);
          return parts.join(' ');
        }).join('\n');
        trainingParts.push(`## Diagnostic Tests at ${shopName}\n${lines}`);
      }

      // Doctor working hours
      if (scheduleRows.length > 0 && doctors.length > 0) {
        const byDoctor: Record<string, string[]> = {};
        for (const s of scheduleRows) {
          const doc = doctors.find((d: any) => d.id === s.doctor_id);
          if (!doc) continue;
          const name = doc.name;
          if (!byDoctor[name]) byDoctor[name] = [];
          const fmt = (t: string) => {
            const [h, m] = t.split(':').map(Number);
            const ampm = h >= 12 ? 'pm' : 'am';
            return `${h % 12 || 12}:${String(m).padStart(2,'0')}${ampm}`;
          };
          const loc = s.location_id ? locationNameById.get(s.location_id) : null;
          byDoctor[name].push(`${WEEKDAYS[s.weekday]} ${fmt(s.start_time)}–${fmt(s.end_time)}${loc ? ` at ${loc}` : ''}`);
        }
        const lines = Object.entries(byDoctor)
          .map(([name, days]) => `- ${name}: ${days.join(', ')}`)
          .join('\n');
        trainingParts.push(`## Doctor Working Hours\n${lines}\nFor appointment booking, tell the patient to choose a date that falls on a working day for their doctor. If the doctor works at more than one location, confirm which location the patient wants.`);
      }

      // Locations
      if (locationRows.length > 0) {
        const lines = locationRows.map((l: any) => `- ${l.name}`).join('\n');
        trainingParts.push(`## Clinic Locations\n${lines}`);
      }

    } else {
      // Non-clinic: original flat list
      const lines = allProducts.map((p: any) => {
        const parts = [`- ${p.name}`];
        if (p.category)           parts.push(`(${p.category})`);
        if (p.price)              parts.push(String(p.price));
        if (p.unit)               parts.push(`per ${p.unit}`);
        if (p.stock_qty !== null) parts.push(`stock: ${p.stock_qty}`);
        if (!p.is_available)      parts.push('[UNAVAILABLE]');
        if (p.description)        parts.push(`— ${p.description}`);
        if (p.metadata?.schedule)      parts.push(`Schedule: ${p.metadata.schedule}`);
        if (p.metadata?.duration_min)  parts.push(`${p.metadata.duration_min}min`);
        if (p.metadata?.location)      parts.push(`Location: ${p.metadata.location}`);
        if (p.metadata?.bedrooms)      parts.push(`${p.metadata.bedrooms} bed`);
        if (p.metadata?.bathrooms)     parts.push(`${p.metadata.bathrooms} bath`);
        if (p.metadata?.area_size)     parts.push(`${p.metadata.area_size}`);
        if (p.metadata?.instructor)    parts.push(`Instructor: ${p.metadata.instructor}`);
        if (p.metadata?.delivery_time) parts.push(`Delivery: ${p.metadata.delivery_time}`);
        return parts.join(' ');
      }).join('\n');
      trainingParts.push(`## ${shopName} — Products & Services\n${lines}`);
    }
  }

  return trainingParts.length > 0 ? trainingParts.join('\n\n') : undefined;
}
