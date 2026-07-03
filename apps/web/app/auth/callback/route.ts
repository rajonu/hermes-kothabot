import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const plan = searchParams.get("plan") || "monthly";
  const tier = searchParams.get("tier") || "starter";
  const region = searchParams.get("region") || "";

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://my.kothabot.ai.bd";

  if (code) {
    const supabase = await createClient();
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data?.user) {
      const user = data.user;
      const adminClient = createAdminClient();
      await adminClient.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          pending_plan: plan,
          pending_tier: tier,
          pending_region: region || undefined,
        }
      });
      return NextResponse.redirect(`${base}/dashboard`);
    }
  }

  return NextResponse.redirect(`${base}/login?error=oauth`);
}
