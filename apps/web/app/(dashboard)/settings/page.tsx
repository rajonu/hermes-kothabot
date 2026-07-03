import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/common/PageHeader";
import { SettingsForm } from "./SettingsForm";
import { PasswordChangeForm } from "./PasswordChangeForm";
import { AvatarUpload } from "./AvatarUpload";
import Link from "next/link";
import { Archive } from "lucide-react";
import type { Shop } from "@/lib/supabase/types";
import { getDocsCategory } from "@/lib/category-nav";
import { getEnabledModules, toggleModule, ModuleInfo, ModuleKey } from "@/lib/modules";

export default async function SettingsPage() {
  const supabase = await createClient();
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: shopRaw, error } = await db.from("shops").select("*, modules").eq("owner_id", user.id).single();
  if (error) console.error("[settings] shop query error:", error);
  const shop = shopRaw as Shop | null;
  const avatar = (shop as any)?.ai_config?.avatar ?? null;

  // Handle module toggles from form submission (if any)
  // Note: In a real implementation, we'd handle form actions here.
  // For now, we rely on SettingsForm to handle toggles via its own logic.

  return (
    <div>
      <PageHeader title="Settings" description="Configure your shop, AI assistant, and account." docsUrl={`https://kothabot.ai.bd/docs/settings?category=${getDocsCategory(shop?.category)}`} />

      {/* Profile / Avatar */}
      <div className="rounded-xl border border-[#1e3d2c] bg-[#0f1f18] p-6 mb-4">
        <h2 className="text-sm font-semibold text-[#e8f5e9] mb-1">Profile</h2>
        <p className="text-xs text-[#7a9e88] mb-4">Your avatar shows in the voice widget and your account.</p>
        <AvatarUpload currentAvatar={avatar} shopName={shop?.name ?? ''} />
      </div>

      <SettingsForm shop={shop} userEmail={user?.email} />

      {/* Password change */}
      <div className="rounded-xl border border-[#1e3d2c] bg-[#0f1f18] p-6 mt-4 max-w-2xl">
        <h2 className="text-sm font-semibold text-[#e8f5e9] mb-1">Change Password</h2>
        <p className="text-xs text-[#7a9e88] mb-4">Update your account password.</p>
        <PasswordChangeForm />
      </div>

      {/* Modules section (replaces Backup & Restore) */}
      <div className="rounded-xl border border-[#1e3d2c] bg-[#0f1f18] p-6 mt-4 max-w-2xl">
        <h2 className="text-sm font-semibold text-[#e8f5e9] mb-1">Modules</h2>
        <p className="text-xs text-[#7a9e88] mb-4">
          Enable or disable optional features. Disabled modules use zero resources and are hidden from the UI.
        </p>
        <div className="space-y-2">
          {Object.entries(ModuleInfo).map(([key, info]) => {
            const moduleKey = key as ModuleKey;
            const isEnabled = shop?.modules ? shop.modules.includes(moduleKey) : ([] as ModuleKey[]).includes(moduleKey); // fallback to default logic handled in hook
            return (
              <label key={moduleKey} className="flex items-center justify-between text-xs text-[#7a9e88]">
                <span>{info.label}</span>
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full">{isEnabled ? <div className="bg-emerald-500" /> : <div className="bg-gray-600" />}</span>
                  {/* In a full implementation, this would be a checkbox that triggers an update */}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}