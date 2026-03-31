'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createCheckoutSession, getToken } from '@/lib/api';

const plans = [
  {
    tier: 'solo',
    name: 'Solo',
    price: '$59/month',
    features: [
      'Up to 25 leads',
      '50 outreach messages/month',
      '10 proposals',
      'CSV import',
      'Full sequence generation',
    ],
    popular: false,
  },
  {
    tier: 'growth',
    name: 'Growth',
    price: '$149/month',
    features: [
      'Up to 100 leads',
      '200 outreach messages/month',
      '50 proposals',
      'CSV import',
      'Full sequence generation',
    ],
    popular: true,
  },
  {
    tier: 'agency',
    name: 'Agency',
    price: '$299/month',
    features: [
      'Unlimited leads',
      'Unlimited outreach',
      'Unlimited proposals',
      'CSV import',
      'Full sequence generation',
    ],
    popular: false,
  },
];

export default function PricingPage() {
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [error, setError] = useState('');
  const isLoggedIn = typeof window !== 'undefined' && !!getToken();

  const handleGetStarted = async (tier: string) => {
    if (!isLoggedIn) {
      return;
    }

    setError('');
    setLoadingTier(tier);

    try {
      const session = await createCheckoutSession({
        tier,
        success_url: `${window.location.origin}/pipeline`,
        cancel_url: `${window.location.origin}/pricing`,
      });
      window.location.href = session.url;
    } catch (err: any) {
      setError(err.message || 'Could not start checkout session.');
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-900">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <p className="text-sm uppercase tracking-[0.35em] text-sky-600">Flexible subscriptions</p>
          <h1 className="mt-4 text-4xl font-semibold">Choose the plan that grows with you.</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-600">
            Start with Solo for focused consulting, scale into Growth for an expanded pipeline, or move to Agency for enterprise support and unlimited capacity.
          </p>
        </div>

        {error ? (
          <div className="rounded-3xl bg-rose-50 px-6 py-4 text-sm text-rose-700">{error}</div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.tier}
              className={`rounded-3xl border p-8 shadow-sm transition ${
                plan.popular ? 'border-sky-500 bg-sky-50 shadow-lg' : 'border-zinc-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-900">{plan.name}</p>
                  <p className="mt-4 text-4xl font-semibold text-slate-900">{plan.price}</p>
                </div>
                {plan.popular ? (
                  <span className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-white">
                    Most Popular
                  </span>
                ) : null}
              </div>
              <div className="mt-8 space-y-3 text-sm text-zinc-600">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3">
                    <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">✓</span>
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
              <div className="mt-8">
                {isLoggedIn ? (
                  <button
                    type="button"
                    onClick={() => handleGetStarted(plan.tier)}
                    disabled={loadingTier === plan.tier}
                    className="w-full rounded-3xl bg-slate-900 px-5 py-4 text-base font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loadingTier === plan.tier ? 'Redirecting...' : 'Get Started'}
                  </button>
                ) : (
                  <Link
                    href={`/signup?plan=${plan.tier}`}
                    className="inline-flex w-full items-center justify-center rounded-3xl bg-slate-900 px-5 py-4 text-base font-semibold text-white transition hover:bg-slate-800"
                  >
                    Get Started
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <p className="text-sm text-zinc-500">Free plan</p>
          <p className="mt-3 text-lg font-semibold text-slate-900">Not ready to commit? Start free with 5 leads and 10 outreach messages. No credit card required.</p>
        </div>
      </div>
    </div>
  );
}
