import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/common/PageHeader';
import { ProductManager } from './ProductManager';
import { getDocsCategory } from '@/lib/category-nav';

// Category display config
export const CATEGORY_CONFIG: Record<string, {
  emoji: string;
  title: string;
  subtitle: string;
  itemLabel: string;
  categories: string[];
  extraFields: string[];
}> = {
  restaurant: {
    emoji: '🍽️',
    title: 'Menu',
    subtitle: 'Add dishes, drinks and combos. The AI will use this to take orders and answer menu questions.',
    itemLabel: 'Dish / Item',
    categories: ['Starter', 'Main Course', 'Dessert', 'Drinks', 'Snacks', 'Combo', 'Special'],
    extraFields: ['spicy', 'veg'],
  },
  grocery: {
    emoji: '🛒',
    title: 'Product Inventory',
    subtitle: 'Add grocery products with prices and stock. AI will check availability for customers.',
    itemLabel: 'Product',
    categories: ['Vegetables', 'Fruits', 'Dairy', 'Grains', 'Beverages', 'Snacks', 'Household', 'Other'],
    extraFields: ['unit', 'stock'],
  },
  retail: {
    emoji: '🛍️',
    title: 'Product Catalog',
    subtitle: 'Add your products with prices and stock levels. AI will quote prices and check availability.',
    itemLabel: 'Product',
    categories: ['Electronics', 'Clothing', 'Footwear', 'Accessories', 'Home & Living', 'Toys', 'Other'],
    extraFields: ['sku', 'stock'],
  },
  clinic: {
    emoji: '🧪',
    title: 'Tests & Diagnostics',
    subtitle: 'Add diagnostic tests, panels and packages. AI will quote prices, explain preparation and book test appointments.',
    itemLabel: 'Test',
    categories: ['Blood Test', 'Urine Test', 'Radiology', 'Pathology', 'Cardiology', 'Microbiology', 'Genetic Test', 'Package'],
    extraFields: ['sample_type', 'turnaround_time', 'preparation', 'report_format'],
  },
  pharmacy: {
    emoji: '💊',
    title: 'Medicine Catalog',
    subtitle: 'Add medicines with prices. AI will check availability and quote prices.',
    itemLabel: 'Medicine',
    categories: ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Drops', 'Other'],
    extraFields: ['generic', 'prescription'],
  },
  salon: {
    emoji: '✂️',
    title: 'Services & Pricing',
    subtitle: 'Add your services with duration and prices. AI will book appointments.',
    itemLabel: 'Service',
    categories: ['Hair', 'Skin', 'Nails', 'Waxing', 'Massage', 'Bridal', 'Other'],
    extraFields: ['duration'],
  },
  services: {
    emoji: '🔧',
    title: 'Services',
    subtitle: 'Add your services with rates. AI will explain services and collect leads.',
    itemLabel: 'Service',
    categories: ['Repair', 'Installation', 'Consultation', 'Delivery', 'Cleaning', 'Other'],
    extraFields: ['duration'],
  },
  real_estate: {
    emoji: '🏠',
    title: 'Properties',
    subtitle: 'Add your property listings. AI will share details, pricing and arrange viewings.',
    itemLabel: 'Property',
    categories: ['Apartment', 'House', 'Commercial', 'Office', 'Land', 'Other'],
    extraFields: ['location', 'bedrooms', 'bathrooms', 'area_size'],
  },
  education: {
    emoji: '🎓',
    title: 'Courses & Programs',
    subtitle: 'Add courses with fees and schedules. AI will answer admission questions and collect enquiries.',
    itemLabel: 'Course',
    categories: ['School', 'College', 'University', 'Coaching', 'Online Course', 'Workshop'],
    extraFields: ['instructor', 'schedule', 'duration'],
  },
  creative_agency: {
    emoji: '🎨',
    title: 'Services & Packages',
    subtitle: 'Add your agency services with pricing and timelines. AI will explain offerings and collect project leads.',
    itemLabel: 'Service',
    categories: ['Web Design', 'SEO', 'Marketing', 'Branding', 'Video Production', 'Photography', 'Other'],
    extraFields: ['delivery_time'],
  },
  other: {
    emoji: '📋',
    title: 'Products & Services',
    subtitle: 'Add your items, products or services. The AI will reference this to answer questions.',
    itemLabel: 'Item',
    categories: ['Product', 'Service', 'Package', 'Other'],
    extraFields: [],
  },
};

export default async function ProductsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: shopRaw } = await (supabase as any).from('shops').select('id, name, category, ai_config').eq('owner_id', user.id).single();
  if (!shopRaw) return null;

  const category = (shopRaw.category as string) || 'other';
  const cfg = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.other;
  const currency = (shopRaw.ai_config?.billing_region ?? 'BD') === 'INTL' ? 'USD' : 'BDT';

  const { data: productsRaw } = await (supabase as any)
    .from('products')
    .select('*')
    .eq('shop_id', shopRaw.id)
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  // Exclude doctor/service typed products from clinic Tests panel — those live in Scheduling.
  // Products with no product_type default to 'doctor' (same logic as scheduling/page.tsx).
  const products = category === 'clinic'
    ? (productsRaw ?? []).filter((p: any) => !['doctor', 'service'].includes(p.metadata?.product_type ?? 'doctor'))
    : (productsRaw ?? []);

  return (
    <div>
      <PageHeader
        title={`${cfg.emoji} ${cfg.title}`}
        description={cfg.subtitle}
        docsUrl={`https://kothabot.ai.bd/docs/services-module?category=${getDocsCategory(category)}`}
      />
      <ProductManager
        shopId={shopRaw.id}
        shopCategory={category}
        cfg={cfg}
        currency={currency}
        initialProducts={products ?? []}
      />
    </div>
  );
}
