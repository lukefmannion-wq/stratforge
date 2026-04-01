'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import {
  addPipelineNote,
  getPipeline,
  getPipelineActivity,
  getPipelineMetrics,
  PipelineEvent,
  PipelineLead,
  PipelineMetrics,
  updatePipelineDeal,
  updatePipelineStage,
  getToken,
} from '@/lib/api';
import { Skeleton } from '@/components/Skeleton';

const MIN_SKELETON_DELAY_MS = 250;

const stageOrder = [
  'Identified',
  'Outreach Sent',
  'Replied',
  'Call Scheduled',
  'Proposal Sent',
  'Closed Won',
  'Closed Lost',
];

const stageColors: Record<string, string> = {
  'Identified': 'bg-slate-100 text-slate-700',
  'Outreach Sent': 'bg-sky-100 text-sky-700',
  'Replied': 'bg-emerald-100 text-emerald-800',
  'Call Scheduled': 'bg-amber-100 text-amber-800',
  'Proposal Sent': 'bg-violet-100 text-violet-800',
  'Closed Won': 'bg-emerald-200 text-emerald-900',
  'Closed Lost': 'bg-rose-100 text-rose-800',
};

const metricCards = [
  { key: 'total_leads', label: 'Total Leads' },
  { key: 'lead_to_call_rate', label: 'Lead-to-Call Rate' },
  { key: 'call_to_close_rate', label: 'Call-to-Close Rate' },
  { key: 'total_pipeline_value', label: 'Total Pipeline Value' },
  { key: 'closed_won_value', label: 'Closed Won Value' },
  { key: 'outreach_response_rate', label: 'Outreach Response Rate' },
] as const;

const formatCurrency = (value?: number | null) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value || 0);

const formatPercent = (value?: number) => `${value?.toFixed(1) ?? 0}%`;

const stageLabels = stageOrder;

