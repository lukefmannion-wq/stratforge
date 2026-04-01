import { buildPageMetadata } from '@/lib/metadata';

export const metadata = buildPageMetadata(
  'Login',
  'Log in to StratForge Growth to access your pipeline, outreach drafts, and proposals.',
);

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}