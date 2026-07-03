import { getInAppBrowserProtection } from '@/lib/platform-settings';
import { VoiceProtectionForm } from '../VoiceProtectionForm';

export default async function VoiceProtectionPage() {
  const inappBrowserProtection = await getInAppBrowserProtection();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
      <div className="rounded-xl border border-blue-800/40 bg-gray-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600/15 flex items-center justify-center text-base">🛡️</div>
          <div>
            <h2 className="text-sm font-semibold text-white">Voice Protection</h2>
            <p className="text-xs text-gray-400 mt-0.5">Configuration for voice widget behavior across all public voice links.</p>
          </div>
        </div>
        <div className="p-5">
          <div className="mb-2">
            <p className="text-sm font-medium text-white mb-0.5">Enable In-App Browser Protection</p>
          </div>
          <VoiceProtectionForm initialEnabled={inappBrowserProtection} />
        </div>
      </div>
    </div>
  );
}
