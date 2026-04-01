import { buildPageMetadata } from '@/lib/metadata';

export const metadata = buildPageMetadata(
  'Proposal Details',
  'Edit, duplicate, export, and send an individual proposal from StratForge Growth.',
);

export default function ProposalDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}