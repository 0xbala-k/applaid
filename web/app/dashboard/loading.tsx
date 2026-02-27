import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  KpiCardSkeleton,
  RecentApplicationsTableSkeleton,
} from "@/components/skeletons";

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <header>
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-96 max-w-full animate-pulse rounded bg-muted" />
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentApplicationsTableSkeleton />
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <div className="h-4 w-28 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-6 animate-pulse rounded bg-muted" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
