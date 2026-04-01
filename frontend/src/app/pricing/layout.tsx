import { buildPageMetadata } from '@/lib/metadata';

export const metadata = buildPageMetadata(
  'Pricing',
  'Compare StratForge Growth plans for lead generation, outreach volume, and proposal capacity.',
);

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}