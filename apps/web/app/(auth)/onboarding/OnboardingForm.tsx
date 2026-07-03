'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import { createShop } from '@/modules/auth/actions';
import { toast } from 'sonner';
import { useRef, useState } from 'react';
import { CATEGORIES_CONFIG } from '@/lib/categories.config';

const CATEGORY_PLACEHOLDERS: Record<string, string> = {
  clinic:          'e.g. Ibn Sina Medical Center',
  salon:           'e.g. Glamour Beauty Studio',
  services:        'e.g. Rahman Tech Services',
  restaurant:      'e.g. Rana\'s Kitchen',
  retail:          'e.g. City Electronics',
  grocery:         'e.g. Fresh Mart',
  pharmacy:        'e.g. MediCare Pharmacy',
  real_estate:     'e.g. Prime Properties BD',
  education:       'e.g. Bright Future Academy',
  creative_agency: 'e.g. Pixel Studio',
  other:           'e.g. My Business Name',
};

interface Props { enabledCategories: string[] }

export function OnboardingForm({ enabledCategories }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  const categories = CATEGORIES_CONFIG.filter(c => enabledCategories.includes(c.value));
  const namePlaceholder = CATEGORY_PLACEHOLDERS[selectedCategory] ?? 'e.g. Ibn Sina Medical Center';

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const category = formData.get('category') as string;

    if (!name?.trim()) { toast.error('Please enter your business name.'); return; }
    if (!category) { toast.error('Please select a business category.'); return; }

    setPending(true);
    const result = await createShop(formData);
    if (result?.error) {
      toast.error(result.error);
      setPending(false);
    } else if (result?.redirect) {
      router.push(result.redirect);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#09110e]">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <Image src="/kotha-logo.png" alt="KothaBot" width={40} height={40} className="rounded-xl" />
          <span className="text-xl font-bold text-[#e8f5e9]">KothaBot</span>
        </div>

        <div className="rounded-2xl border border-[#1e3d2c] bg-[#0f1f18] p-8">
          <h1 className="text-lg font-bold text-[#e8f5e9] mb-1">Set up your business</h1>
          <p className="text-sm text-[#7a9e88] mb-6">This takes 30 seconds. You can change everything later.</p>

          <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-[#7a9e88] mb-1.5">
                Company / Business Name
              </label>
              <input
                type="text"
                name="name"
                required
                placeholder={namePlaceholder}
                className="w-full px-3 py-2.5 rounded-lg bg-[#162b20] border border-[#1e3d2c] text-sm text-[#e8f5e9] placeholder-[#3a5e48] focus:outline-none focus:border-[#00e676]/50 focus:ring-1 focus:ring-[#00e676]/20 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#7a9e88] mb-2">Business Category</label>
              <input type="hidden" name="category" value={selectedCategory} />
              <div className="grid grid-cols-2 gap-2">
                {categories.map(({ value, label, emoji }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSelectedCategory(value)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium text-left transition-all border ${
                      selectedCategory === value
                        ? 'bg-[#00e676]/10 border-[#00e676]/40 text-[#00e676]'
                        : 'bg-[#162b20] border-[#1e3d2c] text-[#7a9e88] hover:border-[#00e676]/20 hover:text-[#e8f5e9]'
                    }`}
                  >
                    <span>{emoji}</span>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={pending}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#00e676] text-[#09110e] font-bold text-sm hover:bg-[#00e676]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {pending && <Loader2 size={15} className="animate-spin" />}
              Go to Dashboard →
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
