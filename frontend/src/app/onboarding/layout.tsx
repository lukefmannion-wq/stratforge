import { buildPageMetadata } from '@/lib/metadata';

export const metadata = buildPageMetadata(
  'Onboarding',
  'Build your consultant profile in StratForge Growth to unlock lead scoring and outreach generation.',
);

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return children;
}