'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getLeads, generateProposal, getToken } from '@/lib/api';
import type { Lead, ProposalGenerateRequest } from '@/lib/api';

const proposalTypeOptions = [
  { value: 'proposal', label: 'Proposal' },
  { value: 'sow', label: 'Statement of Work' },
];

const rateTypeOptions = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'project', label: 'Project-Based' },
];

const currencyOptions = ['USD', 'EUR', 'GBP', 'CAD'];

export default function NewProposalPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [proposalType, setProposalType] = useState('proposal');
  const [scopeNotes, setScopeNotes] = useState('');
  const [timelinePreference, setTimelinePreference] = useState('8 weeks');
  const [rateType, setRateType] = useState('hourly');
  const [rateAmount, setRateAmount] = useState(120);
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const leadIdParam = params.get('lead_id');
      setSelectedLeadId(leadIdParam ? Number(leadIdParam) : null);
    }
    fetchLeads();
  }, [router]);

  const fetchLeads = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getLeads();
      setLeads(data);
    } catch (err: any) {
      setError(err.message || 'Could not load leads.');
    } finally {
      setLoading(false);
    }
  };

  const filteredLeads = useMemo(
    () => leads.filter((lead) => lead.company_name.toLowerCase().includes(searchTerm.toLowerCase())),
    [leads, searchTerm],
  );

  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) || null;

  const handleGenerate = async () => {
    if (!selectedLeadId) {
      setError('Please select a lead first.');
      return;
    }
    if (!scopeNotes.trim()) {
      setError('Please describe the project.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const payload: ProposalGenerateRequest = {
        lead_id: selectedLeadId,
        proposal_type: proposalType,
        scope_notes: scopeNotes,
        timeline_preference: timelinePreference,
        rate_type: rateType,
        rate_amount: rateAmount,
        currency,
      };
      const result = await generateProposal(payload);
      router.push(`/proposals/${result.id}`);
    } catch (err: any) {
      setError(err.message || 'Proposal generation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm uppercase tracking-[0.35em] text-sky-600">New proposal</p>
          <h1 className="mt-2 text-3xl font-semibold">Draft a tailored proposal</h1>
          <p className="mt-3 text-sm text-zinc-500">Select a lead, describe the project, and generate a polished proposal or SOW.</p>
        </div>

        {error ? (
          <div className="rounded-3xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}{' '}
            <button type="button" onClick={handleGenerate} className="font-semibold text-rose-900 underline">
              Try again
            </button>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-zinc-900">Search leads</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search by company"
                  className="mt-2 w-full rounded-3xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-900">Select lead</label>
                <select
                  value={selectedLeadId ?? ''}
                  onChange={(event) => setSelectedLeadId(Number(event.target.value))}
                  disabled={loading}
                  className="mt-2 w-full rounded-3xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500"
                >
                  <option value="">Choose a lead</option>
                  {filteredLeads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.company_name} — {lead.contact_name || 'No contact'}
                    </option>
                  ))}
                </select>
              </div>

              {selectedLead ? (
                <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
                  <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Selected lead</p>
                  <p className="mt-3 text-xl font-semibold text-zinc-900">{selectedLead.company_name}</p>
                  <p className="mt-1 text-sm text-zinc-600">{selectedLead.contact_name || 'No contact name'}</p>
                  <p className="mt-1 text-sm text-zinc-600">{selectedLead.contact_role || 'No role provided'}</p>
                  <p className="mt-4 text-sm leading-7 text-zinc-700">{selectedLead.signal_justification || 'No signal justification available.'}</p>
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold text-zinc-900">Proposal type</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {proposalTypeOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setProposalType(option.value)}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                          proposalType === option.value
                            ? 'bg-slate-900 text-white'
                            : 'border border-zinc-200 bg-white text-zinc-700 hover:border-slate-300 hover:bg-zinc-50'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">Rate structure</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {rateTypeOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setRateType(option.value)}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                          rateType === option.value
                            ? 'bg-slate-900 text-white'
                            : 'border border-zinc-200 bg-white text-zinc-700 hover:border-slate-300 hover:bg-zinc-50'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-zinc-900">Rate amount</span>
                  <input
                    type="number"
                    value={rateAmount}
                    onChange={(event) => setRateAmount(Number(event.target.value))}
                    className="mt-2 w-full rounded-3xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-zinc-900">Currency</span>
                  <select
                    value={currency}
                    onChange={(event) => setCurrency(event.target.value)}
                    className="mt-2 w-full rounded-3xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500"
                  >
                    {currencyOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-zinc-900">Timeline preference</span>
                <input
                  type="text"
                  value={timelinePreference}
                  onChange={(event) => setTimelinePreference(event.target.value)}
                  placeholder="e.g. 8 weeks, Q3 start"
                  className="mt-2 w-full rounded-3xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-zinc-900">Scope notes</span>
                <textarea
                  value={scopeNotes}
                  onChange={(event) => setScopeNotes(event.target.value)}
                  rows={8}
                  placeholder="Describe the project in your own words"
                  className="mt-2 w-full rounded-3xl border border-zinc-300 bg-zinc-50 px-4 py-4 text-sm outline-none transition focus:border-sky-500"
                />
              </label>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={submitting || loading}
                  className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? 'Drafting your proposal...' : 'Generate Proposal'}
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/proposals')}
                  className="rounded-2xl border border-zinc-300 bg-white px-6 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                >
                  Back to proposals
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-sm uppercase tracking-[0.35em] text-zinc-600">Lead details</p>
            <div className="mt-6 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Company</p>
                <p className="mt-2 text-lg font-semibold text-zinc-900">{selectedLead?.company_name || 'No lead selected'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Contact</p>
                <p className="mt-2 text-lg font-semibold text-zinc-900">{selectedLead?.contact_name || '—'}</p>
                <p className="mt-1 text-sm text-zinc-600">{selectedLead?.contact_role || 'No role provided'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Signal justification</p>
                <p className="mt-2 text-sm leading-7 text-zinc-700">{selectedLead?.signal_justification || 'No signal justification available.'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
