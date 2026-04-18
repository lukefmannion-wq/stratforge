'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AutoLead,
  completeOnboarding,
  getOnboardingStatus,
  getToken,
  saveOnboardingStep,
} from '@/lib/api';

const STEP_NAMES = ['Identity', 'Background', 'Expertise', 'Target Client', 'Positioning'];

const INDUSTRIES = [
  'Technology', 'Healthcare', 'Finance', 'Manufacturing', 'Retail',
  'Education', 'Real Estate', 'Energy', 'Legal', 'Non-profit',
  'Media & Entertainment', 'Logistics & Supply Chain', 'Government', 'Hospitality', 'Agriculture',
];

const CONSULTING_AREAS = [
  'Strategy', 'Operations', 'Finance', 'Marketing', 'Sales',
  'Technology', 'HR & Talent', 'Change Management', 'Product', 'Data & Analytics',
  'Risk & Compliance', 'Supply Chain', 'Customer Experience', 'Digital Transformation',
  'Leadership Coaching', 'M&A Advisory',
];

const ENGAGEMENT_TYPES = ['Advisory', 'Project-based', 'Fractional', 'Workshop', 'Retainer', 'Interim Executive'];

const ENGAGEMENT_LENGTHS = ['< 1 month', '1–3 months', '3–6 months', '6–12 months', '12+ months'];

const RATE_RANGES = [
  'Under $100/hr', '$100–$150/hr', '$150–$250/hr', '$250–$400/hr', '$400+/hr',
  'Under $5k/project', '$5k–$25k/project', '$25k–$100k/project', '$100k+/project',
];

const YEARS_OPTIONS = ['0–2', '3–5', '6–10', '11–20', '20+'];
const YEARS_MAP: Record<string, number> = { '0–2': 1, '3–5': 4, '6–10': 8, '11–20': 15, '20+': 25 };

const COMPANY_SIZES = ['Startup (1–10)', 'Small (11–50)', 'Mid-market (51–500)', 'Enterprise (500+)'];

const GEO_FOCUS = [
  'North America', 'Europe', 'Asia-Pacific', 'Latin America',
  'Middle East', 'Africa', 'Global / Remote',
];

const LOADING_MESSAGES = [
  'Analyzing your profile...',
  'Identifying ideal clients...',
  'Matching industry signals...',
  'Scoring company fit...',
  'Building your lead list...',
];

interface WizardData {
  full_name: string;
  professional_title: string;
  years_of_experience: string;
  professional_background: string;
  previous_employers: string[];
  certifications: string[];
  industries_of_expertise: string[];
  industries_of_interest: string[];
  consulting_areas: string[];
  company_sizes: string[];
  client_roles: string[];
  geographic_focus: string[];
  past_engagement_types: string[];
  unique_value_proposition: string;
  typical_engagement_length: string;
  rate_range: string;
}

