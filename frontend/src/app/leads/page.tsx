'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createLead, deleteLead, getLeads, importLeads, Lead, LeadCreate, reanalyzeLead, updateLead, getToken } from '@/lib/api';

const fitOrder: Record<string, number> = {
  High: 1,
  Medium: 2,
  Low: 3,
  'Unable to analyze': 4,
};

const statusBadge = (score?: string | null) => {
  if (score === 'High') return 'bg-emerald-100 text-emerald-800';
  if (score === 'Medium') return 'bg-amber-100 text-amber-800';
  if (score === 'Low') return 'bg-rose-100 text-rose-800';
  return 'bg-zinc-100 text-zinc-700';
};

const compareLeads = (a: Lead, b: Lead, field: string, direction: 'asc' | 'desc') => {
  const getValue = (lead: Lead) => {
    if (field === 'company') return lead.company_name || '';
    if (field === 'contact') return lead.contact_name || '';
    if (field === 'role') return lead.contact_role || '';
    if (field === 'fit_score') return String(lead.fit_score ?? 'Unable to analyze');
    if (field === 'status') return lead.status || '';
    return '';
  };

  const left = getValue(a);
  const right = getValue(b);

  if (field === 'fit_score') {
    const leftRank = fitOrder[left] ?? 99;
    const rightRank = fitOrder[right] ?? 99;
    return direction === 'asc' ? leftRank - rightRank : rightRank - leftRank;
  }

  const result = left.localeCompare(right, undefined, { sensitivity: 'base' });
  return direction === 'asc' ? result : -result;
};

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [form, setForm] = useState<LeadCreate>({
    company_name: '',
    company_website: '',
    contact_name: '',
    contact_role: '',
    notes: '',
  });
  const [filter, setFilter] = useState<'All' | 'High' | 'Medium' | 'Low'>('All');
  const [expandedIds, setExpandedIds] = useState<number[]>([]);
  const [sortField, setSortField] = useState('fit_score');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
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

  const openPanelForNew = () => {
    setEditingLead(null);
    setForm({ company_name: '', company_website: '', contact_name: '', contact_role: '', notes: '' });
    setIsPanelOpen(true);
    setMessage('');
    setError('');
  };

  const openPanelForEdit = (lead: Lead) => {
    setEditingLead(lead);
    setForm({
      company_name: lead.company_name,
      company_website: lead.company_website || '',
      contact_name: lead.contact_name || '',
      contact_role: lead.contact_role || '',
      notes: lead.notes || '',
    });
    setIsPanelOpen(true);
    setMessage('');
    setError('');
  };

  const closePanel = () => {
    setIsPanelOpen(false);
    setEditingLead(null);
  };

  const handleFormChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      if (editingLead) {
        await updateLead(editingLead.id, form);
        setMessage('Company updated successfully.');
      } else {
        await createLead(form);
        setMessage('Company added and analyzed.');
      }
      await fetchLeads();
      closePanel();
    } catch (err: any) {
      setError(err.message || 'Could not save the lead.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (lead: Lead) => {
    if (!window.confirm('Are you sure you want to delete this lead?')) {
      return;
    }
    setError('');
    try {
      await deleteLead(lead.id);
      setMessage('Lead deleted successfully.');
      await fetchLeads();
    } catch (err: any) {
      setError(err.message || 'Could not delete lead.');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const response = await importLeads(file);
      setMessage(`${response.imported} companies imported successfully.`);
      await fetchLeads();
    } catch (err: any) {
      setError(err.message || 'Could not import leads.');
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleReanalyze = async (lead: Lead) => {
    setError('');
    setMessage('');
    try {
      await reanalyzeLead(lead.id);
      setMessage('Lead re-analysis complete.');
      await fetchLeads();
    } catch (err: any) {
      setError(err.message || 'Could not re-analyze the lead.');
    }
  };

  const filteredLeads = useMemo(() => {
    const filtered = filter === 'All' ? leads : leads.filter((lead) => lead.fit_score === filter);
    return [...filtered].sort((a, b) => compareLeads(a, b, sortField, sortDirection));
  }, [filter, leads, sortField, sortDirection]);

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSignal = (lead: Lead) => {
    const text = lead.signal_justification || 'No signal available.';
    const isExpanded = expandedIds.includes(lead.id);
    if (text.length <= 80) {
      return text;
    }
    return (
      <>
        {isExpanded ? text : `${text.slice(0, 80)}...`}{' '}
        <button
          type="button"
          onClick={() => {
            setExpandedIds((current) =>
              current.includes(lead.id)
                ? current.filter((id) => id !== lead.id)
                : [...current, lead.id],
            );
          }}
          className="font-semibold text-sky-600 hover:text-sky-700"
        >
          {isExpanded ? 'Show less' : 'Read more'}
        </button>
      </>
    );
  };

  const downloadTemplate = () => {
    const csv =
      'company_name,company_website,contact_name,contact_role,notes\n' +
      'Acme Corp,https://acme.com,Jordan Smith,VP of Operations,Looking for digital transformation support';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'stratforge_leads_template.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-sky-600">Opportunity identification</p>
            <h1 className="mt-2 text-3xl font-semibold">Target Companies</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={openPanelForNew}
              className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              Add Company
            </button>
            <button
              type="button"
              onClick={handleImportClick}
              className="rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
            >
              Import CSV
            </button>
            <button
              type="button"
              onClick={downloadTemplate}
              className="rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
            >
              Download Template
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          {(['All', 'High', 'Medium', 'Low'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setFilter(option)}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                filter === option
                  ? 'bg-sky-600 text-white'
                  : 'border border-zinc-200 bg-white text-zinc-700 hover:border-slate-300 hover:bg-zinc-50'
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        {message ? <div className="rounded-3xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
        {error ? <div className="rounded-3xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-sm text-zinc-500">Loading leads...</div>
          ) : filteredLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-sm text-zinc-500">
              <p>No leads found yet.</p>
              <p className="mt-2">Add a company or import a CSV to start building your pipeline.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
                <thead className="bg-zinc-50 text-zinc-700">
                  <tr>
                    {[
                      { label: 'Company', key: 'company' },
                      { label: 'Contact', key: 'contact' },
                      { label: 'Role', key: 'role' },
                      { label: 'Fit Score', key: 'fit_score' },
                      { label: 'Signal', key: 'signal' },
                      { label: 'Status', key: 'status' },
                      { label: 'Actions', key: 'actions' },
                    ].map((column) => (
                      <th
                        key={column.key}
                        scope="col"
                        className="whitespace-nowrap px-4 py-3 font-semibold"
                      >
                        {column.key !== 'actions' ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(column.key)}
                            className="inline-flex items-center gap-1"
                          >
                            {column.label}
                            {sortField === column.key ? (
                              <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>
                            ) : null}
                          </button>
                        ) : (
                          column.label
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white">
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-col gap-2">
                          <span className="whitespace-nowrap font-medium text-zinc-900">{lead.company_name}</span>
                          <button
                            type="button"
                            onClick={() => router.push(`/outreach?lead_id=${lead.id}`)}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                          >
                            {lead.outreach_count ?? 0}/5 outreach
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-zinc-700">{lead.contact_name || '—'}</td>
                      <td className="px-4 py-4 text-zinc-700">{lead.contact_role || '—'}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadge(lead.fit_score)}`}>
                          {lead.fit_score || 'Unable to analyze'}
                        </span>
                        {lead.fit_score === 'Unable to analyze' ? (
                          <button
                            type="button"
                            onClick={() => handleReanalyze(lead)}
                            className="ml-3 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                          >
                            Retry
                          </button>
                        ) : null}
                      </td>
                      <td className="max-w-xl px-4 py-4 text-zinc-700">{renderSignal(lead)}</td>
                      <td className="px-4 py-4 text-zinc-700">{lead.status}</td>
                      <td className="px-4 py-4 text-sm font-medium">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => router.push(`/leads/${lead.id}`)}
                            className="rounded-2xl bg-slate-900 px-3 py-2 text-white transition hover:bg-slate-800"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => openPanelForEdit(lead)}
                            className="rounded-2xl border border-zinc-300 bg-white px-3 py-2 text-zinc-700 transition hover:bg-zinc-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(lead)}
                            className="rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2 text-rose-700 transition hover:bg-rose-100"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {isPanelOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center sm:p-6">
          <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold">{editingLead ? 'Edit target company' : 'Add target company'}</h2>
                <p className="mt-1 text-sm text-zinc-500">Save a lead and analyze fit immediately.</p>
              </div>
              <button
                type="button"
                onClick={closePanel}
                className="rounded-full bg-zinc-100 px-3 py-2 text-zinc-600 transition hover:bg-zinc-200"
              >
                Close
              </button>
            </div>
            <form className="space-y-6 p-6" onSubmit={handleSave}>
              <div className="grid gap-6 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-zinc-900">Company Name</span>
                  <input
                    name="company_name"
                    value={form.company_name}
                    onChange={handleFormChange}
                    required
                    className="mt-2 w-full rounded-3xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-zinc-900">Company Website</span>
                  <input
                    name="company_website"
                    value={form.company_website || ''}
                    onChange={handleFormChange}
                    className="mt-2 w-full rounded-3xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500"
                  />
                </label>
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-zinc-900">Contact Name</span>
                  <input
                    name="contact_name"
                    value={form.contact_name || ''}
                    onChange={handleFormChange}
                    className="mt-2 w-full rounded-3xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-zinc-900">Contact Role</span>
                  <input
                    name="contact_role"
                    value={form.contact_role || ''}
                    onChange={handleFormChange}
                    className="mt-2 w-full rounded-3xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-sm font-semibold text-zinc-900">Notes</span>
                <textarea
                  name="notes"
                  value={form.notes || ''}
                  onChange={handleFormChange}
                  rows={5}
                  className="mt-2 w-full rounded-3xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500"
                />
              </label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-zinc-500">After saving, StratForge will analyze fit and populate signals.</p>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-2xl bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
                >
                  {saving ? 'Analyzing fit...' : 'Save & Analyze'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleImport}
        className="hidden"
      />
    </div>
  );
}
