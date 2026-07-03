import { createAdminClient } from '@/lib/supabase/server';
import { TrialExtensionForm } from '../TrialExtensionForm';

export default async function TrialExtensionsPage() {
  const db = createAdminClient();
  const { data: shops } = await (db as any).from('shops')
    .select('id, name, subscriptions(plan_id, status, current_period_end)')
    .order('created_at', { ascending: false });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Extend / Override Subscriptions</h2>
          <p className="text-xs text-gray-400 mt-0.5">Manually extend trials or change any shop&apos;s plan end date.</p>
        </div>
        <div className="p-5">
          <TrialExtensionForm shops={shops ?? []} />
        </div>
      </div>
    </div>
  );
}
