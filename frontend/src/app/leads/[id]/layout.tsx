import { buildPageMetadata } from '@/lib/metadata';

export const metadata = buildPageMetadata(
  'Lead Details',
  'Inspect a single lead with fit analysis, outreach history, and proposal activity in StratForge Growth.',
);

export default function LeadDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}