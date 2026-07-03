import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/admin-session';
import { createAdminClient } from '@/lib/supabase/server';
import AdminShell from './admin/_components/AdminShell';

// Admin pages read the session cookie and live DB counts per request — never
// statically prerender them (was causing 60s+ build-time timeouts fetching
// data with no real request context).
export const dynamic = 'force-dynamic';

async function getAdminBadges() {
  const db = createAdminClient();
  const [{ count: pendingPayments }, { count: unreadTickets }] = await Promise.all([
    (db as any).from('payment_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    (db as any).from('support_tickets').select('id', { count: 'exact', head: true }).eq('unread_admin', true),
  ]);
  return { pendingPayments: pendingPayments ?? 0, unreadTickets: unreadTickets ?? 0 };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect('/admin-login');

  const badges = await getAdminBadges();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <AdminShell badges={badges}>
        {children}
      </AdminShell>
    </div>
  );
}
