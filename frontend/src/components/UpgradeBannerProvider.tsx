'use client';

import { useEffect, useState } from 'react';
import { registerUpgradeRequiredCallback } from '@/lib/api';
import Link from 'next/link';

export default function UpgradeBannerProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    registerUpgradeRequiredCallback((nextMessage: string) => {
      setMessage(nextMessage);
    });
  }, []);

  return (
    <>
      {message ? (
        <div className="mb-4 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>{message}</p>
            <div className="flex items-center gap-3">
              <Link
                href="/pricing"
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Upgrade
              </Link>
              <button
                type="button"
                onClick={() => setMessage(null)}
                className="rounded-2xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {children}
    </>
  );
}
