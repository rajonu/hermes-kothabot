import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ReplyForm } from './ReplyForm';

const STATUS_STYLES: Record<string, string> = {
  open:     'text-amber-400 bg-amber-400/10 border-amber-400/20',
  pending:  'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  resolved: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
};

interface Props { params: Promise<{ id: string }> }

export default async function TicketDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: shopRaw } = await (supabase as any).from('shops').select('id').eq('owner_id', user.id).single();
  if (!shopRaw) redirect('/support');

  const { data: ticket } = await (supabase as any)
    .from('support_tickets')
    .select('*')
    .eq('id', id)
    .eq('shop_id', shopRaw.id)
    .single();

  if (!ticket) notFound();

  // Mark as read by client
  if (ticket.unread_client) {
    await (supabase as any)
      .from('support_tickets')
      .update({ unread_client: false })
      .eq('id', id);
  }

  const messages: any[] = ticket.messages ?? [];

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-start gap-3 mb-5">
        <Link href="/support" className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors mt-0.5 shrink-0">
          <ArrowLeft size={15} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-bold text-white truncate">{ticket.subject}</h1>
            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border capitalize shrink-0 ${
              STATUS_STYLES[ticket.status] ?? 'text-gray-400 bg-gray-700 border-gray-600'
            }`}>
              {ticket.status}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 font-mono">{ticket.id.slice(0, 8)}…</p>
        </div>
      </div>

      {/* Messages thread */}
      <div className="space-y-3 mb-5">
        {messages.length === 0 ? (
          <p className="text-sm text-gray-500">No messages yet.</p>
        ) : (
          messages.map((msg: any, i: number) => {
            const isAdmin = msg.role === 'admin';
            return (
              <div key={i} className={`flex ${isAdmin ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  isAdmin
                    ? 'bg-gray-800 border border-gray-700 rounded-tl-sm'
                    : 'bg-emerald-600/20 border border-emerald-600/30 rounded-tr-sm'
                }`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-[11px] font-semibold ${isAdmin ? 'text-emerald-400' : 'text-gray-300'}`}>
                      {isAdmin ? '🛡️ KothaBot Support' : '👤 You'}
                    </span>
                    <span className="text-[10px] text-gray-600">
                      {new Date(msg.created_at).toLocaleDateString('en', { day: 'numeric', month: 'short' })} at{' '}
                      {new Date(msg.created_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {msg.text && <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">{msg.text}</p>}
                  {msg.screenshot && (
                    <a href={msg.screenshot} target="_blank" rel="noopener noreferrer" className="block mt-2">
                      <img
                        src={msg.screenshot}
                        alt="Screenshot"
                        className="max-h-48 rounded-lg border border-gray-600 object-contain hover:opacity-90 transition-opacity cursor-zoom-in"
                      />
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reply form (only if not resolved) */}
      {ticket.status !== 'resolved' ? (
        <div className="rounded-xl border border-gray-800 bg-gray-800 p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Add Reply</h3>
          <ReplyForm ticketId={id} />
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-600/20 bg-emerald-600/5 p-4 text-center">
          <p className="text-sm text-emerald-400 font-medium">✓ This ticket has been resolved</p>
          <p className="text-xs text-gray-400 mt-1">
            Need more help?{' '}
            <Link href="/support" className="text-emerald-400 hover:underline">Open a new ticket</Link>
          </p>
        </div>
      )}
    </div>
  );
}
