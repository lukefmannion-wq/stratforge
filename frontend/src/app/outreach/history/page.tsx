'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getOutreachMessages, getToken } from '@/lib/api';
import type { OutreachMessage } from '@/lib/api';

const filters = ['All', 'Draft', 'Sent', 'Replied'] as const;
const labelMap: Record<string, string> = {
  cold_email: 'Cold Email',
  linkedin: 'LinkedIn',
  followup_1: 'Follow-up 1',
  followup_2: 'Follow-up 2',
  followup_3: 'Follow-up 3',
};

export default function OutreachHistoryPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<OutreachMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<typeof filters[number]>('All');

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    fetchHistory();
  }, [router]);

  const fetchHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getOutreachMessages();
      setMessages(data);
    } catch (err: any) {
      setError(err.message || 'Could not load outreach history.');
    } finally {
      setLoading(false);
    }
  };

  const filteredMessages = messages.filter((message) => (filter === 'All' ? true : message.status === filter));

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-sky-600">Outreach history</p>
            <h1 className="mt-2 text-3xl font-semibold">All generated messages</h1>
          </div>
          <Link
            href="/leads"
            className="rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
          >
            Back to Leads
          </Link>
        </div>

        <div className="flex flex-wrap gap-3">
          {filters.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setFilter(option)}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                filter === option
                  ? 'bg-slate-900 text-white'
                  : 'border border-zinc-200 bg-white text-zinc-700 hover:border-slate-300 hover:bg-zinc-50'
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        {error ? <div className="rounded-3xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-sm text-zinc-500">Loading outreach history...</div>
          ) : filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-sm text-zinc-500">
              <p>No outreach messages match this filter.</p>
              <p className="mt-2">Generate outreach from a lead to see messages here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
                <thead className="bg-zinc-50 text-zinc-700">
                  <tr>
                    {['Company', 'Contact', 'Type', 'Subject', 'Status', 'Generated', 'Sent'].map((header) => (
                      <th key={header} className="whitespace-nowrap px-4 py-3 font-semibold">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white">
                  {filteredMessages.map((message) => (
                    <tr
                      key={message.id}
                      className="cursor-pointer hover:bg-zinc-50"
                      onClick={() => router.push(`/outreach?lead_id=${message.lead_id}`)}
                    >
                      <td className="whitespace-nowrap px-4 py-4 font-medium text-zinc-900">{message.company_name || '—'}</td>
                      <td className="px-4 py-4 text-zinc-700">{message.contact_name || '—'}</td>
                      <td className="px-4 py-4 text-zinc-700">{labelMap[message.message_type] || message.message_type}</td>
                      <td className="px-4 py-4 text-zinc-700">{message.subject_line || '—'}</td>
                      <td className="px-4 py-4 text-zinc-700">{message.status}</td>
                      <td className="px-4 py-4 text-zinc-700">{new Date(message.generated_at).toLocaleDateString()}</td>
                      <td className="px-4 py-4 text-zinc-700">{message.sent_at ? new Date(message.sent_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
