import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export function KpiCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4 rounded" />
      </div>
      <Skeleton className="mt-3 h-8 w-16" />
      <Skeleton className="mt-2 h-3 w-32" />
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-border">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="p-4">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

export function RecentApplicationsTableSkeleton() {
  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b border-border p-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-1 h-4 w-64" />
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="h-10 px-4 text-left"><Skeleton className="h-4 w-20" /></th>
            <th className="h-10 px-4 text-left"><Skeleton className="h-4 w-16" /></th>
            <th className="h-10 px-4 text-left"><Skeleton className="h-4 w-14" /></th>
            <th className="h-10 px-4 text-left"><Skeleton className="h-4 w-12" /></th>
            <th className="h-10 px-4 text-left"><Skeleton className="h-4 w-16" /></th>
            <th className="h-10 px-4 text-right"><Skeleton className="h-4 w-12 ml-auto" /></th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRowSkeleton key={i} cols={6} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
