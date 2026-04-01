import { buildPageMetadata } from '@/lib/metadata';

export const metadata = buildPageMetadata(
  'Signup',
  'Create your StratForge Growth account and start building a consultant growth workflow.',
);

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}