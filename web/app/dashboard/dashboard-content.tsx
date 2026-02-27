"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  Briefcase,
  Send,
  Eye,
  Trophy,
  TrendingUp,
  Play,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KpiCard } from "@/components/kpi-card";
import { EmptyState } from "@/components/empty-state";
import { ErrorBanner } from "@/components/error-banner";
import type { DashboardData } from "@/lib/dashboard-data";
import type { ApplyTaskStatus } from "@prisma/client";

const STATUS_DISPLAY: Record<
  ApplyTaskStatus,
  { label: string; variant: "applied" | "in-review" | "rejected" | "interview" | "offer" | "destructive" | "secondary" }
> = {
  QUEUED: { label: "Queued", variant: "secondary" },
  PREFILLED: { label: "Prefilled", variant: "applied" },
  SUBMITTED: { label: "In Review", variant: "in-review" },
  NEEDS_OTP: { label: "Needs OTP", variant: "in-review" },
  CONFIRMED: { label: "Confirmed", variant: "interview" },
  REJECTED: { label: "Rejected", variant: "rejected" },
  FAILED: { label: "Failed", variant: "destructive" },
};

type Props = {
  data: DashboardData;
  error?: string | null;
};

export function DashboardContent({ data, error }: Props) {
  const { kpis, recentApplications, topMatches, funnel } = data;
  const [triggering, setTriggering] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleTriggerWorker() {
    setTriggering(true);
    setTriggerMessage(null);
    try {
      const res = await fetch("/api/worker/trigger", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setTriggerMessage({
          type: "success",
          text: "Worker run triggered. Discovery and apply are running.",
        });
        window.location.reload();
      } else {
        const msg = json?.error?.message ?? "Trigger failed";
        const setupHint =
          res.status === 503
            ? " Add WORKER_TRIGGER_URL=http://localhost:3199 to web/.env.local, then start the worker with: WORKER_TRIGGER_PORT=3199 npm run worker"
            : "";
        setTriggerMessage({
          type: "error",
          text: msg + setupHint,
        });
      }
    } catch (e) {
      setTriggerMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Request failed",
      });
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track discovery, auto-applies, and outcomes.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleTriggerWorker}
          disabled={triggering}
        >
          {triggering ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-2 h-4 w-4" />
          )}
          Run worker (demo)
        </Button>
      </header>
      {triggerMessage && (
        <div
          className={
            triggerMessage.type === "success"
              ? "rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-200"
              : "rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
          }
        >
          {triggerMessage.text}
        </div>
      )}

      {error && <ErrorBanner message={error} />}

      {/* KPI section */}
      <section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Jobs found today"
            value={kpis.jobsFoundToday}
            subtitle="From your preferences"
            icon={<Search className="h-4 w-4" />}
            trend={
              kpis.trendLabel
                ? { label: kpis.trendLabel, up: kpis.trendUp }
                : undefined
            }
          />
          <KpiCard
            title="Auto-applied"
            value={kpis.autoApplied}
            subtitle="Submitted or confirmed"
            icon={<Send className="h-4 w-4" />}
          />
          <KpiCard
            title="In review"
            value={kpis.inReview}
            subtitle="Awaiting response"
            icon={<Eye className="h-4 w-4" />}
          />
          <KpiCard
            title="Confirmed"
            value={kpis.confirmed}
            subtitle="Application confirmed"
            icon={<Briefcase className="h-4 w-4" />}
          />
        </div>
      </section>

      {/* Content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent applications — wide */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent applications</CardTitle>
              <p className="text-xs text-muted-foreground">
                Latest activity across all sources.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {recentApplications.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    title="No applications yet"
                    description="Upload your resume and set preferences to start auto-applying."
                    action={{ label: "Upload Resume", href: "/onboarding" }}
                    icon={<Send className="h-10 w-10" />}
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentApplications.map((row) => {
                      const statusInfo = STATUS_DISPLAY[row.status];
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.company}</TableCell>
                          <TableCell className="text-muted-foreground">{row.role}</TableCell>
                          <TableCell className="text-muted-foreground">{row.source}</TableCell>
                          <TableCell className="text-muted-foreground">{row.date}</TableCell>
                          <TableCell>
                            <Badge variant={statusInfo.variant}>
                              {statusInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/dashboard/applications/${row.id}`}>
                                View
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Top matches + Status funnel */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Top matches
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topMatches.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No scored leads yet. Jobs will appear here as they’re discovered.
                </p>
              ) : (
                <ul className="space-y-3">
                  {topMatches.map((match) => (
                    <li
                      key={match.id}
                      className="flex items-start justify-between gap-2 rounded-md border border-border bg-muted/30 p-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-tight">{match.title}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {match.company && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {match.company}
                            </span>
                          )}
                          {match.location && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {match.location}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {typeof match.score === "number"
                          ? Math.round(match.score)
                          : "—"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Status funnel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {funnel.map((item) => (
                  <div key={item.stage} className="flex items-center gap-3">
                    <span className="w-20 text-xs font-medium text-muted-foreground">
                      {item.stage}
                    </span>
                    <div className="flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary transition-all duration-300"
                        style={{ width: `${item.widthPercent}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
