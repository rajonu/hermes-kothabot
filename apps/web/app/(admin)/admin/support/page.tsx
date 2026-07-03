import { createAdminClient } from '@/lib/supabase/server';
import { getAdminSession } from '@/lib/admin-session';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MessageSquare } from 'lucide-react';
// ArrowLeft still used for mobile back-to-list navigation
import { AdminTicketReply } from './AdminTicketReply';
import { formatDate } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  open:     'text-amber-400 bg-amber-400/10 border-amber-400/20',
  pending:  'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  resolved: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
};

interface Props { searchParams: Promise<{ ticket?: string; status?: string }> }

export default async function AdminSupportPage({ searchParams }: Props) {
  const session = await getAdminSession();
  if (!session) redirect('/admin-login');

  const { ticket: ticketId, status: statusFilter } = await searchParams;
  const db = createAdminClient();

  let query = (db as any)
    .from('support_tickets')
    .select('id, subject, status, messages, unread_admin, shop_id, created_at, updated_at')
    .order('updated_at', { ascending: false });

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data: tickets, error: ticketsError } = await query;
  if (ticketsError) console.error('[admin/support] tickets query error:', ticketsError);
  const allTickets = tickets ?? [];

  const shopIds = [...new Set(allTickets.map((t: any) => t.shop_id))];
  const { data: shops } = shopIds.length > 0
    ? await (db as any).from('shops').select('id, name').in('id', shopIds)
    : { data: [] };
  const shopMap: Record<string, string> = {};
  (shops ?? []).forEach((s: any) => { shopMap[s.id] = s.name; });

  const selectedTicket = ticketId
    ? allTickets.find((t: any) => t.id === ticketId) ?? null
    : null;

  const unreadCount = allTickets.filter((t: any) => t.unread_admin).length;

  // Build the ticket list JSX (shared between mobile/desktop)
  const ticketList = (
    <>
      {/* Status filter */}
      <div className="flex gap-1 p-3 border-b border-gray-800">
        {['all', 'open', 'pending', 'resolved'].map(s => (
          <Link
            key={s}
            href={`/admin/support?status=${s}${ticketId ? `&ticket=${ticketId}` : ''}`}
            className={`flex-1 text-center text-xs py-1.5 rounded-lg font-medium capitalize transition-colors ${
              (statusFilter ?? 'all') === s
                ? 'bg-emerald-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-gray-800">
        {allTickets.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 text-center">No tickets.</p>
        ) : (
          allTickets.map((t: any) => (
            <Link
              key={t.id}
              href={`/admin/support?ticket=${t.id}${statusFilter ? `&status=${statusFilter}` : ''}`}
              className={`block px-4 py-3 hover:bg-gray-800/50 active:bg-gray-800 transition-colors ${
                selectedTicket?.id === t.id ? 'bg-emerald-600/10 border-r-2 border-r-emerald-500' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className={`text-xs font-semibold truncate ${t.unread_admin ? 'text-white' : 'text-gray-300'}`}>
                  {t.unread_admin && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 mb-0.5" />}
                  {t.subject}
                </p>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 capitalize ${
                  STATUS_STYLES[t.status] ?? 'text-gray-400'
                }`}>
                  {t.status}
                </span>
              </div>
              <p className="text-[11px] text-gray-500">
                {shopMap[t.shop_id] ?? 'Unknown shop'} · {formatDate(t.updated_at)}
              </p>
            </Link>
          ))
        )}
      </div>
    </>
  );

  return (
    <div className="flex flex-col h-full">
      {/* ── Title bar ── */}
      <div className="px-4 sm:px-6 py-3 flex items-center gap-3 shrink-0">
        {/* Mobile: back to list when a ticket is open */}
        {selectedTicket && (
          <Link
            href={`/admin/support${statusFilter ? `?status=${statusFilter}` : ''}`}
            className="md:hidden p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors shrink-0"
          >
            <ArrowLeft size={16} />
          </Link>
        )}
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare size={15} className="text-emerald-400 shrink-0" />
          <h1 className="text-sm font-bold text-white truncate">
            {selectedTicket ? (
              <span className="md:hidden">{selectedTicket.subject}</span>
            ) : null}
            <span className={selectedTicket ? 'hidden md:inline' : ''}>Support Tickets</span>
          </h1>
        </div>
        {unreadCount > 0 && (
          <span className="ml-auto px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold shrink-0">{unreadCount}</span>
        )}
      </div>

      {/* ── Mobile layout ───────────────────────────────────────────── */}
      {/* Show list when no ticket selected, show detail when ticket selected */}
      <div className="md:hidden flex-1 flex flex-col overflow-hidden">
        {!selectedTicket ? (
          // Mobile: full-screen ticket list
          <div className="flex-1 flex flex-col overflow-hidden bg-gray-900">
            {ticketList}
          </div>
        ) : (
          // Mobile: full-screen ticket detail
          <div className="flex-1 flex flex-col overflow-hidden bg-gray-950">
            <AdminTicketReply ticket={selectedTicket} shopName={shopMap[selectedTicket.shop_id] ?? 'Unknown'} />
          </div>
        )}
      </div>

      {/* ── Desktop two-pane layout (≥ md) ──────────────────────────── */}
      <div className="hidden md:flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 57px)' }}>
        {/* Sidebar */}
        <div className="w-80 shrink-0 border-r border-gray-800 bg-gray-900 flex flex-col overflow-hidden">
          {ticketList}
        </div>

        {/* Detail panel */}
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-950">
          {!selectedTicket ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare size={32} className="mx-auto mb-3 text-gray-700" />
                <p className="text-gray-500 text-sm">Select a ticket to view it</p>
              </div>
            </div>
          ) : (
            <AdminTicketReply ticket={selectedTicket} shopName={shopMap[selectedTicket.shop_id] ?? 'Unknown'} />
          )}
        </div>
      </div>
    </div>
  );
}
