import { buildPageMetadata } from '@/lib/metadata';

export const metadata = buildPageMetadata(
  'Leads',
  'Manage, score, and organize target companies in your StratForge Growth lead pipeline.',
);

export default function LeadsLayout({ children }: { children: React.ReactNode }) {
  return children;
}