import { buildPageMetadata } from '@/lib/metadata';
import Link from 'next/link';

export const metadata = buildPageMetadata(
  'Settings',
  'Access your account settings and subscription management in StratForge Growth.',
);

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const navItems = [
    { href: '/settings/billing', label: 'Billing' },
    { href: '/settings/email', label: 'Email' },
    { href: '/profile', label: 'Profile' },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-900">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="h-fit rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="px-2 pb-3 text-xs uppercase tracking-[0.35em] text-zinc-500">Settings</p>
          <nav className="space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main>{children}</main>
      </div>
    </div>
  );
}