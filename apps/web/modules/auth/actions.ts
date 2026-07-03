"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { recordLoginActivity } from "@/lib/login-activity";
import { getIpLocation } from "@/lib/login-activity";

function isPhoneNumber(value: string): boolean {
  const stripped = value.replace(/[\s\-().]/g, '');
  return /^[+]?\d{7,15}$/.test(stripped);
}

function normalizePhone(value: string): string {
  return value.replace(/[\s\-().]/g, '');
}

export async function signIn(formData: FormData) {
  const supabase  = await createClient();
  const headerMap = await headers();

  let identifier = (formData.get("email") as string ?? '').trim();
  const password  = formData.get("password") as string;

  // If the user typed a phone number, look up the associated email via shops table
  let email = identifier;
  if (isPhoneNumber(identifier)) {
    const phone = normalizePhone(identifier);
    const db = createAdminClient() as any;
    // Query shops table which stores phone in owner metadata — much faster than listUsers
    const { data: shopRow } = await db
      .from('shops')
      .select('owner_id')
      .or(`ai_config->>phone.eq.${phone},ai_config->>phone.eq.0${phone.slice(-10)}`)
      .maybeSingle();

    if (shopRow?.owner_id) {
      const { data: authUser } = await (createAdminClient()).auth.admin.getUserById(shopRow.owner_id);
      if (authUser?.user?.email) {
        email = authUser.user.email;
      }
    }

    // Fallback: search user_metadata in auth (limited to 100 recent users)
    if (email === identifier) {
      const { data: { users } } = await (createAdminClient()).auth.admin.listUsers({ perPage: 100, page: 1 });
      const match = users.find(u => normalizePhone(u.user_metadata?.phone ?? '') === phone);
      if (!match?.email) return { error: 'No account found with this phone number.' };
      email = match.email;
    }
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: error.message };

  // Record login activity (fire-and-forget — don't block the redirect)
  if (data.user) {
    const ip = headerMap.get('x-forwarded-for')?.split(',')[0]?.trim()
             ?? headerMap.get('x-real-ip')
             ?? 'unknown';
    const ua = headerMap.get('user-agent') ?? '';

    // Get shop_id for this user
    const { data: shopRaw } = await (supabase as any)
      .from('shops').select('id').eq('owner_id', data.user.id).single();

    // Don't await — let it run in background
    recordLoginActivity({
      userId:    data.user.id,
      shopId:    shopRaw?.id ?? null,
      ip,
      userAgent: ua,
    }).catch(() => {});
  }

  revalidatePath("/", "layout");
  return { redirect: "/dashboard" };
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const name = formData.get("name") as string;
  const phone = (formData.get("phone") as string ?? '').trim();

  const plan = (formData.get("plan") as string ?? 'monthly').trim();
  const tier = (formData.get("tier") as string ?? 'starter').trim();
  const region = (formData.get("region") as string ?? '').trim();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.kothabot.ai.bd';

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { 
        full_name: name, 
        phone: phone || undefined,
        pending_plan: plan,
        pending_tier: tier,
        pending_region: region || undefined
      },
      // Explicitly set redirect URL so Supabase doesn't use the stale Railway URL
      // stored in project settings.
      emailRedirectTo: `${appUrl}/login`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true, message: "Check your email to confirm your account." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  return { redirect: "/login" };
}

export async function getSession() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getShop() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: shop } = await supabase
    .from("shops")
    .select("*")
    .eq("owner_id", user.id)
    .single();

  return shop;
}