function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');

  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput('');
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1 text-sm text-sky-800"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="ml-1 leading-none text-sky-600 hover:text-sky-900"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder={placeholder || 'Type and press Enter'}
          className="flex-1 rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm outline-none focus:border-sky-500"
        />
        <button
          type="button"
          onClick={addTag}
          className="rounded-2xl bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-300"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function TileGrid({
  options,
  selected,
  onChange,
  multi = true,
}: {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  multi?: boolean;
}) {
  const toggle = (opt: string) => {
    if (multi) {
      onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);
    } else {
      onChange(selected.includes(opt) ? [] : [opt]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={`rounded-2xl border px-4 py-2 text-sm font-medium transition ${
            selected.includes(opt)
              ? 'border-sky-600 bg-sky-600 text-white'
              : 'border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function Step1({
  data,
  onChange,
}: {
  data: WizardData;
  onChange: (updates: Partial<WizardData>) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-zinc-900">Full name</label>
        <input
          type="text"
          value={data.full_name}
          onChange={(e) => onChange({ full_name: e.target.value })}
          placeholder="Jane Smith"
          className="mt-2 w-full rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-base outline-none focus:border-sky-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-900">Professional title</label>
        <input
          type="text"
          value={data.professional_title}
          onChange={(e) => onChange({ professional_title: e.target.value })}
          placeholder="e.g. Operations Consultant, CFO Advisor"
          className="mt-2 w-full rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-base outline-none focus:border-sky-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-900">Years of experience</label>
        <div className="mt-3">
          <TileGrid
            options={YEARS_OPTIONS}
            selected={data.years_of_experience ? [data.years_of_experience] : []}
            onChange={(arr) => onChange({ years_of_experience: arr[0] || '' })}
            multi={false}
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-900">Professional background</label>
        <p className="mt-1 text-sm text-zinc-500">
          Brief summary of your career, expertise, and what you are known for.
        </p>
        <textarea
          value={data.professional_background}
          onChange={(e) => onChange({ professional_background: e.target.value })}
          placeholder="e.g. 15 years scaling operations for B2B SaaS companies from Series A to IPO..."
          rows={5}
          className="mt-2 w-full rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm outline-none focus:border-sky-500"
        />
      </div>
    </div>
  );
}

function Step2({
  data,
  onChange,
}: {
  data: WizardData;
  onChange: (updates: Partial<WizardData>) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-zinc-900">Previous employers</label>
        <p className="mt-1 text-sm text-zinc-500">Companies you have worked at or consulted for.</p>
        <div className="mt-3">
          <TagInput
            tags={data.previous_employers}
            onChange={(v) => onChange({ previous_employers: v })}
            placeholder="Company name, press Enter"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-900">Certifications &amp; credentials</label>
        <p className="mt-1 text-sm text-zinc-500">
          Professional certifications, licenses, or notable credentials.
        </p>
        <div className="mt-3">
          <TagInput
            tags={data.certifications}
            onChange={(v) => onChange({ certifications: v })}
            placeholder="e.g. PMP, CPA, MBA"
          />
        </div>
      </div>
    </div>
  );
}

function Step3({
  data,
  onChange,
}: {
  data: WizardData;
  onChange: (updates: Partial<WizardData>) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-zinc-900">Industries of expertise</label>
        <p className="mt-1 text-sm text-zinc-500">Where you have deep experience.</p>
        <div className="mt-3">
          <TileGrid
            options={INDUSTRIES}
            selected={data.industries_of_expertise}
            onChange={(v) => onChange({ industries_of_expertise: v })}
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-900">Industries of interest</label>
        <p className="mt-1 text-sm text-zinc-500">Where you would like to work more.</p>
        <div className="mt-3">
          <TileGrid
            options={INDUSTRIES}
            selected={data.industries_of_interest}
            onChange={(v) => onChange({ industries_of_interest: v })}
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-900">Consulting areas</label>
        <p className="mt-1 text-sm text-zinc-500">The functional domains you work in.</p>
        <div className="mt-3">
          <TileGrid
            options={CONSULTING_AREAS}
            selected={data.consulting_areas}
            onChange={(v) => onChange({ consulting_areas: v })}
          />
        </div>
      </div>
    </div>
  );
}

function Step4({
  data,
  onChange,
}: {
  data: WizardData;
  onChange: (updates: Partial<WizardData>) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-zinc-900">Target company size</label>
        <div className="mt-3">
          <TileGrid
            options={COMPANY_SIZES}
            selected={data.company_sizes}
            onChange={(v) => onChange({ company_sizes: v })}
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-900">Target client roles</label>
        <p className="mt-1 text-sm text-zinc-500">Who do you typically work with?</p>
        <div className="mt-3">
          <TagInput
            tags={data.client_roles}
            onChange={(v) => onChange({ client_roles: v })}
            placeholder="e.g. CEO, CFO, VP of Operations"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-900">Geographic focus</label>
        <div className="mt-3">
          <TileGrid
            options={GEO_FOCUS}
            selected={data.geographic_focus}
            onChange={(v) => onChange({ geographic_focus: v })}
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-900">Past engagement types</label>
        <div className="mt-3">
          <TileGrid
            options={ENGAGEMENT_TYPES}
            selected={data.past_engagement_types}
            onChange={(v) => onChange({ past_engagement_types: v })}
          />
        </div>
      </div>
    </div>
  );
}

function Step5({
  data,
  onChange,
}: {
  data: WizardData;
  onChange: (updates: Partial<WizardData>) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-zinc-900">Unique value proposition</label>
        <p className="mt-1 text-sm text-zinc-500">
          In one or two sentences, what makes you different from other consultants?
        </p>
        <textarea
          value={data.unique_value_proposition}
          onChange={(e) => onChange({ unique_value_proposition: e.target.value })}
          placeholder="e.g. I help Series B SaaS companies reduce customer churn by 30% within 90 days through data-driven retention programs."
          rows={4}
          className="mt-2 w-full rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm outline-none focus:border-sky-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-900">Typical engagement length</label>
        <div className="mt-3">
          <TileGrid
            options={ENGAGEMENT_LENGTHS}
            selected={data.typical_engagement_length ? [data.typical_engagement_length] : []}
            onChange={(arr) => onChange({ typical_engagement_length: arr[0] || '' })}
            multi={false}
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-900">Rate range</label>
        <div className="mt-3">
          <TileGrid
            options={RATE_RANGES}
            selected={data.rate_range ? [data.rate_range] : []}
            onChange={(arr) => onChange({ rate_range: arr[0] || '' })}
            multi={false}
          />
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [data, setData] = useState<WizardData>({
    full_name: '',
    professional_title: '',
    years_of_experience: '',
    professional_background: '',
    previous_employers: [],
    certifications: [],
    industries_of_expertise: [],
    industries_of_interest: [],
    consulting_areas: [],
    company_sizes: [],
    client_roles: [],
    geographic_focus: [],
    past_engagement_types: [],
    unique_value_proposition: '',
    typical_engagement_length: '',
    rate_range: '',
  });
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [error, setError] = useState('');
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    getOnboardingStatus()
      .then((status) => {
        if (status.onboarding_completed) {
          router.push('/pipeline');
        }
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    if (loading) {
      let i = 0;
      loadingIntervalRef.current = setInterval(() => {
        i = (i + 1) % LOADING_MESSAGES.length;
        setLoadingMsg(LOADING_MESSAGES[i]);
      }, 2000);
    } else {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
    }
    return () => {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
    };
  }, [loading]);

  const update = (updates: Partial<WizardData>) => setData((prev) => ({ ...prev, ...updates }));

  const buildPayload = (step: number) => {
    if (step === 0) {
      return {
        full_name: data.full_name || undefined,
        professional_title: data.professional_title || undefined,
        years_of_experience: data.years_of_experience ? YEARS_MAP[data.years_of_experience] : undefined,
        professional_background: data.professional_background || undefined,
      };
    }
    if (step === 1) {
      return {
        previous_employers: data.previous_employers.length ? data.previous_employers : undefined,
        certifications: data.certifications.length ? data.certifications : undefined,
      };
    }
    if (step === 2) {
      return {
        industries_of_expertise: data.industries_of_expertise.length
          ? data.industries_of_expertise
          : undefined,
        industries_of_interest: data.industries_of_interest.length
          ? data.industries_of_interest
          : undefined,
        consulting_areas: data.consulting_areas.length ? data.consulting_areas : undefined,
      };
    }
    if (step === 3) {
      return {
        target_client_type: {
          company_size: data.company_sizes,
          client_roles: data.client_roles,
          geographic_focus: data.geographic_focus,
        },
        past_engagement_types: data.past_engagement_types.length
          ? data.past_engagement_types
          : undefined,
      };
    }
    return {
      unique_value_proposition: data.unique_value_proposition || undefined,
      typical_engagement_length: data.typical_engagement_length || undefined,
      rate_range: data.rate_range || undefined,
    };
  };

  const handleNext = async () => {
    setError('');
    setLoading(true);
    try {
      await saveOnboardingStep(buildPayload(stepIndex));
      setStepIndex((i) => i + 1);
    } catch (err: any) {
      setError(err.message || 'Failed to save — please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    setError('');
    setLoading(true);
    try {
      await saveOnboardingStep(buildPayload(4));
      const result = await completeOnboarding();
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('onboarding_leads', JSON.stringify(result.leads));
      }
      router.push('/onboarding/results');
    } catch (err: any) {
      setError(err.message || 'Failed to complete onboarding — please try again.');
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (stepIndex > 0) {
      setStepIndex((i) => i - 1);
      setError('');
    }
  };

  const progress = ((stepIndex + 1) / STEP_NAMES.length) * 100;
  const stepProps = { data, onChange: update };

  return (
    <>
      {loading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-sky-600" />
          <p className="mt-4 text-sm font-medium text-zinc-600">{loadingMsg}</p>
        </div>
      )}

      <div className="min-h-screen bg-zinc-50 px-4 py-12 text-zinc-900 sm:px-6">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6">
            <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Onboarding</p>
            <h1 className="mt-2 text-3xl font-semibold">Build your consultant profile</h1>
          </div>

          <div className="mb-2 hidden justify-between text-xs text-zinc-500 sm:flex">
            {STEP_NAMES.map((name, i) => (
              <span key={name} className={i === stepIndex ? 'font-semibold text-sky-600' : ''}>
                {name}
              </span>
            ))}
          </div>
          <p className="mb-2 text-sm text-zinc-500 sm:hidden">
            Step {stepIndex + 1} of {STEP_NAMES.length} — {STEP_NAMES[stepIndex]}
          </p>
          <div className="mb-8 h-2 overflow-hidden rounded-full bg-zinc-200">
            <div
              className="h-full rounded-full bg-sky-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="mb-6 text-xl font-semibold">{STEP_NAMES[stepIndex]}</h2>

            {stepIndex === 0 && <Step1 {...stepProps} />}
            {stepIndex === 1 && <Step2 {...stepProps} />}
            {stepIndex === 2 && <Step3 {...stepProps} />}
            {stepIndex === 3 && <Step4 {...stepProps} />}
            {stepIndex === 4 && <Step5 {...stepProps} />}

            {error && (
              <p className="mt-6 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p>
            )}

            <div className="mt-8 flex items-center justify-between">
              <button
                type="button"
                onClick={handleBack}
                disabled={stepIndex === 0 || loading}
                className="rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Back
              </button>

              {stepIndex < STEP_NAMES.length - 1 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={loading}
                  className="rounded-2xl bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={loading}
                  className="rounded-2xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Generate My Leads
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
