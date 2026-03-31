'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  createPortalSession,
  createCheckoutSession,
  getBillingSubscription,
  getLeads,
  getOutreachMessages,
  getProposals,
  getToken,
} from '@/lib/api';

const limitLabels: Record<string, string> = {
  leads: 'Leads used',
  outreach: 'Outreach sent',
  proposals: 'Proposals created',
};

const limitsByTier: Record<string, { leads: number; outreach: number; proposals: number }> = {
  free: { leads: 5, outreach: 10, proposals: 2 },
  solo: { leads: 25, outreach: 50, proposals: 10 },
  growth: { leads: 100, outreach: 200, proposals: 50 },
  agency: { leads: 999999, outreach: 999999, proposals: 999999 },
};

const formatDate = (value?: string | null) => {
  if (!value) return 'No active period';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

const progressColor = (percentage: number) => {
  if (percentage >= 90) return 'bg-rose-500';
  if (percentage >= 70) return 'bg-amber-500';
  return 'bg-emerald-500';
};

export default function BillingSettingsPage() {
  const router = useRouter();
  const [subscription, setSubscription] = useState<any>(null);
  const [leadCount, setLeadCount] = useState(0);
  const [outreachCount, setOutreachCount] = useState(0);
  const [proposalCount, setProposalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    fetchBillingData();
  }, [router]);

  const fetchBillingData = async () => {
    setLoading(true);
    setError('');
    try {
      const [sub, leads, outreach, proposals] = await Promise.all([
        getBillingSubscription(),
        getLeads(),
        getOutreachMessages(),
        getProposals(),
      ]);
      setSubscription(sub);
      setLeadCount(leads.length);
      const now = new Date();
      setOutreachCount(
        outreach.filter((message) => {
          const date = new Date(message.generated_at);
          return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
        }).length,
      );
      setProposalCount(proposals.length);
    } catch (err: any) {
      setError(err.message || 'Could not load billing data.');
    } finally {
      setLoading(false);
    }
  };

  const planLimits = subscription ? limitsByTier[subscription.subscription_tier] || limitsByTier.free : limitsByTier.free;

  const usageItems = useMemo(
    () => [
      { key: 'leads', used: leadCount, limit: planLimits.leads },
      { key: 'outreach', used: outreachCount, limit: planLimits.outreach },
      { key: 'proposals', used: proposalCount, limit: planLimits.proposals },
    ],
    [leadCount, outreachCount, proposalCount, planLimits],
  );

  const handleManage = async () => {
    setPortalLoading(true);
    setError('');
    try {
      const response = await createPortalSession();
      window.location.href = response.url;
    } catch (err: any) {
      setError(err.message || 'Could not open billing portal.');
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-sky-600">Billing settings</p>
              <h1 className="mt-3 text-3xl font-semibold">Subscription and usage</h1>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/pricing" className="rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50">
                Upgrade Plan
              </Link>
              <button
                type="button"
                onClick={handleManage}
                disabled={portalLoading}
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {portalLoading ? 'Opening portal...' : 'Manage Subscription'}
              </button>
            </div>
          </div>

          {loading ? (
            <p className="mt-6 text-sm text-zinc-500">Loading billing information...</p>
          ) : error ? (
            <p className="mt-6 rounded-3xl bg-rose-50 px-5 py-4 text-sm text-rose-700">{error}</p>
          ) : null}

          {subscription ? (
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <div className="rounded-3xl border border-zinc-200 bg-slate-50 p-6">
                <p className="text-sm text-zinc-500">Current plan</p>
                <div className="mt-4 flex items-center gap-3">
                  <span className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold uppercase tracking-[0.25em] text-white">
                    {subscription.subscription_tier}
                  </span>
                  <span className="rounded-full bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-800">
                    {subscription.subscription_status}
                  </span>
                </div>
                <p className="mt-4 text-sm text-zinc-600">Current period ends {formatDate(subscription.subscription_current_period_end)}</p>
              </div>
              <div className="rounded-3xl border border-zinc-200 bg-slate-50 p-6">
                <p className="text-sm text-zinc-500">Plan summary</p>
                <div className="mt-4 grid gap-3 text-sm text-zinc-700">
                  <div className="rounded-3xl bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Plan tier</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{subscription.subscription_tier}</p>
                  </div>
                  <div className="rounded-3xl bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Free plan</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {subscription.is_free_plan ? 'Yes' : 'No'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {subscription && subscription.subscription_tier === 'free' ? (
            <div className="mt-8 rounded-3xl border border-sky-200 bg-sky-50 p-6 text-slate-900">
              <p className="text-sm font-semibold">You are on the free plan.</p>
              <p className="mt-2 text-sm text-slate-700">Upgrade to Solo or Growth for more leads, outreach, and proposal capacity.</p>
              <Link href="/pricing" className="mt-4 inline-flex rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                Upgrade now
              </Link>
            </div>
          ) : null}
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Usage summary</h2>
          <div className="mt-6 space-y-5">
            {usageItems.map((item) => {
              const percentage = item.limit > 0 ? Math.min((item.used / item.limit) * 100, 100) : 0;
              return (
                <div key={item.key} className="space-y-3">
                  <div className="flex items-center justify-between text-sm text-zinc-700">
                    <span>{limitLabels[item.key]}</span>
                    <span>
                      {item.used} / {item.limit}
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-zinc-100">
                    <div className={`h-full ${progressColor(percentage)}`} style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
