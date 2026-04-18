'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AutoLead, getLeads, getToken } from '@/lib/api';

const FIT_BADGE: Record<string, string> = {
  High: 'bg-emerald-100 text-emerald-800',
  Medium: 'bg-amber-100 text-amber-800',
  Low: 'bg-zinc-100 text-zinc-600',
};

export default function OnboardingResultsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<AutoLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }

    const stored =
      typeof window !== 'undefined' ? sessionStorage.getItem('onboarding_leads') : null;

    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AutoLead[];
        setLeads(parsed);
        setLoading(false);
        return;
      } catch {
        // fall through to API fetch
      }
    }

    getLeads()
      .then((all) => {
        const identified = all.filter((l) => l.pipeline_stage === 'Identified').slice(0, 10);
        setLeads(identified as AutoLead[]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-12 text-zinc-900 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Onboarding complete</p>
          <h1 className="mt-3 text-3xl font-semibold">Your AI-matched leads are ready</h1>
          <p className="mt-3 text-zinc-500">
            Based on your profile, we identified the following high-fit companies. Each one has been
            added to your pipeline.
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-4 py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-sky-600" />
            <p className="text-sm text-zinc-500">Loading your leads...</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="rounded-3xl border border-zinc-200 bg-white p-10 text-center shadow-sm">
            <p className="text-zinc-500">No leads were generated. You can add leads manually from your pipeline.</p>
            <button
              type="button"
              onClick={() => router.push('/pipeline')}
              className="mt-6 rounded-2xl bg-sky-600 px-6 py-3 text-sm font-semibold text-white hover:bg-sky-700"
            >
              Go to Pipeline
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {leads.map((lead) => (
                <div
                  key={lead.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold">{lead.company_name}</h3>
                      {lead.contact_role && (
                        <p className="mt-0.5 text-sm text-zinc-500">{lead.contact_role}</p>
                      )}
                      {lead.industry && (
                        <p className="mt-0.5 text-xs text-zinc-400">{lead.industry}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {lead.fit_score && (
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            FIT_BADGE[lead.fit_score] ?? FIT_BADGE['Low']
                          }`}
                        >
                          {lead.fit_score} fit
                        </span>
                      )}
                      {lead.company_website && (
                        <a
                          href={lead.company_website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-sky-600 hover:underline"
                        >
                          Website
                        </a>
                      )}
                    </div>
                  </div>
                  {lead.signal_justification && (
                    <p className="mt-3 text-sm text-zinc-600">{lead.signal_justification}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-10 text-center">
              <button
                type="button"
                onClick={() => router.push('/pipeline')}
                className="rounded-2xl bg-zinc-900 px-8 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                View my pipeline
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
