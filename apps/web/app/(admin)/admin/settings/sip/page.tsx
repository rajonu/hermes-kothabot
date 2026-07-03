import { getSipProviderIps } from '@/lib/platform-settings';
import { SipSettingsForm } from '../SipSettingsForm';

export default async function SipSettingsPage() {
  const sipProviderIps = await getSipProviderIps();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
      <div className="rounded-xl border border-indigo-800/40 bg-gray-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/15 flex items-center justify-center text-base">📞</div>
          <div>
            <h2 className="text-sm font-semibold text-white">Master Admin SIP Providers</h2>
            <p className="text-xs text-gray-400 mt-0.5">Whitelist IP addresses for your SIP Providers. The VPS will automatically accept calls from these IPs.</p>
          </div>
        </div>
        <div className="p-5">
          <SipSettingsForm initialIps={sipProviderIps} />
        </div>
      </div>
    </div>
  );
}
