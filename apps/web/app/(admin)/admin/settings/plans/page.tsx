import { getPlatformSettings } from '@/lib/platform-settings';
import { PlanSettingsForm } from '../PlanSettingsForm';

export default async function PlansSettingsPage() {
  const settings = await getPlatformSettings();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Subscription Plans</h2>
          <p className="text-xs text-gray-400 mt-0.5">Edit plan names, prices, features and call limits.</p>
        </div>
        <div className="p-5">
          <PlanSettingsForm initialPlans={settings.plans} />
        </div>
      </div>
    </div>
  );
}
