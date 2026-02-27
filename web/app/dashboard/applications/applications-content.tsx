"use client";

import { useState } from "react";
import Link from "next/link";
import { Send, RotateCcw } from "lucide-react";
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
import { EmptyState } from "@/components/empty-state";
import { ErrorBanner } from "@/components/error-banner";
import type { ApplicationsData } from "@/lib/applications-data";
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
  data: ApplicationsData;
};

export function ApplicationsContent({ data }: Props) {
  const [tasks, setTasks] = useState(data.items);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const { total, page, pageSize, totalPages } = data;
  const basePath = "/dashboard/applications";

  async function handleRetry(id: string) {
    setError(null);
    setPendingId(id);
    try {
      const res = await fetch("/api/apply-tasks/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to retry");
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                status: json.task.status,
                lastError: json.task.lastError,
                updatedAt: json.task.updatedAt,
              }
            : t
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to retry");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All applications and their status.
        </p>
      </header>

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All applications</CardTitle>
          <p className="text-xs text-muted-foreground">
            Apply tasks with retry for failed or stuck items.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {tasks.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No applications yet"
                description="Applications will appear here once the worker runs."
                action={{ label: "Go to Dashboard", href: "/dashboard" }}
                icon={<Send className="h-10 w-10" />}
              />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="max-w-[200px]">Last error</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((row) => {
                    const statusInfo = STATUS_DISPLAY[row.status];
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.company}</TableCell>
                        <TableCell className="text-muted-foreground">{row.role}</TableCell>
                        <TableCell className="text-muted-foreground">{row.source}</TableCell>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {new Date(row.updatedAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                          {row.lastError ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/dashboard/applications/${row.id}`}>
                                View
                              </Link>
                            </Button>
                            {row.status === "FAILED" && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={pendingId === row.id}
                                onClick={() => handleRetry(row.id)}
                              >
                                {pendingId === row.id ? (
                                  "Retrying…"
                                ) : (
                                  <>
                                    <RotateCcw className="h-3 w-3" />
                                    Retry
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
                  </p>
                  <nav className="flex items-center gap-2" aria-label="Pagination">
                    <Button variant="outline" size="sm" asChild disabled={page <= 1}>
                      {page > 1 ? (
                        <Link href={`${basePath}?page=${page - 1}`}>Previous</Link>
                      ) : (
                        <span>Previous</span>
                      )}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {page} of {totalPages}
                    </span>
                    <Button variant="outline" size="sm" asChild disabled={page >= totalPages}>
                      {page < totalPages ? (
                        <Link href={`${basePath}?page=${page + 1}`}>Next</Link>
                      ) : (
                        <span>Next</span>
                      )}
                    </Button>
                  </nav>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
