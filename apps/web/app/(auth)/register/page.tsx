"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { Loader2, ChevronRight } from "lucide-react";
import { signUp } from "@/modules/auth/actions";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";

type Step = 1 | 2;

function RegisterPageContent() {
  const [step, setStep] = useState<Step>(1);
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [done, setDone] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
  });

  const searchParams = useSearchParams();
  const rawPlan = searchParams.get("plan") || "monthly";
  const rawTier = searchParams.get("tier") || "starter";
  const rawRegion = searchParams.get("region") || "";

  function updateField(key: string, value: string) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleGoogleSignIn() {
    setGooglePending(true);
    try {
      const supabase = createClient();
      const redirectUrl = new URL(`${window.location.origin}/auth/callback`);
      if (rawPlan) redirectUrl.searchParams.set("plan", rawPlan);
      if (rawTier) redirectUrl.searchParams.set("tier", rawTier);
      if (rawRegion) redirectUrl.searchParams.set("region", rawRegion);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUrl.toString() },
      });
      if (error) {
        toast.error(error.message);
        setGooglePending(false);
      }
    } catch {
      toast.error('Google sign-in failed. Please try again.');
      setGooglePending(false);
    }
  }

  async function handleSubmit() {
    setPending(true);
    const data = new FormData();
    Object.entries(formData).forEach(([k, v]) => data.append(k, v));
    data.append("plan", rawPlan);
    data.append("tier", rawTier);
    data.append("region", rawRegion);
    const result = await signUp(data);
    setPending(false);
    if (result?.error) {
      toast.error(result.error);
    } else {
      setDone(true);
    }
  }

  const getPlanDetails = () => {
    const tiers: Record<string, { name: string; priceBD: string; priceUSD: string }> = {
      starter: { name: "Starter Plan", priceBD: "999 ৳", priceUSD: "$9.99" },
      growth: { name: "Pro Plan", priceBD: "2,499 ৳", priceUSD: "$24.99" },
      pro: { name: "Business Plan", priceBD: "5,999 ৳", priceUSD: "$59.99" },
    };

    const details = tiers[rawTier] || tiers.starter;
    const isTrial = rawTier === "starter" || !rawTier;
    const periodLabel = rawPlan === "yearly" ? " / year" : " / month";

    let priceLabel = "";
    if (rawRegion === "BD") {
      priceLabel = details.priceBD + periodLabel;
    } else if (rawRegion === "INTL") {
      priceLabel = details.priceUSD + periodLabel;
    } else {
      priceLabel = `${details.priceBD} (${details.priceUSD})${periodLabel}`;
    }

    return {
      name: details.name,
      price: priceLabel,
      trialText: isTrial ? "14-day free trial" : "No trial, immediate payment required after registration",
      isTrial,
    };
  };

  const planDetails = getPlanDetails();

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#09110e]">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 rounded-full bg-[#00e676]/10 border border-[#00e676]/30 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">✉️</span>
          </div>
          <h1 className="text-lg font-bold text-[#e8f5e9] mb-2">Check your email</h1>
          <p className="text-sm text-[#7a9e88]">
            We sent a confirmation link to{" "}
            <strong className="text-[#e8f5e9]">{formData.email}</strong>.
            Click it to activate your account.
          </p>
          <Link href="/login" className="inline-block mt-6 text-sm text-[#00e676] hover:underline">
            Back to sign in →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#09110e]">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <Image src="/kotha-logo.png" alt="KothaBot" width={40} height={40} className="rounded-xl" />
          <span className="text-xl font-bold text-[#e8f5e9]">KothaBot</span>
        </div>

        <div className="rounded-2xl border border-[#1e3d2c] bg-[#0f1f18] p-8">
          {/* Step indicator */}
          <div className="flex items-center gap-1.5 mb-6">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={`h-1 rounded-full transition-all ${
                  s <= step ? "bg-[#00e676]" : "bg-[#1e3d2c]"
                } ${s === step ? "flex-1" : "w-8"}`}
              />
            ))}
          </div>

          {step === 1 && (
            <div>
              <h1 className="text-lg font-bold text-[#e8f5e9] mb-1">Create your account</h1>
              <p className="text-sm text-[#7a9e88] mb-6">Step 1 of 2 — Your details</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#7a9e88] mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="Your name"
                    className="w-full px-3 py-2.5 rounded-lg bg-[#162b20] border border-[#1e3d2c] text-sm text-[#e8f5e9] placeholder-[#3a5e48] focus:outline-none focus:border-[#00e676]/50 focus:ring-1 focus:ring-[#00e676]/20 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#7a9e88] mb-1.5">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3 py-2.5 rounded-lg bg-[#162b20] border border-[#1e3d2c] text-sm text-[#e8f5e9] placeholder-[#3a5e48] focus:outline-none focus:border-[#00e676]/50 focus:ring-1 focus:ring-[#00e676]/20 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#7a9e88] mb-1.5">
                    Phone Number <span className="text-[#3a5e48]">(optional — for phone login)</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    placeholder="+880 1234 567890"
                    className="w-full px-3 py-2.5 rounded-lg bg-[#162b20] border border-[#1e3d2c] text-sm text-[#e8f5e9] placeholder-[#3a5e48] focus:outline-none focus:border-[#00e676]/50 focus:ring-1 focus:ring-[#00e676]/20 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#7a9e88] mb-1.5">Password</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => updateField("password", e.target.value)}
                    placeholder="Min 8 characters"
                    className="w-full px-3 py-2.5 rounded-lg bg-[#162b20] border border-[#1e3d2c] text-sm text-[#e8f5e9] placeholder-[#3a5e48] focus:outline-none focus:border-[#00e676]/50 focus:ring-1 focus:ring-[#00e676]/20 transition-colors"
                  />
                </div>
              </div>
              <button
                onClick={() => setStep(2)}
                disabled={!formData.name || !formData.email || formData.password.length < 6}
                className="w-full flex items-center justify-center gap-2 mt-6 py-2.5 rounded-lg bg-[#00e676] text-[#09110e] font-semibold text-sm hover:bg-[#00e676]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Continue <ChevronRight size={15} />
              </button>

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-[#1e3d2c]" />
                <span className="text-xs text-[#3a5e48]">or</span>
                <div className="flex-1 h-px bg-[#1e3d2c]" />
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googlePending}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-lg border border-[#1e3d2c] bg-[#162b20] text-sm text-[#e8f5e9] hover:bg-[#1e3d2c] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {googlePending ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                Sign up with Google
              </button>
            </div>
          )}

          {step === 2 && (
            <div>
              <h1 className="text-lg font-bold text-[#e8f5e9] mb-1">Almost done!</h1>
              <p className="text-sm text-[#7a9e88] mb-6">Step 2 of 2 — Confirm & create</p>
              <div className="space-y-2.5 p-4 rounded-xl bg-[#162b20] border border-[#1e3d2c] text-sm mb-6">
                <div className="flex justify-between">
                  <span className="text-[#7a9e88]">Name</span>
                  <span className="text-[#e8f5e9]">{formData.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#7a9e88]">Email</span>
                  <span className="text-[#e8f5e9]">{formData.email}</span>
                </div>
                {formData.phone && (
                  <div className="flex justify-between">
                    <span className="text-[#7a9e88]">Phone</span>
                    <span className="text-[#e8f5e9]">{formData.phone}</span>
                  </div>
                )}
                <div className="h-px bg-[#1e3d2c] my-1" />
                <div className="flex justify-between">
                  <span className="text-[#7a9e88]">Selected Plan</span>
                  <span className="text-[#e8f5e9] font-medium">{planDetails.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#7a9e88]">Price</span>
                  <span className="text-[#e8f5e9] font-semibold">{planDetails.price}</span>
                </div>
                <div className="flex justify-between items-start gap-4">
                  <span className="text-[#7a9e88] shrink-0">Trial Period</span>
                  <span className={`text-xs font-semibold text-right ${planDetails.isTrial ? 'text-[#00e676]' : 'text-amber-400'}`}>
                    {planDetails.trialText}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-2.5 rounded-lg border border-[#1e3d2c] text-sm text-[#7a9e88] hover:text-[#e8f5e9] hover:bg-[#162b20] transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={pending}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#00e676] text-[#09110e] font-semibold text-sm hover:bg-[#00e676]/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {pending && <Loader2 size={15} className="animate-spin" />}
                  Create account
                </button>
              </div>
            </div>
          )}

          <p className="text-center text-xs text-[#7a9e88] mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-[#00e676] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#09110e]" />}>
      <RegisterPageContent />
    </Suspense>
  );
}
