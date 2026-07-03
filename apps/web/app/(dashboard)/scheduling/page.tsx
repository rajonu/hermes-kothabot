import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { SchedulingSettings } from './SchedulingSettings';
import { PageHeader } from '@/components/common/PageHeader';

export const dynamic = 'force-dynamic';

export default async function SchedulingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: shop } = await (supabase as any)
    .from('shops')
    .select('id, name, category, ai_config')
    .eq('owner_id', user.id)
    .single();

  if (!shop || shop.category !== 'clinic') notFound();
  const currency = (shop.ai_config?.billing_region ?? 'BD') === 'INTL' ? 'USD' : 'BDT';

  const db = await import('@/lib/supabase/server').then(m => m.createClient());

  const [
    { data: locations },
    { data: schedules },
    { data: specialDays },
    { data: allProducts },
  ] = await Promise.all([
    (db as any).from('clinic_locations').select('*').eq('shop_id', shop.id).order('sort_order'),
    (db as any).from('clinic_schedules').select('*').eq('shop_id', shop.id).order('doctor_id').order('weekday').order('start_time'),
    (db as any).from('clinic_special_days').select('*').eq('shop_id', shop.id).order('date'),
    (db as any).from('products').select('id, name, price, metadata, is_available').eq('shop_id', shop.id).order('sort_order'),
  ]);

  // Split products by type — only show explicitly typed products in Scheduling.
  // Untyped products (legacy) are skipped; they should be recategorized via Tests or Products panels.
  const products = allProducts ?? [];
  const doctors  = products.filter((p: any) => p.metadata?.product_type === 'doctor');
  const services = products.filter((p: any) => p.metadata?.product_type === 'service');

  // Doctor-service and doctor-location links
  const [{ data: dsLinks }, { data: dlLinks }] = await Promise.all([
    (db as any).from('clinic_doctor_services').select('doctor_id, service_id').eq('shop_id', shop.id),
    (db as any).from('clinic_doctor_locations').select('doctor_id, location_id').eq('shop_id', shop.id),
  ]);

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Scheduling Settings"
        description="Manage locations, doctor schedules, off-days, and available services — clinic only."
      />
      <SchedulingSettings
        shopId={shop.id}
        currency={currency}
        locations={locations ?? []}
        schedules={schedules ?? []}
        specialDays={specialDays ?? []}
        doctors={doctors ?? []}
        services={services ?? []}
        dsLinks={dsLinks ?? []}
        dlLinks={dlLinks ?? []}
      />
    </div>
  );
}
