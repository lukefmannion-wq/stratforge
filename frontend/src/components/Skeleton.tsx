export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`sf-skeleton ${className}`.trim()} />;
}