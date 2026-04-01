'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  disconnectEmailAccount,
  getConnectedEmailAccounts,
  getGmailAuthUrl,
  getToken,
  type ConnectedEmailAccount,
} from '@/lib/api';
import { useApiFeedback } from '@/components/ApiFeedbackProvider';

export default function EmailSettingsPage() {
  const router = useRouter();
  const { showToast } = useApiFeedback();
  const [accounts, setAccounts] = useState<ConnectedEmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    fetchAccounts();
  }, [router]);

  const fetchAccounts = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getConnectedEmailAccounts();
      setAccounts(data);
    } catch (err: any) {
      setError(err.message || 'Could not load connected email accounts.');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGmail = async () => {
    setConnecting(true);
    setError('');
    try {
      const response = await getGmailAuthUrl();
      window.location.href = response.authorization_url;
    } catch (err: any) {
      setConnecting(false);
      setError(err.message || 'Could not start Gmail connection flow.');
    }
  };

  const handleDisconnect = async (accountId: number) => {
    setDisconnectingId(accountId);
    setError('');
    try {
      await disconnectEmailAccount(accountId);
      setAccounts((current) => current.filter((account) => account.id !== accountId));
      showToast('Email account disconnected');
    } catch (err: any) {
      setError(err.message || 'Could not disconnect account.');
    } finally {
      setDisconnectingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-sky-600">Email settings</p>
            <h1 className="mt-3 text-3xl font-semibold">Connected email accounts</h1>
          </div>
          <button
            type="button"
            onClick={handleConnectGmail}
            disabled={connecting}
            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {connecting ? 'Redirecting...' : 'Connect Gmail'}
          </button>
        </div>

        <p className="mt-6 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-slate-800">
          Emails sent through StratForge using your connected account go directly from your inbox, improving deliverability and keeping your conversation history in Gmail.
        </p>

        {error ? <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

        <div className="mt-6 space-y-3">
          {loading ? <p className="text-sm text-zinc-500">Loading connected accounts...</p> : null}
          {!loading && accounts.length === 0 ? (
            <p className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              No email accounts connected yet.
            </p>
          ) : null}
          {accounts.map((account) => (
            <div key={account.id} className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-900">{account.email_address}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{account.provider}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDisconnect(account.id)}
                disabled={disconnectingId === account.id}
                className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {disconnectingId === account.id ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
