'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  getLead,
  getOutreachMessages,
  generateOutreach,
  generateOutreachSequence,
  getToken,
  markOutreachSent,
  updateOutreachMessage,
} from '@/lib/api';
import type { OutreachMessage } from '@/lib/api';

const tabDefinitions = [
  { key: 'cold_email', label: 'Cold Email' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'followup_1', label: 'Follow-up 1' },
  { key: 'followup_2', label: 'Follow-up 2' },
  { key: 'followup_3', label: 'Follow-up 3' },
];

const statusClasses: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-700',
  Sent: 'bg-emerald-100 text-emerald-800',
  Replied: 'bg-sky-100 text-sky-800',
  Bounced: 'bg-rose-100 text-rose-700',
};

export default function OutreachPage() {
  const router = useRouter();
  const [leadId, setLeadId] = useState<number | null>(null);
  const [lead, setLead] = useState<any>(null);
  const [messages, setMessages] = useState<OutreachMessage[]>([]);
  const [selectedTab, setSelectedTab] = useState('cold_email');
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [sequenceLoading, setSequenceLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState(false);
  const saveTimeout = useRef<number | null>(null);

  const selectedMessage = useMemo(
    () => messages.find((message) => message.message_type === selectedTab) || null,
    [messages, selectedTab],
  );

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('lead_id');
      setLeadId(id ? Number(id) : null);
    }
  }, [router]);

  useEffect(() => {
    if (!leadId) {
      setLoading(false);
      return;
    }
    fetchLead();
    fetchMessages();
  }, [leadId]);

  useEffect(() => {
    if (!selectedMessage) {
      setDraftSubject('');
      setDraftBody('');
      setDraftNotes('');
      return;
    }
    setDraftSubject(selectedMessage.subject_line || '');
    setDraftBody(selectedMessage.body || '');
    setDraftNotes(selectedMessage.notes || '');
  }, [selectedMessage]);

  useEffect(() => {
    if (!selectedMessage) return;
    if (saveTimeout.current) {
      window.clearTimeout(saveTimeout.current);
    }
    saveTimeout.current = window.setTimeout(saveDraft, 1000);
    return () => {
      if (saveTimeout.current) {
        window.clearTimeout(saveTimeout.current);
      }
    };
  }, [draftSubject, draftBody, draftNotes, selectedMessage?.id]);

  const fetchLead = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getLead(leadId!);
      setLead(data);
    } catch (err: any) {
      setError(err.message || 'Could not load lead.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    if (!leadId) return;
    setLoadingMessages(true);
    try {
      const data = await getOutreachMessages(leadId);
      setMessages(data);
    } catch (err: any) {
      setError(err.message || 'Could not load outreach messages.');
    } finally {
      setLoadingMessages(false);
    }
  };

  const saveDraft = async () => {
    if (!selectedMessage) {
      return;
    }
    if (selectedMessage.subject_line === draftSubject && selectedMessage.body === draftBody && selectedMessage.notes === draftNotes) {
      return;
    }
    try {
      setActionLoading(true);
      const updated = await updateOutreachMessage(selectedMessage.id, {
        subject_line: selectedTab === 'cold_email' ? draftSubject : undefined,
        body: draftBody,
        notes: draftNotes,
      });
      setMessages((current) =>
        current.map((message) => (message.id === updated.id ? updated : message)),
      );
      setSuccess('Saved.');
      setError('');
      window.setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(err.message || 'Could not save changes.');
    } finally {
      setActionLoading(false);
    }
  };

  const generateSelected = async () => {
    if (!leadId) return;
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      const generated = await generateOutreach({ lead_id: leadId, message_type: selectedTab });
      setMessages((current) => {
        const existing = current.find((message) => message.id === generated.id);
        if (existing) {
          return current.map((message) => (message.id === generated.id ? generated : message));
        }
        return [...current.filter((message) => message.message_type !== generated.message_type), generated];
      });
      setSelectedTab(generated.message_type);
      setSuccess('Message generated.');
    } catch (err: any) {
      setError(err.message || 'Generation failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const generateFullSequence = async () => {
    if (!leadId) return;
    setSequenceLoading(true);
    setError('');
    setSuccess('');
    try {
      const generatedMessages = await generateOutreachSequence(leadId);
      setMessages(generatedMessages);
      setSuccess('Full sequence generated.');
    } catch (err: any) {
      setError(err.message || 'Sequence generation failed.');
    } finally {
      setSequenceLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!selectedMessage) return;
    const text = selectedTab === 'cold_email'
      ? `${draftSubject ? `Subject: ${draftSubject}\n\n` : ''}${draftBody}`
      : draftBody;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Copy failed.');
    }
  };

  const handleMarkSent = async () => {
    if (!selectedMessage) return;
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      const updated = await markOutreachSent(selectedMessage.id);
      setMessages((current) => current.map((message) => (message.id === updated.id ? updated : message)));
      setSuccess('Marked as sent.');
    } catch (err: any) {
      setError(err.message || 'Could not update status.');
    } finally {
      setActionLoading(false);
    }
  };

  if (!leadId) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-900">
        <div className="mx-auto max-w-3xl rounded-3xl border border-zinc-200 bg-white p-10 shadow-sm text-center">
          <p className="text-sm uppercase tracking-[0.35em] text-sky-600">Outreach</p>
          <h1 className="mt-4 text-3xl font-semibold">Select a lead to generate outreach.</h1>
          <p className="mt-3 text-sm text-zinc-500">Open a lead from the Leads page to start writing messages.</p>
          <div className="mt-8 flex justify-center">
            <Link href="/leads" className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700">
              Go to Leads
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-sky-600">AI outreach</p>
            <h1 className="mt-2 text-3xl font-semibold">Outreach generator</h1>
            {lead ? (
              <p className="mt-2 text-sm text-zinc-500">Write personalized messages for {lead.company_name}.</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={generateFullSequence}
              disabled={sequenceLoading || actionLoading}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sequenceLoading ? 'Generating sequence...' : 'Generate Full Sequence'}
            </button>
            <Link
              href="/leads"
              className="rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
            >
              Back to Leads
            </Link>
          </div>
        </div>

        {error ? <div className="rounded-3xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error} <button type="button" onClick={generateSelected} className="ml-3 font-semibold text-rose-900 underline">Try again</button></div> : null}
        {success ? <div className="rounded-3xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Company</p>
                  <p className="mt-3 text-xl font-semibold text-zinc-900">{lead?.company_name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Contact</p>
                  <p className="mt-3 text-xl font-semibold text-zinc-900">{lead?.contact_name || '—'}</p>
                  <p className="mt-1 text-sm text-zinc-600">{lead?.contact_role || 'No role provided'}</p>
                </div>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Fit score</p>
                  <p className="mt-2 text-lg font-semibold text-zinc-900">{lead?.fit_score || 'Unknown'}</p>
                </div>
                <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Status</p>
                  <p className="mt-2 text-lg font-semibold text-zinc-900">{lead?.status || 'Unknown'}</p>
                </div>
                <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Outreach generated</p>
                  <p className="mt-2 text-lg font-semibold text-zinc-900">{messages.length}/5</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {tabDefinitions.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setSelectedTab(tab.key)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        selectedTab === tab.key
                          ? 'bg-slate-900 text-white'
                          : 'border border-zinc-200 bg-white text-zinc-700 hover:border-slate-300 hover:bg-zinc-50'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[selectedMessage?.status ?? 'Draft'] || 'bg-slate-100 text-slate-700'}`}>
                  {selectedMessage?.status || 'Draft'}
                </span>
              </div>

              <div className="mt-6 space-y-6">
                {selectedTab === 'cold_email' ? (
                  <div className="space-y-4">
                    <label className="block">
                      <span className="text-sm font-semibold text-zinc-900">Subject Line</span>
                      <input
                        type="text"
                        value={draftSubject}
                        onChange={(event) => setDraftSubject(event.target.value)}
                        disabled={!selectedMessage}
                        placeholder={selectedMessage ? 'Subject line' : 'Generate this message first'}
                        className="mt-2 w-full rounded-3xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 disabled:cursor-not-allowed disabled:bg-zinc-100"
                      />
                    </label>
                  </div>
                ) : null}

                <div>
                  <label className="block">
                    <span className="text-sm font-semibold text-zinc-900">Message body</span>
                    <textarea
                      value={draftBody}
                      onChange={(event) => setDraftBody(event.target.value)}
                      disabled={!selectedMessage}
                      rows={12}
                      placeholder={selectedMessage ? 'Write your message here...' : 'Generate this message first'}
                      className="mt-2 w-full rounded-3xl border border-zinc-300 bg-zinc-50 px-4 py-4 text-sm outline-none transition focus:border-sky-500 disabled:cursor-not-allowed disabled:bg-zinc-100"
                    />
                  </label>
                </div>

                <div>
                  <label className="block">
                    <span className="text-sm font-semibold text-zinc-900">Notes</span>
                    <textarea
                      value={draftNotes}
                      onChange={(event) => setDraftNotes(event.target.value)}
                      disabled={!selectedMessage}
                      rows={4}
                      placeholder={selectedMessage ? 'Private notes for this message' : 'Generate this message first'}
                      className="mt-2 w-full rounded-3xl border border-zinc-300 bg-zinc-50 px-4 py-4 text-sm outline-none transition focus:border-sky-500 disabled:cursor-not-allowed disabled:bg-zinc-100"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={generateSelected}
                    disabled={actionLoading}
                    className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {actionLoading ? 'Writing message...' : 'Generate'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopy}
                    disabled={!selectedMessage}
                    className="rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    onClick={handleMarkSent}
                    disabled={!selectedMessage || actionLoading}
                    className="rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Mark as Sent
                  </button>
                </div>
                {loadingMessages ? <p className="text-sm text-zinc-500">Refreshing messages...</p> : null}
                {selectedMessage && selectedMessage.status === 'Sent' ? (
                  <p className="text-sm text-slate-500">This message was sent on {new Date(selectedMessage.sent_at || '').toLocaleDateString() || '—'}.</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-sm uppercase tracking-[0.35em] text-sky-600">Signal justification</p>
            <p className="mt-4 text-sm leading-7 text-zinc-700">{lead?.signal_justification || 'No signal available.'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
