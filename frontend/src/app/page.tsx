import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-4xl space-y-10 rounded-[40px] border border-white/10 bg-zinc-900/95 p-10 shadow-2xl shadow-black/20">
        <div className="space-y-6">
          <p className="text-sm uppercase tracking-[0.35em] text-sky-400">StratForge Growth</p>
          <h1 className="text-4xl font-semibold sm:text-5xl">AI-powered onboarding for independent consultants.</h1>
          <p className="max-w-2xl text-lg leading-8 text-zinc-300">
            Create your Ideal Client Profile from your experience, services, and outcomes in a clean, guided flow.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/signup"
            className="rounded-3xl bg-sky-600 px-6 py-4 text-center text-base font-semibold text-white transition hover:bg-sky-500"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="rounded-3xl border border-white/10 px-6 py-4 text-center text-base font-semibold text-white/90 transition hover:bg-white/5"
          >
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
