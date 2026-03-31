'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  deleteProposal,
  duplicateProposal,
  exportProposalHtml,
  getProposal,
  getToken,
  markProposalSent,
  updateProposal,
} from '@/lib/api';
import type { PricingLineItem, Proposal, ProposalPhase, ProposalUpdateRequest } from '@/lib/api';

const statusClasses: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-700',
  Sent: 'bg-amber-100 text-amber-800',
  Viewed: 'bg-sky-100 text-sky-800',
  Accepted: 'bg-emerald-100 text-emerald-800',
  Declined: 'bg-rose-100 text-rose-700',
};

const formatCurrency = (value: number, currency: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(value);

export default function ProposalDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [draftProposal, setDraftProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingField, setEditingField] = useState<string | null>(null);
  const saveTimeout = useRef<number | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    fetchProposal();
  }, [params.id, router]);

  useEffect(() => {
    if (!draftProposal || !proposal) return;
    if (saveTimeout.current) {
      window.clearTimeout(saveTimeout.current);
    }
    saveTimeout.current = window.setTimeout(() => saveDraft(), 1500);
    return () => {
      if (saveTimeout.current) {
        window.clearTimeout(saveTimeout.current);
      }
    };
  }, [draftProposal?.executive_summary, draftProposal?.problem_statement, draftProposal?.proposed_approach, draftProposal?.timeline, draftProposal?.pricing_table, draftProposal?.notes]);

  useEffect(() => {
    if (!proposal) return;
    setDraftProposal(proposal);
  }, [proposal]);

  useEffect(() => {
    if (!previewMode) return;
    fetchPreview();
  }, [previewMode]);

  const fetchProposal = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getProposal(Number(params.id));
      setProposal(data);
      setDraftProposal(data);
    } catch (err: any) {
      setError(err.message || 'Could not load proposal.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPreview = async () => {
    if (!proposal) return;
    setPreviewLoading(true);
    setError('');
    try {
      const html = await exportProposalHtml(proposal.id);
      setPreviewHtml(html);
    } catch (err: any) {
      setError(err.message || 'Could not load preview.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const saveDraft = async () => {
    if (!draftProposal || !proposal) return;
    setActionLoading(true);
    setError('');
    try {
      const payload: ProposalUpdateRequest = {
        title: draftProposal.title,
        executive_summary: draftProposal.executive_summary,
        problem_statement: draftProposal.problem_statement,
        proposed_approach: draftProposal.proposed_approach,
        timeline: draftProposal.timeline,
        pricing_table: draftProposal.pricing_table,
        total_price: draftProposal.total_price,
        currency: draftProposal.currency,
        notes: draftProposal.notes || '',
      };
      const updated = await updateProposal(proposal.id, payload);
      setProposal(updated);
      setDraftProposal(updated);
      setSuccess('Saved.');
      window.setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(err.message || 'Could not save changes.');
    } finally {
      setActionLoading(false);
    }
  };

  const updateDraftField = (field: keyof Proposal, value: any) => {
    if (!draftProposal) return;
    setDraftProposal({ ...draftProposal, [field]: value });
  };

  const updatePhase = (index: number, field: keyof ProposalPhase, value: any) => {
    if (!draftProposal) return;
    const phases = [...draftProposal.proposed_approach];
    phases[index] = { ...phases[index], [field]: value };
    setDraftProposal({ ...draftProposal, proposed_approach: phases });
  };

  const updatePricingRow = (index: number, field: keyof PricingLineItem, value: string | number) => {
    if (!draftProposal) return;
    const pricing = [...draftProposal.pricing_table];
    const row = { ...pricing[index], [field]: field === 'description' ? value : Number(value) };
    row.total = Number((row.quantity || 0) * (row.unit_price || 0));
    pricing[index] = row;
    const totalPrice = pricing.reduce((sum, item) => sum + (item.total || 0), 0);
    setDraftProposal({ ...draftProposal, pricing_table: pricing, total_price: totalPrice });
  };

  const addPricingRow = () => {
    if (!draftProposal) return;
    const pricing = [
      ...draftProposal.pricing_table,
      { description: '', quantity: 0, unit_price: 0, total: 0 },
    ];
    setDraftProposal({ ...draftProposal, pricing_table: pricing });
  };

  const removePricingRow = (index: number) => {
    if (!draftProposal) return;
    const pricing = draftProposal.pricing_table.filter((_, idx) => idx !== index);
    const totalPrice = pricing.reduce((sum, item) => sum + (item.total || 0), 0);
    setDraftProposal({ ...draftProposal, pricing_table: pricing, total_price: totalPrice });
  };

  const handleNotesChange = (value: string) => {
    if (!draftProposal) return;
    setDraftProposal({ ...draftProposal, notes: value });
  };

  const handleMarkSent = async () => {
    if (!proposal) return;
    setActionLoading(true);
    setError('');
    try {
      const updated = await markProposalSent(proposal.id);
      setProposal(updated);
      setDraftProposal(updated);
      setSuccess('Marked as sent.');
      window.setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(err.message || 'Could not mark proposal as sent.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDuplicate = async () => {
    if (!proposal) return;
    setActionLoading(true);
    setError('');
    try {
      const duplicated = await duplicateProposal(proposal.id);
      router.push(`/proposals/${duplicated.id}`);
    } catch (err: any) {
      setError(err.message || 'Could not duplicate proposal.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!proposal || !window.confirm('Delete this proposal?')) return;
    setActionLoading(true);
    setError('');
    try {
      await deleteProposal(proposal.id);
      router.push('/proposals');
    } catch (err: any) {
      setError(err.message || 'Could not delete proposal.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExport = async () => {
    if (!proposal) return;
    setActionLoading(true);
    setError('');
    try {
      const html = await exportProposalHtml(proposal.id);
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('Unable to open print window.');
      }
      printWindow.document.open();
      printWindow.document.write(html + '<script>window.onload=function(){window.print();};<\/script>');
      printWindow.document.close();
    } catch (err: any) {
      setError(err.message || 'Could not export PDF.');
    } finally {
      setActionLoading(false);
    }
  };

  const currentDraft = draftProposal || proposal;

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-900">
        <div className="mx-auto max-w-4xl rounded-3xl border border-zinc-200 bg-white p-10 shadow-sm text-center text-sm text-zinc-500">
          Loading proposal...
        </div>
      </div>
    );
  }

  if (error && !proposal) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-900">
        <div className="mx-auto max-w-4xl rounded-3xl border border-rose-200 bg-rose-50 p-10 shadow-sm text-center text-sm text-rose-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-sky-600">Proposal detail</p>
            <h1 className="mt-2 text-3xl font-semibold">{currentDraft?.title || 'Proposal'}</h1>
            <p className="mt-2 text-sm text-zinc-500">Edit the proposal and preview the export-ready page before printing to PDF.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setPreviewMode(false)}
              className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                !previewMode ? 'bg-slate-900 text-white' : 'border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              Edit View
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode(true)}
              className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                previewMode ? 'bg-slate-900 text-white' : 'border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              Preview View
            </button>
          </div>
        </div>

        {error ? <div className="rounded-3xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {success ? <div className="rounded-3xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

        {previewMode ? (
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            {previewLoading ? (
              <div className="py-20 text-center text-sm text-zinc-500">Loading preview...</div>
            ) : (
              <iframe
                title="Proposal preview"
                srcDoc={previewHtml}
                className="h-[80vh] w-full rounded-3xl border border-zinc-200"
              />
            )}
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1.65fr_0.95fr]">
            <div className="space-y-6">
              <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-semibold text-zinc-900">Title</label>
                    <input
                      type="text"
                      value={currentDraft?.title || ''}
                      onChange={(event) => updateDraftField('title', event.target.value)}
                      className="mt-3 w-full rounded-3xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-zinc-900">Executive summary</label>
                    <textarea
                      value={currentDraft?.executive_summary || ''}
                      onChange={(event) => updateDraftField('executive_summary', event.target.value)}
                      rows={4}
                      className="mt-3 w-full rounded-3xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-zinc-900">Problem statement</label>
                    <textarea
                      value={currentDraft?.problem_statement || ''}
                      onChange={(event) => updateDraftField('problem_statement', event.target.value)}
                      rows={4}
                      className="mt-3 w-full rounded-3xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-zinc-900">Proposed approach</label>
                    <div className="space-y-6 mt-4">
                      {currentDraft?.proposed_approach.map((phase, index) => (
                        <div key={index} className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
                          <p className="text-sm font-semibold text-zinc-900">{phase.phase_name}</p>
                          <textarea
                            value={phase.description}
                            onChange={(event) => updatePhase(index, 'description', event.target.value)}
                            rows={4}
                            className="mt-3 w-full rounded-3xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500"
                          />
                          {phase.deliverables?.length ? (
                            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-zinc-700">
                              {phase.deliverables.map((deliverable, idx) => (
                                <li key={idx}>{deliverable}</li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-zinc-900">Timeline</label>
                    <input
                      type="text"
                      value={currentDraft?.timeline || ''}
                      onChange={(event) => updateDraftField('timeline', event.target.value)}
                      className="mt-3 w-full rounded-3xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-semibold text-zinc-900">Pricing table</p>
                  <button
                    type="button"
                    onClick={addPricingRow}
                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Add Line Item
                  </button>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-zinc-200 text-sm">
                    <thead className="bg-zinc-50 text-zinc-700">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Description</th>
                        <th className="px-4 py-3 text-left font-semibold">Qty</th>
                        <th className="px-4 py-3 text-left font-semibold">Unit</th>
                        <th className="px-4 py-3 text-left font-semibold">Total</th>
                        <th className="px-4 py-3 text-left font-semibold"> </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 bg-white">
                      {currentDraft?.pricing_table.map((item, index) => (
                        <tr key={index}>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(event) => updatePricingRow(index, 'description', event.target.value)}
                              className="w-full rounded-2xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm outline-none transition focus:border-sky-500"
                            />
                          </td>
                          <td className="px-4 py-3 w-32">
                            <input
                              type="number"
                              value={item.quantity}
                              min={0}
                              onChange={(event) => updatePricingRow(index, 'quantity', event.target.value)}
                              className="w-full rounded-2xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm outline-none transition focus:border-sky-500"
                            />
                          </td>
                          <td className="px-4 py-3 w-32">
                            <input
                              type="number"
                              value={item.unit_price}
                              min={0}
                              step="0.01"
                              onChange={(event) => updatePricingRow(index, 'unit_price', event.target.value)}
                              className="w-full rounded-2xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm outline-none transition focus:border-sky-500"
                            />
                          </td>
                          <td className="px-4 py-3 text-zinc-700">{formatCurrency(item.total, currentDraft?.currency || 'USD')}</td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => removePricingRow(index)}
                              className="rounded-full bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-200"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-5 flex items-center justify-between rounded-3xl bg-zinc-50 px-4 py-4 text-sm font-semibold text-zinc-900">
                  <span>Total</span>
                  <span>{formatCurrency(currentDraft?.total_price || 0, currentDraft?.currency || 'USD')}</span>
                </div>
              </div>
            </div>

            <aside className="space-y-6">
              <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Status</p>
                    <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[currentDraft?.status || 'Draft'] || 'bg-slate-100 text-slate-700'}`}>
                      {currentDraft?.status}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Version</p>
                    <p className="mt-2 text-lg font-semibold">v{currentDraft?.version}</p>
                  </div>
                </div>
                <div className="mt-6 space-y-3 text-sm text-zinc-700">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Lead</p>
                    <Link href={`/leads/${currentDraft?.lead_id}`} className="mt-2 block font-semibold text-slate-900 hover:text-slate-700">
                      {currentDraft?.company_name || 'Lead'}
                    </Link>
                    <p>{currentDraft?.contact_name || 'No contact name'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Created</p>
                    <p className="mt-2">{new Date(currentDraft?.created_at || '').toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Sent</p>
                    <p className="mt-2">{currentDraft?.sent_at ? new Date(currentDraft.sent_at).toLocaleDateString() : 'Not sent'}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
                <label className="block text-sm font-semibold text-zinc-900">Notes</label>
                <textarea
                  value={currentDraft?.notes || ''}
                  onChange={(event) => handleNotesChange(event.target.value)}
                  rows={6}
                  className="mt-3 w-full rounded-3xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500"
                />
              </div>

              <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm space-y-3">
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={actionLoading}
                  className="w-full rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Export PDF
                </button>
                <button
                  type="button"
                  onClick={handleMarkSent}
                  disabled={actionLoading}
                  className="w-full rounded-2xl border border-amber-500 bg-white px-5 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Mark as Sent
                </button>
                <button
                  type="button"
                  onClick={handleDuplicate}
                  disabled={actionLoading}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={actionLoading}
                  className="w-full rounded-2xl border border-rose-300 bg-white px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
