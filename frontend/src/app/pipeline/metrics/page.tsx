'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getPipeline,
  getPipelineMetrics,
  getRecentPipelineActivity,
  getToken,
  PipelineEvent,
  PipelineLead,
  PipelineMetrics,
} from '@/lib/api';

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

const formatCurrency = (value?: number | null) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value || 0);

const formatPercent = (value?: number) => `${value?.toFixed(1) ?? 0}%`;

export default function PipelineMetricsPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<PipelineMetrics | null>(null);
  const [pipeline, setPipeline] = useState<Record<string, PipelineLead[]>>(
    Object.fromEntries(stageOrder.map((stage) => [stage, []])) as Record<string, PipelineLead[]>,
  );
  const [activity, setActivity] = useState<PipelineEvent[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    fetchMetrics();
    fetchPipeline();
    fetchActivity();
  }, [router]);

  const fetchMetrics = async () => {
    try {
      const data = await getPipelineMetrics();
      setMetrics(data);
    } catch (err: any) {
      setError(err.message || 'Could not load metrics.');
    }
  };

  const fetchPipeline = async () => {
    try {
      const data = await getPipeline();
      setPipeline(Object.fromEntries(stageOrder.map((stage) => [stage, data[stage] ?? []])));
    } catch (err: any) {
      setError(err.message || 'Could not load pipeline.');
    }
  };

  const fetchActivity = async () => {
    try {
      const data = await getRecentPipelineActivity();
      setActivity(data);
    } catch (err: any) {
      setError(err.message || 'Could not load recent activity.');
    }
  };

  const funnelData = useMemo(() => {
    const total = stageOrder.reduce((sum, stage) => sum + (pipeline[stage]?.length || 0), 0) || 1;
    return stageOrder.map((stage) => {
      const count = pipeline[stage]?.length || 0;
      return {
        stage,
        count,
        percentage: (count / total) * 100,
      };
    });
  }, [pipeline]);

  const revenueForecast = useMemo(() => {
    const high = Object.values(pipeline)
      .flat()
      .filter((lead) => lead.fit_score === 'High' && lead.pipeline_stage !== 'Closed Won' && lead.pipeline_stage !== 'Closed Lost')
      .reduce((sum, lead) => sum + (lead.deal_value ?? 0), 0);
    const medium = Object.values(pipeline)
      .flat()
      .filter((lead) => lead.fit_score === 'Medium' && lead.pipeline_stage !== 'Closed Won' && lead.pipeline_stage !== 'Closed Lost')
      .reduce((sum, lead) => sum + (lead.deal_value ?? 0), 0);
    return {
      high,
      medium,
    };
  }, [pipeline]);

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-sky-600">Pipeline intelligence</p>
              <h1 className="mt-2 text-3xl font-semibold">Pipeline Metrics</h1>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/pipeline" className="rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50">
                Return to board
              </Link>
            </div>
          </div>
          {error ? <div className="mt-6 rounded-3xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-zinc-500">Total Leads</p>
            <p className="mt-4 text-4xl font-semibold text-slate-900">{metrics ? metrics.total_leads : '—'}</p>
          </div>
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-zinc-500">Lead-to-Call Rate</p>
            <p className="mt-4 text-4xl font-semibold text-slate-900">{metrics ? formatPercent(metrics.lead_to_call_rate) : '—'}</p>
          </div>
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-zinc-500">Call-to-Close Rate</p>
            <p className="mt-4 text-4xl font-semibold text-slate-900">{metrics ? formatPercent(metrics.call_to_close_rate) : '—'}</p>
          </div>
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-zinc-500">Total Pipeline Value</p>
            <p className="mt-4 text-4xl font-semibold text-slate-900">{metrics ? formatCurrency(metrics.total_pipeline_value) : '—'}</p>
          </div>
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-zinc-500">Closed Won Value</p>
            <p className="mt-4 text-4xl font-semibold text-slate-900">{metrics ? formatCurrency(metrics.closed_won_value) : '—'}</p>
          </div>
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-zinc-500">Outreach Response Rate</p>
            <p className="mt-4 text-4xl font-semibold text-slate-900">{metrics ? formatPercent(metrics.outreach_response_rate) : '—'}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Funnel overview</p>
              <p className="mt-1 text-sm text-zinc-500">Lead counts by stage with relative percentages.</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {funnelData.map((item) => (
              <div key={item.stage} className="space-y-2">
                <div className="flex items-center justify-between text-sm text-zinc-700">
                  <span>{item.stage}</span>
                  <span>{item.count} leads • {formatPercent(item.percentage)}</span>
                </div>
                <div className="h-6 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className={`h-full rounded-full ${stageColors[item.stage]}`}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Revenue forecast</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-zinc-200 bg-slate-50 p-5">
              <p className="text-sm text-zinc-500">Confirmed (Closed Won)</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{metrics ? formatCurrency(metrics.closed_won_value) : '—'}</p>
            </div>
            <div className="rounded-3xl border border-zinc-200 bg-slate-50 p-5">
              <p className="text-sm text-zinc-500">Likely (High fit pipeline)</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(revenueForecast.high)}</p>
            </div>
            <div className="rounded-3xl border border-zinc-200 bg-slate-50 p-5">
              <p className="text-sm text-zinc-500">Possible (Medium fit pipeline)</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(revenueForecast.medium)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Recent activity</p>
          <div className="mt-6 space-y-3">
            {activity.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-500">
                No recent activity available.
              </div>
            ) : (
              activity.map((event) => (
                <div key={event.id} className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{event.company_name || 'Lead update'}</p>
                      <p className="text-sm text-zinc-500">{event.event_type.replace('_', ' ')}</p>
                    </div>
                    <p className="text-sm text-zinc-500">{new Date(event.created_at).toLocaleString()}</p>
                  </div>
                  {event.note ? <p className="mt-3 text-sm text-zinc-700">{event.note}</p> : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
