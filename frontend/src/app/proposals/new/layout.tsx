import { buildPageMetadata } from '@/lib/metadata';

export const metadata = buildPageMetadata(
  'New Proposal',
  'Generate a new client proposal or statement of work from a qualified lead in StratForge Growth.',
);

export default function NewProposalLayout({ children }: { children: React.ReactNode }) {
  return children;
}