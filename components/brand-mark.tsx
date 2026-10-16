export function BrandMark({ className = "" }: { className?: string }) {
  return <span className={`tp-symbol ${className}`} aria-hidden="true"><i /><i /><i /></span>;
}
