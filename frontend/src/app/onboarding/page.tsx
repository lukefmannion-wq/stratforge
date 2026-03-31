'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, generateExpertise } from '@/lib/api';

const steps = [
  { key: 'resume_text', label: 'Resume or background', placeholder: 'Paste your professional background and core skills.' },
  { key: 'past_projects', label: 'Past projects and outcomes', placeholder: 'Describe 2–3 projects and the results you delivered.' },
  { key: 'target_industries', label: 'Target industries', placeholder: 'List the industries you want to serve (e.g. SaaS, healthcare).'},
  { key: 'key_outcomes', label: 'Key outcomes you deliver', placeholder: 'Describe the outcomes you help clients achieve.' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [formData, setFormData] = useState({
    resume_text: '',
    past_projects: '',
    target_industries: '',
    key_outcomes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
    }
  }, [router]);

  const activeStep = steps[stepIndex];
  const progress = useMemo(() => ((stepIndex + 1) / steps.length) * 100, [stepIndex]);

  const handleNext = () => {
    if (stepIndex < steps.length - 1) {
      setStepIndex(stepIndex + 1);
      setError('');
    }
  };

  const handleBack = () => {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
      setError('');
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await generateExpertise(formData);
      router.push('/profile');
    } catch (err: any) {
      setError(err.message || 'Unable to generate profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-900">
      <div className="mx-auto max-w-3xl rounded-3xl border border-zinc-200 bg-white p-10 shadow-sm">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Onboarding</p>
            <h1 className="mt-3 text-3xl font-semibold">Build your Ideal Client Profile</h1>
          </div>
          <p className="text-sm text-zinc-500">Step {stepIndex + 1} of {steps.length}</p>
        </div>

        <div className="mb-8 h-2 overflow-hidden rounded-full bg-zinc-200">
          <div className="h-full rounded-full bg-sky-600" style={{ width: `${progress}%` }} />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-900">{activeStep.label}</label>
            <textarea
              value={(formData as any)[activeStep.key]}
              onChange={(event) => setFormData({ ...formData, [activeStep.key]: event.target.value })}
              placeholder={activeStep.placeholder}
              required
              rows={6}
              className="mt-3 w-full rounded-3xl border border-zinc-300 bg-zinc-50 px-4 py-4 text-base outline-none transition focus:border-sky-500"
            />
          </div>

          {error ? <p className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p> : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={handleBack}
              disabled={stepIndex === 0 || loading}
              className="rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Back
            </button>

            <div className="flex flex-col gap-3 sm:flex-row">
              {stepIndex < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
                >
                  Continue
                </button>
              ) : null}
              <button
                type="submit"
                disabled={loading}
                className="rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Generating...' : stepIndex === steps.length - 1 ? 'Generate My Profile' : 'Save & Continue'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
