import { buildPageMetadata } from '@/lib/metadata';

export const metadata = buildPageMetadata(
  'Settings',
  'Access your account settings and subscription management in StratForge Growth.',
);

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}