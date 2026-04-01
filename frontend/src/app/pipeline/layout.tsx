import { buildPageMetadata } from '@/lib/metadata';

export const metadata = buildPageMetadata(
  'Pipeline',
  'Track every lead across stages and manage your consulting pipeline in StratForge Growth.',
);

export default function PipelineLayout({ children }: { children: React.ReactNode }) {
  return children;
}