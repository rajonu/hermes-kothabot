import { getPlatformSettings } from '@/lib/platform-settings';
import { PaymentSettingsForm } from '../PaymentSettingsForm';

export default async function PaymentMethodsPage() {
  const settings = await getPlatformSettings();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Payment Methods</h2>
          <p className="text-xs text-gray-400 mt-0.5">Phone numbers and QR codes shown to customers. Changes take effect immediately.</p>
        </div>
        <div className="p-5">
          <PaymentSettingsForm initialSettings={settings.payment_methods} />
        </div>
      </div>
    </div>
  );
}