export async function createShop(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const name = formData.get("name") as string;
  const category = formData.get("category") as string;

  console.log("[createShop] name:", name, "| category:", category, "| userId:", user.id);

  if (!name || !category) return { error: "Shop name and category are required." };

  // Guard: if the user already has a shop (double-submit, back-button, etc.) just redirect
  const { data: existingShop } = await (supabase as any)
    .from('shops').select('id').eq('owner_id', user.id).maybeSingle();
  if (existingShop?.id) {
    revalidatePath("/", "layout");
    return { redirect: "/dashboard" };
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");

  // ── Detect billing region ONCE at signup (never again per client) ──────────
  // Region is derived from the user's selection at signup, otherwise from IP.
  // Internal token: 'BD' (Bangladesh) or 'INTL' (Global). Surfaced as "Global"
  // in user-facing UI; admin can override anytime from /admin/shops/[id].
  const userMetadata = user.user_metadata as any;
  const pendingRegion = userMetadata?.pending_region;

  let billingRegion = 'BD';
  if (pendingRegion === 'BD' || pendingRegion === 'INTL') {
    billingRegion = pendingRegion;
  } else {
    const headerMap = await headers();
    const ip = headerMap.get('x-forwarded-for')?.split(',')[0]?.trim()
             ?? headerMap.get('x-real-ip')
             ?? '';
    const geo = await getIpLocation(ip);
    
    // Default to BD for local development or if geo lookup fails
    if (!geo.countryCode || geo.countryCode === 'DEV') {
      billingRegion = 'BD';
    } else {
      billingRegion = geo.countryCode === 'BD' ? 'BD' : 'INTL';
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const isIntl = billingRegion === 'INTL';
  const { error, data: newShop } = await db.from("shops").insert({
    owner_id: user.id,
    name,
    category,
    slug: `${slug}-${user.id.slice(0, 8)}`,
    onboarding_done: false,
    ai_config: {
      systemPrompt: "",
      language: isIntl ? "en" : "auto",
      personality: "professional",
      inactivityTimeoutSec: 60,
      billing_region: billingRegion,  // ← locked at signup, not rechecked
    },
    widget_config: {
      greeting: isIntl
        ? `Hello! I am an intelligent assistant of ${name}. How may I help you today?`
        : "হ্যালো! আমি আপনাকে কীভাবে সাহায্য করতে পারি?",
    },
  }).select("id").single();

  console.log("[createShop] insert result — error:", error, "| shop:", newShop);

  if (error) return { error: error.message };

  // Parse pending plan and tier
  const pendingPlan = userMetadata?.pending_plan || 'monthly';
  const rawTier = userMetadata?.pending_tier || 'starter';

  // Map tier names to DB plan_ids:
  // 'starter' -> 'starter'
  // 'growth' -> 'pro'
  // 'pro' -> 'business'
  let planId = 'starter';
  if (rawTier === 'growth') planId = 'pro';
  if (rawTier === 'pro') planId = 'business';

  const isTrial = planId === 'starter';
  const trialDays = isTrial ? 14 : 0;
  const periodEnd = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

  const adminDb = createAdminClient() as any;
  const { error: subError } = await adminDb.from("subscriptions").insert({
    shop_id:       newShop.id,
    plan:          isTrial ? "trial" : pendingPlan,
    plan_id:       isTrial ? "starter" : planId,
    status:        isTrial ? "trial" : "past_due",
    payment_method: "bkash",
    trial_ends_at: periodEnd.toISOString(),
    current_period_end: periodEnd.toISOString(),
  });

  console.log("[createShop] subscription error:", subError);

  // ── Fire-and-forget welcome email (never block onboarding) ──
  sendWelcomeEmail({
    email: user.email ?? '',
    customerName: (user.user_metadata as any)?.full_name || name,
    shopName: name,
  }).catch(e => console.warn('[createShop] welcome email failed:', e?.message));

  const redirectPath = isTrial ? "/dashboard" : "/billing?pay=true";

  revalidatePath("/", "layout");
  return { redirect: redirectPath };
}

async function sendWelcomeEmail(p: { email: string; customerName: string; shopName: string }) {
  if (!p.email) return;
  const { default: resend } = await import('@/lib/resend');
  const { SENDERS } = await import('@/lib/email-senders');
  const { emailTemplates } = await import('@/lib/email-templates');
  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://my.kothabot.ai.bd'}/login`;
  const tpl = emailTemplates.welcomeEmail({
    customerName: p.customerName,
    shopName: p.shopName,
    loginUrl,
  });
  await resend.emails.send({
    from: SENDERS.WELCOME,
    to: p.email,
    bcc: process.env.ADMIN_BCC_EMAIL || undefined,
    subject: tpl.subject,
    html: tpl.html,
  });
}
