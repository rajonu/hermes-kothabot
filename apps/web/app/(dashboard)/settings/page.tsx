import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/common/PageHeader";
import { SettingsForm } from "./SettingsForm";
import { PasswordChangeForm } from "./PasswordChangeForm";
import { AvatarUpload } from "./AvatarUpload";
import Link from "next/link";
import { Archive } from "lucide-react";
import type { Shop } from "@/lib/supabase/types";
import { getDocsCategory } from "@/lib/category-nav";
import { PushNotificationToggle } from "@/components/PushNotificationToggle";

export default async function SettingsPage() {
  const supabase = await createClient();
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: shopRaw } = await db.from("shops").select("*").eq("owner_id", user.id).single();
  const shop = shopRaw as Shop | null;
  const avatar = (shop as any)?.ai_config?.avatar ?? null;

  return (
    <div>
      <PageHeader title="Settings" description="Configure your shop, AI assistant, and account." docsUrl={`https://kothabot.ai.bd/docs/settings-backup?category=${getDocsCategory(shop?.category)}`} />

      {/* Profile / Avatar */}
      <div className="rounded-xl border border-[#1e3d2c] bg-[#0f1f18] p-6 mb-4">
        <h2 className="text-sm font-semibold text-[#e8f5e9] mb-1">Profile</h2>
        <p className="text-xs text-[#7a9e88] mb-4">Your avatar shows in the voice widget and your account.</p>
        <AvatarUpload currentAvatar={avatar} shopName={shop?.name ?? ''} />
      </div>

      <SettingsForm shop={shop} userEmail={user?.email} />

      {/* Push Notifications */}
      <div className="rounded-xl border border-[#1e3d2c] bg-[#0f1f18] p-6 mt-4 max-w-2xl">
        <h2 className="text-sm font-semibold text-[#e8f5e9] mb-1">Push Notifications</h2>
        <p className="text-xs text-[#7a9e88] mb-4">Get notified on this device when new orders arrive or support replies come in — even when the app is closed.</p>
        <PushNotificationToggle />
      </div>

      {/* Password change */}
      <div className="rounded-xl border border-[#1e3d2c] bg-[#0f1f18] p-6 mt-4 max-w-2xl">
        <h2 className="text-sm font-semibold text-[#e8f5e9] mb-1">Change Password</h2>
        <p className="text-xs text-[#7a9e88] mb-4">Update your account password.</p>
        <PasswordChangeForm />
      </div>

      {/* Backup & Restore link */}
      <Link
        href="/settings/backup"
        className="flex items-center justify-between rounded-xl border border-[#1e3d2c] bg-[#0f1f18] p-5 mt-4 max-w-2xl hover:border-emerald-600/40 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-600/10 border border-emerald-600/20 flex items-center justify-center">
            <Archive size={16} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#e8f5e9]">Backup & Restore</p>
            <p className="text-xs text-[#7a9e88]">Automatic and manual backups of your business data.</p>
          </div>
        </div>
        <span className="text-xs text-gray-500 group-hover:text-emerald-400 transition-colors">Manage →</span>
      </Link>
    </div>
  );
}
