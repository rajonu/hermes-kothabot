import { getCategoryPrompts } from '@/lib/platform-settings';
import { DEFAULT_CATEGORY_PROMPTS, ALL_CATEGORIES } from '@/lib/prompt-layers';
import { CategoryPromptsForm } from '../CategoryPromptsForm';

export default async function CategoryPromptsPage() {
  const storedCategoryPrompts = await getCategoryPrompts();

  const initialCategoryPrompts: Record<string, string> = {};
  for (const cat of ALL_CATEGORIES) {
    initialCategoryPrompts[cat] = storedCategoryPrompts[cat] ?? DEFAULT_CATEGORY_PROMPTS[cat] ?? '';
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
      <div className="rounded-xl border border-violet-800/40 bg-gray-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-600/15 flex items-center justify-center text-base">📂</div>
          <div>
            <h2 className="text-sm font-semibold text-white">Category Prompts — Layer 3</h2>
            <p className="text-xs text-gray-400 mt-0.5">Booking &amp; order collection rules per business category.</p>
          </div>
        </div>
        <div className="p-5">
          <CategoryPromptsForm initialPrompts={initialCategoryPrompts} />
        </div>
      </div>
    </div>
  );
}
