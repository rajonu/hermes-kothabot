import { getGlobalAIRules } from '@/lib/platform-settings';
import { GlobalAIRulesForm } from '../GlobalAIRulesForm';

export default async function AIRulesPage() {
  const globalAIRules = await getGlobalAIRules();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
      <div className="rounded-xl border border-emerald-800/40 bg-gray-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-600/15 flex items-center justify-center text-base">🤖</div>
          <div>
            <h2 className="text-sm font-semibold text-white">Global AI Rules</h2>
            <p className="text-xs text-gray-400 mt-0.5">System instructions injected into ALL voice calls and chat sessions across every shop.</p>
          </div>
        </div>
        <div className="p-5">
          <GlobalAIRulesForm initialRules={globalAIRules} />
        </div>
      </div>
    </div>
  );
}
