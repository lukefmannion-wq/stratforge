import { buildPageMetadata } from '@/lib/metadata';

export const metadata = buildPageMetadata(
  'Proposals',
  'Manage proposals and statements of work tied to your consulting pipeline in StratForge Growth.',
);

export default function ProposalsLayout({ children }: { children: React.ReactNode }) {
  return children;
}