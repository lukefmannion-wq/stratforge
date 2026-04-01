import { buildPageMetadata } from '@/lib/metadata';

export const metadata = buildPageMetadata(
  'Billing',
  'Review subscription status, usage, and billing controls in StratForge Growth.',
);

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  return children;
}