function LeadCard({
  lead,
  onSelect,
}: {
  lead: PipelineLead;
  onSelect: (lead: PipelineLead) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: String(lead.id),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(lead)}
      className="group w-full rounded-3xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:border-sky-300 hover:shadow-md"
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{lead.company_name}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {lead.contact_name || 'No contact'}{lead.contact_role ? ` · ${lead.contact_role}` : ''}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${stageColors[lead.pipeline_stage || 'Identified']}`}>
          {lead.pipeline_stage || 'Identified'}
        </span>
      </div>
      <div className="mt-4 grid gap-2 text-xs text-zinc-600">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">Fit {lead.fit_score || 'Unknown'}</span>
          {lead.deal_value != null ? (
            <span className="rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-800">
              {formatCurrency(lead.deal_value)}
            </span>
          ) : null}
        </div>
        {lead.expected_close_date ? (
          <div className="text-zinc-500">Close by {lead.expected_close_date}</div>
        ) : null}
        <div className="flex flex-wrap gap-2 text-zinc-500">
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2 py-1">
            <span className="font-semibold text-slate-700">{lead.outreach_count ?? 0}</span> outreach
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2 py-1">
            <span className="font-semibold text-slate-700">{lead.proposal_count ?? 0}</span> proposals
          </span>
        </div>
      </div>
    </button>
  );
}

function StageColumn({
  stage,
  leads,
  children,
}: {
  stage: string;
  leads: PipelineLead[];
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className={`min-w-[280px] rounded-3xl border p-4 shadow-sm transition ${
        isOver ? 'border-sky-400 bg-slate-50' : 'border-zinc-200 bg-white'
      }`}
    >
      <div className="mb-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">{stage}</p>
          <span className="text-xs text-zinc-500">{leads.length}</span>
        </div>
        <p className="mt-2 text-sm text-zinc-500">
          {formatCurrency(leads.reduce((sum, lead) => sum + (lead.deal_value ?? 0), 0))}
        </p>
      </div>
      <SortableContext items={leads.map((lead) => String(lead.id))} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">{children}</div>
      </SortableContext>
    </div>
  );
}

export default function PipelinePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [pipelineGroups, setPipelineGroups] = useState<Record<string, PipelineLead[]>>(
    Object.fromEntries(stageOrder.map((stage) => [stage, []])) as Record<string, PipelineLead[]>,
  );
  const [metrics, setMetrics] = useState<PipelineMetrics | null>(null);
  const [activity, setActivity] = useState<PipelineEvent[]>([]);
  const [selectedLead, setSelectedLead] = useState<PipelineLead | null>(null);
  const [noteText, setNoteText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [fitFilter, setFitFilter] = useState<'All' | 'High' | 'Medium' | 'Low'>('All');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    loadDashboard();
  }, [router]);

  useEffect(() => {
    if (selectedLead) {
      fetchActivity(selectedLead.id);
    }
  }, [selectedLead]);

  const loadDashboard = async () => {
    const startedAt = Date.now();
    setLoading(true);
    setError('');
    try {
      const [pipelineData, metricsData] = await Promise.all([getPipeline(), getPipelineMetrics()]);
      setPipelineGroups(Object.fromEntries(stageOrder.map((stage) => [stage, pipelineData[stage] ?? []])));
      setMetrics(metricsData);
    } catch (err: any) {
      setError(err.message || 'Could not load pipeline.');
    } finally {
      const remainingDelay = MIN_SKELETON_DELAY_MS - (Date.now() - startedAt);
      if (remainingDelay > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, remainingDelay));
      }
      setLoading(false);
    }
  };

  const fetchMetrics = async () => {
    try {
      const data = await getPipelineMetrics();
      setMetrics(data);
    } catch (err: any) {
      setError(err.message || 'Could not load metrics.');
    }
  };

  const fetchActivity = async (leadId: number) => {
    try {
      const data = await getPipelineActivity(leadId);
      setActivity(data);
    } catch (err: any) {
      setError(err.message || 'Could not load activity.');
    }
  };

  const filteredGroups = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return Object.fromEntries(
      stageOrder.map((stage) => [
        stage,
        (pipelineGroups[stage] ?? []).filter((lead) => {
          const matchesSearch =
            normalizedSearch === '' ||
            `${lead.company_name} ${lead.contact_name ?? ''}`.toLowerCase().includes(normalizedSearch);
          const matchesFit = fitFilter === 'All' || lead.fit_score === fitFilter;
          return matchesSearch && matchesFit;
        }),
      ]),
    ) as Record<string, PipelineLead[]>;
  }, [fitFilter, pipelineGroups, searchTerm]);

  const findLeadById = (id: string) =>
    Object.values(pipelineGroups)
      .flat()
      .find((lead) => String(lead.id) === id);

  const moveLeadLocally = (lead: PipelineLead, destinationStage: string) => {
    setPipelineGroups((current) => {
      const sourceStage = lead.pipeline_stage || 'Identified';
      const leadWithoutSource = current[sourceStage]?.filter((item) => item.id !== lead.id) ?? [];
      return {
        ...current,
        [sourceStage]: leadWithoutSource,
        [destinationStage]: [{ ...lead, pipeline_stage: destinationStage }, ...(current[destinationStage] ?? [])],
      };
    });
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over) {
      return;
    }
    const activeId = String(active.id);
    const overId = String(over.id);
    const activeLead = findLeadById(activeId);
    if (!activeLead) {
      return;
    }

    const destinationStage = stageOrder.includes(overId)
      ? overId
      : stageOrder.find((stage) => (filteredGroups[stage] ?? []).some((item) => String(item.id) === overId));

    if (!destinationStage || destinationStage === activeLead.pipeline_stage) {
      return;
    }

    const originalStage = activeLead.pipeline_stage || 'Identified';
    moveLeadLocally(activeLead, destinationStage);

    try {
      await updatePipelineStage(activeLead.id, destinationStage);
      setMessage(`Moved ${activeLead.company_name} to ${destinationStage}.`);
      fetchMetrics();
    } catch (err: any) {
      setError(err.message || 'Could not update stage.');
      moveLeadLocally({ ...activeLead, pipeline_stage: destinationStage }, originalStage);
    }
  };

  const handleSelectLead = (lead: PipelineLead) => {
    setSelectedLead(lead);
    setMessage('');
    setError('');
  };

  const handleDealBlur = async (field: 'deal_value' | 'expected_close_date', value: string | number | null) => {
    if (!selectedLead) {
      return;
    }
    const payload = {
      deal_value: field === 'deal_value' ? (value ? Number(value) : null) : selectedLead.deal_value ?? null,
      expected_close_date: field === 'expected_close_date' ? (value ? String(value) : null) : selectedLead.expected_close_date ?? null,
    };
    try {
      const updated = await updatePipelineDeal(selectedLead.id, payload);
      setSelectedLead(updated);
      setPipelineGroups((current) => ({
        ...current,
        [updated.pipeline_stage]: current[updated.pipeline_stage].map((lead) =>
          lead.id === updated.id ? { ...lead, deal_value: updated.deal_value, expected_close_date: updated.expected_close_date } : lead,
        ),
      }));
      setMessage('Deal details updated.');
      fetchMetrics();
    } catch (err: any) {
      setError(err.message || 'Could not save deal details.');
    }
  };

  const handleAddNote = async () => {
    if (!selectedLead || !noteText.trim()) {
      return;
    }
    try {
      const event = await addPipelineNote(selectedLead.id, noteText.trim());
      setActivity((current) => [event, ...current]);
      setNoteText('');
      setMessage('Note added.');
    } catch (err: any) {
      setError(err.message || 'Could not add note.');
    }
  };

  const draggingLead = activeId ? findLeadById(activeId) : null;
  const totalLeads = useMemo(
    () => Object.values(pipelineGroups).reduce((sum, leads) => sum + leads.length, 0),
    [pipelineGroups],
  );

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-sky-600">Pipeline command center</p>
              <h1 className="mt-2 text-3xl font-semibold">Pipeline Dashboard</h1>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/pipeline/metrics" className="rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50">
                View full metrics
              </Link>
              <Link href="/leads" className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700">
                Manage leads
              </Link>
            </div>
          </div>

          {message ? <div className="mt-6 rounded-3xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
          {error ? <div className="mt-6 rounded-3xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

          <div className="mt-6 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {metricCards.map((card) => (
              <div key={card.key} className="rounded-3xl border border-zinc-200 bg-slate-50 p-5 shadow-sm">
                <p className="text-sm text-zinc-500">{card.label}</p>
                <p className="mt-4 text-3xl font-semibold text-slate-900">
                  {loading ? (
                    <Skeleton className="h-10 w-28" />
                  ) : metrics ? (
                    card.key === 'total_pipeline_value' || card.key === 'closed_won_value'
                      ? formatCurrency(metrics[card.key])
                      : card.key === 'lead_to_call_rate' || card.key === 'call_to_close_rate' || card.key === 'outreach_response_rate'
                      ? formatPercent(metrics[card.key])
                      : metrics[card.key]
                  ) : '—'}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-full max-w-md">
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search by company or contact"
                    className="w-full rounded-3xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500"
                  />
                </div>
                <select
                  value={fitFilter}
                  onChange={(event) => setFitFilter(event.target.value as 'All' | 'High' | 'Medium' | 'Low')}
                  className="rounded-3xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none transition focus:border-sky-500"
                >
                  <option value="All">All fit scores</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="mt-6 overflow-x-auto">
              <div className="flex min-w-[1400px] gap-4">
                {stageOrder.map((stage) => (
                  <div key={stage} className="min-w-[280px] rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
                    <div className="mb-4 space-y-2">
                      <Skeleton className="h-5 w-28" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
                          <Skeleton className="h-5 w-32" />
                          <Skeleton className="mt-3 h-4 w-24" />
                          <Skeleton className="mt-4 h-20 w-full" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : totalLeads === 0 ? (
            <div className="mt-6 flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-16 text-center">
              <svg width="180" height="120" viewBox="0 0 180 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect x="20" y="18" width="140" height="20" rx="10" fill="#dbeafe" stroke="#93c5fd" />
                <polygon points="45,38 135,38 105,78 75,78" fill="#bfdbfe" stroke="#60a5fa" />
                <rect x="82" y="78" width="16" height="24" rx="8" fill="#93c5fd" stroke="#3b82f6" />
              </svg>
              <h2 className="mt-6 text-2xl font-semibold text-zinc-900">Your pipeline is empty</h2>
              <p className="mt-2 text-zinc-600">Start by adding your first target company</p>
              <Link href="/leads" className="mt-6 rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-700">
                Add your first lead
              </Link>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <div className="flex min-w-[1400px] gap-4">
                  {stageOrder.map((stage) => (
                    <StageColumn key={stage} stage={stage} leads={filteredGroups[stage] ?? []}>
                      {(filteredGroups[stage] ?? []).map((lead) => (
                        <LeadCard key={lead.id} lead={lead} onSelect={handleSelectLead} />
                      ))}
                    </StageColumn>
                  ))}
                </div>
              </DndContext>
            </div>
          )}
        </div>
      </div>

      {selectedLead ? (
        <div className="fixed right-0 top-0 z-50 h-full w-full max-w-xl overflow-y-auto border-l border-zinc-200 bg-white p-6 shadow-2xl md:w-[440px]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-zinc-500">Lead details</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">{selectedLead.company_name}</h2>
              <p className="mt-1 text-sm text-zinc-500">{selectedLead.contact_name || 'No contact'}{selectedLead.contact_role ? ` · ${selectedLead.contact_role}` : ''}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedLead(null)}
              className="rounded-full bg-zinc-100 px-3 py-2 text-zinc-600 transition hover:bg-zinc-200"
            >
              Close
            </button>
          </div>

          <div className="mt-6 space-y-6">
            <div className="rounded-3xl border border-zinc-200 bg-slate-50 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-zinc-900">Deal value</span>
                  <input
                    type="number"
                    value={selectedLead.deal_value ?? ''}
                    onChange={(event) => {
                      const nextValue = event.target.value !== '' ? Number(event.target.value) : null;
                      setSelectedLead((current) => current ? { ...current, deal_value: nextValue } : current);
                    }}
                    onBlur={(event) => handleDealBlur('deal_value', event.target.value ? Number(event.target.value) : null)}
                    className="mt-2 w-full rounded-3xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-zinc-900">Expected close date</span>
                  <input
                    type="date"
                    value={selectedLead.expected_close_date ?? ''}
                    onChange={(event) => setSelectedLead((current) => current ? { ...current, expected_close_date: event.target.value } : current)}
                    onBlur={(event) => handleDealBlur('expected_close_date', event.target.value || null)}
                    className="mt-2 w-full rounded-3xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500"
                  />
                </label>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-zinc-600">
                <div>
                  <span className="font-semibold text-slate-900">Fit score:</span> {selectedLead.fit_score || 'Unknown'}
                </div>
                <div>
                  <span className="font-semibold text-slate-900">Current stage:</span> {selectedLead.pipeline_stage || 'Identified'}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-200 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Activity log</p>
                  <p className="mt-1 text-sm text-zinc-500">Recent pipeline actions for this lead.</p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/leads/${selectedLead.id}`} className="rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50">
                    View Lead
                  </Link>
                  <Link href={`/outreach?lead_id=${selectedLead.id}`} className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700">
                    Generate Outreach
                  </Link>
                  <Link href={`/proposals?lead_id=${selectedLead.id}`} className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                    View Proposals
                  </Link>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {activity.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-500">
                    No activity yet for this lead.
                  </div>
                ) : (
                  activity.map((event) => (
                    <div key={event.id} className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3 text-sm text-zinc-600">
                        <span>{event.event_type.replace('_', ' ')}</span>
                        <span>{new Date(event.created_at).toLocaleString()}</span>
                      </div>
                      {event.note ? <p className="mt-2 text-sm text-zinc-700">{event.note}</p> : null}
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                        {event.from_stage ? <span className="rounded-full bg-slate-100 px-2 py-1">from {event.from_stage}</span> : null}
                        {event.to_stage ? <span className="rounded-full bg-slate-100 px-2 py-1">to {event.to_stage}</span> : null}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-6 space-y-3">
                <label className="block text-sm font-semibold text-zinc-900">Add a note</label>
                <textarea
                  value={noteText}
                  onChange={(event) => setNoteText(event.target.value)}
                  rows={4}
                  className="w-full rounded-3xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500"
                />
                <button
                  type="button"
                  onClick={handleAddNote}
                  className="rounded-3xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
                >
                  Add Note
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
