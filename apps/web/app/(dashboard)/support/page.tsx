import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/common/PageHeader';
import { LifeBuoy, Plus, Clock, CheckCircle, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { NewTicketForm } from './NewTicketForm';
import { formatDate } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  open:     'text-amber-400 bg-amber-400/10 border-amber-400/20',
  pending:  'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  resolved: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
};

export default async function SupportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: shopRaw } = await (supabase as any).from('shops').select('id').eq('owner_id', user.id).single();
  if (!shopRaw) return null;

  const { data: tickets } = await (supabase as any)
    .from('support_tickets')
    .select('id, subject, status, messages, unread_client, created_at, updated_at')
    .eq('shop_id', shopRaw.id)
    .order('updated_at', { ascending: false });

  const allTickets = tickets ?? [];
  const openCount     = allTickets.filter((t: any) => t.status === 'open').length;
  const pendingCount  = allTickets.filter((t: any) => t.status === 'pending').length;
  const resolvedCount = allTickets.filter((t: any) => t.status === 'resolved').length;

  return (
    <div>
      <PageHeader
        title="Support"
        description="Get help from the KothaBot team. We respond within 24 hours."
        docsUrl="https://kothabot.ai.bd/docs/create-ticket"
      />

      {/* Stats */}
      {allTickets.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Open',     count: openCount,     color: 'text-amber-400',   bg: 'bg-amber-400/10',   icon: Clock },
            { label: 'Pending',  count: pendingCount,  color: 'text-cyan-400',    bg: 'bg-cyan-400/10',    icon: MessageSquare },
            { label: 'Resolved', count: resolvedCount, color: 'text-emerald-400', bg: 'bg-emerald-400/10', icon: CheckCircle },
          ].map(({ label, count, color, bg, icon: Icon }) => (
            <div key={label} className={`rounded-xl border border-gray-800 ${bg} p-4 flex items-center gap-3`}>
              <Icon size={18} className={color} />
              <div>
                <p className={`text-xl font-bold ${color}`}>{count}</p>
                <p className="text-xs text-gray-400">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New ticket form */}
      <div className="rounded-xl border border-gray-800 bg-gray-800 overflow-hidden mb-5">
        <div className="px-5 py-4 border-b border-gray-700 flex items-center gap-2">
          <Plus size={15} className="text-emerald-400" />
          <h2 className="text-sm font-semibold text-white">Create New Ticket</h2>
        </div>
        <div className="p-5">
          <NewTicketForm shopId={shopRaw.id} />
        </div>
      </div>

      {/* Ticket list */}
      <div className="rounded-xl border border-gray-800 bg-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-white">Your Tickets</h2>
        </div>

        {allTickets.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-700 flex items-center justify-center">
              <LifeBuoy size={24} className="text-gray-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">No tickets yet</p>
              <p className="text-xs text-gray-400 mt-1">Create a ticket above if you need help.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {allTickets.map((ticket: any) => {
              const msgCount = ticket.messages?.length ?? 0;
              const hasUnread = ticket.unread_client;
              return (
                <Link
                  key={ticket.id}
                  href={`/support/${ticket.id}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {hasUnread && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      )}
                      <p className={`text-sm font-medium truncate ${hasUnread ? 'text-white' : 'text-gray-200'}`}>
                        {ticket.subject}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500">
                      {msgCount} {msgCount === 1 ? 'message' : 'messages'} · Updated {formatDate(ticket.updated_at)}
                    </p>
                  </div>
                  <span className={`ml-4 text-[11px] font-semibold px-2.5 py-1 rounded-full border capitalize shrink-0 ${
                    STATUS_STYLES[ticket.status] ?? 'text-gray-400 bg-gray-700 border-gray-600'
                  }`}>
                    {ticket.status}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
