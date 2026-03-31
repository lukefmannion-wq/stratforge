'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getBillingSubscription, getToken } from '@/lib/api';

const badgeClass = (tier: string) => {
  switch (tier) {
    case 'solo':
      return 'bg-sky-100 text-sky-800';
    case 'growth':
      return 'bg-emerald-100 text-emerald-800';
    case 'agency':
      return 'bg-violet-100 text-violet-800';
    default:
      return 'bg-zinc-100 text-zinc-700';
  }
};

export default function NavBar() {
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null);
  const [planLabel, setPlanLabel] = useState<string | null>(null);
  const [settingsUrl, setSettingsUrl] = useState('/settings/billing');

  useEffect(() => {
    if (!getToken()) {
      return;
    }

    const fetchSubscription = async () => {
      try {
        const data = await getBillingSubscription();
        setSubscriptionTier(data.subscription_tier);
        setPlanLabel(data.subscription_tier ? data.subscription_tier.toUpperCase() : null);
      } catch {
        setSubscriptionTier(null);
      }
    };

    fetchSubscription();
  }, []);

  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/pipeline" className="text-lg font-semibold text-slate-900">
          StratForge Growth
        </Link>
        <Link href="/pipeline" className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50">
          Pipeline
        </Link>
        <Link href="/settings/billing" className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50">
          Settings
        </Link>
        <Link href="/profile" className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50">
          Profile
        </Link>
        <Link href="/leads" className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50">
          Leads
        </Link>
        <Link href="/outreach" className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700">
          Outreach
        </Link>
      </div>
      {subscriptionTier ? (
        <Link href={settingsUrl} className={`rounded-full px-4 py-2 text-sm font-semibold ${badgeClass(subscriptionTier)}`}>
          {planLabel}
        </Link>
      ) : null}
    </header>
  );
}
