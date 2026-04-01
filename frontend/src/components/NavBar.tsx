'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getBillingSubscription, getToken } from '@/lib/api';

function NavTooltipLink({ href, label, tooltip, className }: { href: string; label: string; tooltip: string; className: string }) {
  return (
    <div className="group relative">
      <Link href={href} className={className}>
        {label}
      </Link>
      <span className="pointer-events-none absolute left-1/2 top-full z-40 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100">
        {tooltip}
      </span>
    </div>
  );
}

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
        <NavTooltipLink
          href="/pipeline"
          label="Pipeline"
          tooltip="Track every lead through your consulting sales stages."
          className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
        />
        <NavTooltipLink
          href="/settings/billing"
          label="Settings"
          tooltip="Manage your account, plan, and product preferences."
          className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
        />
        <NavTooltipLink
          href="/profile"
          label="Profile"
          tooltip="Edit your consultant positioning and ideal client profile."
          className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
        />
        <NavTooltipLink
          href="/leads"
          label="Leads"
          tooltip="Create, enrich, and organize your target companies."
          className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
        />
        <NavTooltipLink
          href="/outreach"
          label="Outreach"
          tooltip="Generate and manage personalized outreach messages."
          className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
        />
      </div>
      {subscriptionTier ? (
        <Link href={settingsUrl} className={`rounded-full px-4 py-2 text-sm font-semibold ${badgeClass(subscriptionTier)}`}>
          {planLabel}
        </Link>
      ) : null}
    </header>
  );
}
