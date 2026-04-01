import { buildPageMetadata } from '@/lib/metadata';

export const metadata = buildPageMetadata(
  'Profile',
  'Review and refine your consultant positioning, ICP, and service offerings in StratForge Growth.',
);

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}