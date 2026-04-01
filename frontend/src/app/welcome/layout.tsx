import { buildPageMetadata } from '@/lib/metadata';

export const metadata = buildPageMetadata(
  'Welcome',
  'Review your onboarding checklist and complete the first steps inside StratForge Growth.',
);

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return children;
}