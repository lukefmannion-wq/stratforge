import { buildPageMetadata } from '@/lib/metadata';

export const metadata = buildPageMetadata(
  'Pipeline Metrics',
  'Review funnel performance, revenue forecasts, and activity metrics in StratForge Growth.',
);

export default function PipelineMetricsLayout({ children }: { children: React.ReactNode }) {
  return children;
}