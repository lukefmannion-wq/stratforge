'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getLead, getToken, reanalyzeLead } from '@/lib/api';

export default function LeadDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    fetchLead();
  }, [params.id, router]);

  const fetchLead = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getLead(Number(params.id));
      setLead(data);
    } catch (err: any) {
      setError(err.message || 'Could not load lead.');
    } finally {
      setLoading(false);
    }
  };

  const handleReanalyze = async () => {
    if (!lead) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const data = await reanalyzeLead(lead.id);
      setLead(data);
      setMessage('Re-analysis complete.');
    } catch (err: any) {
      setError(err.message || 'Could not re-analyze lead.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-900">
        <div className="mx-auto max-w-4xl rounded-3xl border border-zinc-200 bg-white p-10 shadow-sm text-center text-sm text-zinc-500">
          Loading lead details...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-900">
        <div className="mx-auto max-w-4xl rounded-3xl border border-rose-200 bg-rose-50 p-10 shadow-sm text-center text-sm text-rose-700">
          {error}
        </div>
      </div>
    );
  }

  if (!lead) {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-sky-600">Lead detail</p>
            <h1 className="mt-2 text-3xl font-semibold">{lead.company_name}</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/outreach?lead_id=${lead.id}`}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Generate Outreach
            </Link>
            <button
              type="button"
              onClick={handleReanalyze}
              disabled={saving}
              className="rounded-2xl border border-sky-600 bg-white px-5 py-3 text-sm font-semibold text-sky-600 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Re-analyzing...' : 'Re-analyze fit'}
            </button>
          </div>
        </div>

        {message ? <div className="rounded-3xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
        {error ? <div className="rounded-3xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
              <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Company</p>
              <p className="mt-3 text-lg font-semibold text-zinc-900">{lead.company_name}</p>
              {lead.company_website ? (
                <a href={lead.company_website} target="_blank" rel="noreferrer" className="mt-2 block text-sm text-sky-600 hover:text-sky-700">
                  {lead.company_website}
                </a>
              ) : null}
            </div>
            <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
              <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Contact</p>
              <p className="mt-3 text-lg font-semibold text-zinc-900">{lead.contact_name || '—'}</p>
              <p className="mt-1 text-sm text-zinc-600">{lead.contact_role || 'No role provided'}</p>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
              <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Fit score</p>
              <p className="mt-3 text-2xl font-semibold text-zinc-900">{lead.fit_score || 'Unable to analyze'}</p>
            </div>
            <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
              <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Status</p>
              <p className="mt-3 text-2xl font-semibold text-zinc-900">{lead.status}</p>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
            <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Notes</p>
            <p className="mt-3 text-sm leading-7 text-zinc-700">{lead.notes || 'No notes added.'}</p>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
            <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Signal justification</p>
            <p className="mt-3 text-sm leading-7 text-zinc-700">{lead.signal_justification || 'No analysis available.'}</p>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Enrichment data</p>
              <button
                type="button"
                onClick={() => setLead({ ...lead, enrichment_data: lead.enrichment_data })}
                className="text-xs font-semibold text-sky-600 hover:text-sky-700"
              >
                JSON view
              </button>
            </div>
            <pre className="mt-3 max-h-72 overflow-auto rounded-3xl bg-black/5 p-4 text-xs leading-6 text-zinc-800">
              {lead.enrichment_data ? JSON.stringify(lead.enrichment_data, null, 2) : 'No enrichment data available.'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
