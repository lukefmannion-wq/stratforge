'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getOnboardingStatus, getToken, OnboardingStatus } from '@/lib/api';

const defaultStatus: OnboardingStatus = {
  has_profile: false,
  has_lead: false,
  has_outreach: false,
};

export default function WelcomePage() {
  const router = useRouter();
  const [status, setStatus] = useState<OnboardingStatus>(defaultStatus);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }

    const load = async () => {
      try {
        const data = await getOnboardingStatus();
        setStatus(data);
      } catch (err: any) {
        setError(err.message || 'Could not load onboarding status.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  const allDone = useMemo(() => status.has_profile && status.has_lead && status.has_outreach, [status]);

  const checklist = [
    {
      label: 'Your profile is set up',
      done: status.has_profile,
      href: '/profile',
      cta: 'Review profile',
    },
    {
      label: 'Add your first lead',
      done: status.has_lead,
      href: '/leads',
      cta: 'Add lead',
    },
    {
      label: 'Generate your first outreach message',
      done: status.has_outreach,
      href: '/outreach',
      cta: 'Generate outreach',
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-900">
        <div className="mx-auto max-w-3xl rounded-3xl border border-zinc-200 bg-white p-10 shadow-sm">
          <p className="text-sm text-zinc-500">Loading your welcome checklist...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-900">
      <div className="mx-auto max-w-3xl rounded-3xl border border-zinc-200 bg-white p-10 shadow-sm">
        <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Welcome</p>
        <h1 className="mt-3 text-3xl font-semibold">Congratulations, your onboarding is complete.</h1>
        <p className="mt-3 text-zinc-600">Finish these quick steps to unlock your full consulting workflow.</p>

        {error ? <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

        <div className="mt-8 space-y-3">
          {checklist.map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${item.done ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-200 text-zinc-700'}`}>
                  {item.done ? '✓' : '•'}
                </span>
                <span className="text-sm font-medium text-zinc-900">{item.label}{item.done ? ' ✓' : ''}</span>
              </div>
              {item.done ? (
                <span className="text-xs font-semibold text-emerald-700">Done</span>
              ) : (
                <Link href={item.href} className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700">
                  {item.cta}
                </Link>
              )}
            </div>
          ))}
        </div>

        {allDone ? (
          <div className="mt-8">
            <Link href="/pipeline" className="inline-flex rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800">
              Go to your pipeline
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
