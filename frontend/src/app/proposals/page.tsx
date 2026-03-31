'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getProposals, getToken } from '@/lib/api';
import type { Proposal } from '@/lib/api';

const statuses = ['All', 'Draft', 'Sent', 'Accepted', 'Declined'] as const;
const statusClasses: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-700',
  Sent: 'bg-amber-100 text-amber-800',
  Accepted: 'bg-emerald-100 text-emerald-800',
  Declined: 'bg-rose-100 text-rose-700',
};

const formatCurrency = (value: number, currency: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(value);

export default function ProposalsPage() {
  const router = useRouter();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<typeof statuses[number]>('All');

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    fetchProposals();
  }, [router]);

  const fetchProposals = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getProposals();
      setProposals(data);
    } catch (err: any) {
      setError(err.message || 'Could not load proposals.');
    } finally {
      setLoading(false);
    }
  };

  const filteredProposals = useMemo(
    () => (filter === 'All' ? proposals : proposals.filter((proposal) => proposal.status === filter)),
    [filter, proposals],
  );

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-sky-600">Proposals</p>
            <h1 className="mt-2 text-3xl font-semibold">Pipeline conversion</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/proposals/new"
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              New Proposal
            </Link>
            <Link
              href="/leads"
              className="rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
            >
              Leads
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {statuses.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                filter === status
                  ? 'bg-slate-900 text-white'
                  : 'border border-zinc-200 bg-white text-zinc-700 hover:border-slate-300 hover:bg-zinc-50'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {error ? <div className="rounded-3xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-sm text-zinc-500">Loading proposals...</div>
          ) : filteredProposals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-sm text-zinc-500">
              <p>No proposals found for this filter.</p>
              <p className="mt-2">Create a new proposal to move a lead toward conversion.</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-700">
                <tr>
                  {['Lead Company', 'Contact', 'Type', 'Title', 'Total Value', 'Status', 'Version', 'Created', 'Updated'].map((header) => (
                    <th key={header} className="whitespace-nowrap px-4 py-3 font-semibold">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {filteredProposals.map((proposal) => (
                  <tr
                    key={proposal.id}
                    className="cursor-pointer hover:bg-zinc-50"
                    onClick={() => router.push(`/proposals/${proposal.id}`)}
                  >
                    <td className="whitespace-nowrap px-4 py-4 font-medium text-zinc-900">{proposal.company_name || '—'}</td>
                    <td className="px-4 py-4 text-zinc-700">{proposal.contact_name || '—'}</td>
                    <td className="px-4 py-4 text-zinc-700">{proposal.proposal_type === 'sow' ? 'Statement of Work' : 'Proposal'}</td>
                    <td className="px-4 py-4 text-zinc-700">{proposal.title}</td>
                    <td className="px-4 py-4 text-zinc-700">{formatCurrency(proposal.total_price, proposal.currency)}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[proposal.status] || 'bg-slate-100 text-slate-700'}`}>
                        {proposal.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-zinc-700">v{proposal.version}</td>
                    <td className="px-4 py-4 text-zinc-700">{new Date(proposal.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-4 text-zinc-700">{new Date(proposal.updated_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
