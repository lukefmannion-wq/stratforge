import { buildPageMetadata } from '@/lib/metadata';

export const metadata = buildPageMetadata(
  'Outreach',
  'Generate and refine cold outreach for consultant leads inside StratForge Growth.',
);

export default function OutreachLayout({ children }: { children: React.ReactNode }) {
  return children;
}