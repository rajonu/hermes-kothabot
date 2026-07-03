import { createAdminClient } from '@/lib/supabase/server';
import { PaymentTicket } from './PaymentTicket';
import Link from 'next/link';

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = 'pending' } = await searchParams;
  const db = createAdminClient();

  const query = (db as any)
    .from('payment_requests')
    .select('*, shops(name, owner_id)')
    .order('created_at', { ascending: status === 'pending' });

  const { data: requests } = await (status === 'all' ? query : query.eq('status', status));

  const pending      = await (db as any).from('payment_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending');
  const pendingCount = pending.count ?? 0;

  return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-white">Payment Requests</h1>
            <p className="text-xs text-gray-500">Review and approve customer payments</p>
          </div>
          {pendingCount > 0 && (
            <span className="ml-auto px-2.5 py-1 text-xs font-bold rounded-full bg-amber-500 text-white shrink-0">
              {pendingCount} pending
            </span>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-5 sm:mb-6 border-b border-gray-800 pb-4">
          {[
            { id: 'pending',  label: 'Pending',  dot: pendingCount > 0 },
            { id: 'approved', label: 'Approved' },
            { id: 'rejected', label: 'Rejected' },
            { id: 'all',      label: 'All' },
          ].map(tab => (
            <Link
              key={tab.id}
              href={`/admin/payments?status=${tab.id}`}
              className={`relative px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs font-semibold transition-colors ${
                status === tab.id
                  ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-600/20'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {tab.label}
              {tab.dot && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full" />}
            </Link>
          ))}
        </div>

        {/* Tickets */}
        {!requests || requests.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            No {status === 'all' ? '' : status} payment requests.
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req: any) => (
              <PaymentTicket key={req.id} request={req} />
            ))}
          </div>
        )}
      </div>
  );
}
