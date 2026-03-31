'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearToken, getProfile, getToken, updateProfile } from '@/lib/api';
import { ConsultantProfile } from '@/lib/api';

const sectionLabels = {
  service_offerings: 'Service Offerings',
  ideal_client_profile: 'Ideal Client Profile',
  value_proposition: 'Value Proposition',
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ConsultantProfile | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');
  const [draftProfile, setDraftProfile] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    fetchProfile();
  }, [router]);

  const fetchProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getProfile();
      setProfile(data);
    } catch (err: any) {
      setError(err.message || 'Could not load profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (section: string) => {
    setError('');
    setEditing(section);
    if (section === 'service_offerings') {
      setDraftText(profile?.service_offerings.join('\n') || '');
    } else if (section === 'ideal_client_profile') {
      setDraftProfile(profile?.ideal_client_profile || {});
    } else if (section === 'value_proposition') {
      setDraftText(profile?.value_proposition || '');
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setError('');
    try {
      const payload: any = {};
      if (editing === 'service_offerings') {
        payload.service_offerings = draftText
          .split('\n')
          .map((item) => item.trim())
          .filter(Boolean);
      }
      if (editing === 'value_proposition') {
        payload.value_proposition = draftText;
      }
      if (editing === 'ideal_client_profile') {
        payload.ideal_client_profile = draftProfile;
      }
      const updated = await updateProfile(payload);
      setProfile(updated);
      setEditing(null);
    } catch (err: any) {
      setError(err.message || 'Could not save updates.');
    } finally {
      setSaving(false);
    }
  };

  const profileSections = useMemo(() => {
    if (!profile) return [];
    return [
      {
        key: 'service_offerings',
        title: 'Service Offerings',
        content: profile.service_offerings.map((item) => item.trim()),
      },
      {
        key: 'ideal_client_profile',
        title: 'Ideal Client Profile',
        content: profile.ideal_client_profile,
      },
      {
        key: 'value_proposition',
        title: 'Value Proposition',
        content: profile.value_proposition,
      },
    ];
  }, [profile]);

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-900">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Your ICP</p>
              <h1 className="mt-2 text-3xl font-semibold">Consultant profile</h1>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => router.push('/onboarding')}
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Regenerate
              </button>
              <button
                onClick={() => {
                  clearToken();
                  router.push('/login');
                }}
                className="rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
              >
                Log out
              </button>
            </div>
          </div>

          {loading ? (
            <p className="mt-8 text-sm text-zinc-500">Loading profile...</p>
          ) : error ? (
            <p className="mt-8 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p>
          ) : !profile ? (
            <p className="mt-8 text-sm text-zinc-500">No consultant profile found. Head to onboarding to create one.</p>
          ) : null}
        </div>

        {profile ? (
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Service Offerings</h2>
                  <p className="mt-2 text-sm text-zinc-500">What you deliver for clients.</p>
                </div>
                <button
                  onClick={() => handleStartEdit('service_offerings')}
                  className="rounded-full border border-sky-600 px-4 py-2 text-sm font-semibold text-sky-600 transition hover:bg-sky-50"
                >
                  Edit
                </button>
              </div>
              <div className="mt-6">
                {editing === 'service_offerings' ? (
                  <textarea
                    value={draftText}
                    onChange={(event) => setDraftText(event.target.value)}
                    rows={4}
                    className="w-full rounded-3xl border border-zinc-300 bg-zinc-50 px-4 py-4 text-base outline-none transition focus:border-sky-500"
                  />
                ) : (
                  <ul className="space-y-3">
                    {profile.service_offerings.map((item, index) => (
                      <li key={index} className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
                {editing === 'service_offerings' ? (
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Ideal Client Profile</h2>
                  <p className="mt-2 text-sm text-zinc-500">Industries, roles, company size, and pain points.</p>
                </div>
                <button
                  onClick={() => handleStartEdit('ideal_client_profile')}
                  className="rounded-full border border-sky-600 px-4 py-2 text-sm font-semibold text-sky-600 transition hover:bg-sky-50"
                >
                  Edit
                </button>
              </div>
              <div className="mt-6 space-y-4">
                {editing === 'ideal_client_profile' ? (
                  <div className="space-y-4">
                    {Object.entries(draftProfile).map(([key, value]) => (
                      <label key={key} className="block text-sm font-medium text-zinc-900">
                        {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        <textarea
                          value={value}
                          onChange={(event) => setDraftProfile({ ...draftProfile, [key]: event.target.value })}
                          rows={2}
                          className="mt-2 w-full rounded-3xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-base outline-none transition focus:border-sky-500"
                        />
                      </label>
                    ))}
                    <div className="flex gap-3">
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(profile.ideal_client_profile).map(([key, value]) => (
                      <div key={key} className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{key.replace(/_/g, ' ')}</p>
                        <p className="mt-1 font-medium">{value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm xl:col-span-2">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Value Proposition</h2>
                  <p className="mt-2 text-sm text-zinc-500">The single strongest statement that captures your client value.</p>
                </div>
                <button
                  onClick={() => handleStartEdit('value_proposition')}
                  className="rounded-full border border-sky-600 px-4 py-2 text-sm font-semibold text-sky-600 transition hover:bg-sky-50"
                >
                  Edit
                </button>
              </div>
              <div className="mt-6">
                {editing === 'value_proposition' ? (
                  <div className="space-y-4">
                    <textarea
                      value={draftText}
                      onChange={(event) => setDraftText(event.target.value)}
                      rows={4}
                      className="w-full rounded-3xl border border-zinc-300 bg-zinc-50 px-4 py-4 text-base outline-none transition focus:border-sky-500"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-zinc-200 bg-zinc-50 px-6 py-6 text-base text-zinc-700">
                    {profile.value_proposition}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
