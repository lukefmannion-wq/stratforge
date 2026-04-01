import { buildPageMetadata } from '@/lib/metadata';

export const metadata = buildPageMetadata(
  'Outreach History',
  'Browse generated outreach drafts, statuses, and send history in StratForge Growth.',
);

export default function OutreachHistoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}