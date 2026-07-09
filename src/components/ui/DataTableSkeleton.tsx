interface DataTableSkeletonProps {
  rows?: number
}

export function DataTableSkeleton({ rows = 5 }: DataTableSkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-14 animate-pulse rounded-xl bg-[#efe9de]"
        />
      ))}
    </div>
  )
}
