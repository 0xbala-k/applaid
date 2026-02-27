"use client";

import Link from "next/link";
import { Briefcase, ExternalLink, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import type { JobsData } from "@/lib/jobs-data";

type Props = {
  data: JobsData;
  searchQuery: string;
};

export function JobsContent({ data, searchQuery }: Props) {
  const { items, total, page, totalPages } = data;
  const basePath = "/dashboard/jobs";
  const queryParam = searchQuery ? `q=${encodeURIComponent(searchQuery)}&` : "";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Discovered roles matching your preferences.
        </p>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">All discovered jobs</CardTitle>
            <form
              method="get"
              action={basePath}
              className="flex w-full gap-2 sm:w-72"
            >
              <input type="hidden" name="page" value="1" />
              <Input
                name="q"
                placeholder="Search company, role, location..."
                defaultValue={searchQuery}
                className="h-8"
              />
              <Button type="submit" size="sm" variant="secondary" className="shrink-0">
                <Search className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No jobs yet"
                description="Run the worker or adjust your preferences to discover roles."
                icon={<Briefcase className="h-10 w-10" />}
              />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">Discovered</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">{job.company}</TableCell>
                      <TableCell className="text-muted-foreground">{job.title}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {job.location ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {job.source ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {job.score != null ? Math.round(job.score) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" asChild aria-label="Open job link">
                          <a
                            href={job.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    Showing {(page - 1) * data.pageSize + 1}–{Math.min(page * data.pageSize, total)} of {total}
                  </p>
                  <nav className="flex items-center gap-2" aria-label="Pagination">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      disabled={page <= 1}
                    >
                      {page > 1 ? (
                        <Link href={`${basePath}?${queryParam}page=${page - 1}`}>
                          Previous
                        </Link>
                      ) : (
                        <span>Previous</span>
                      )}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      disabled={page >= totalPages}
                    >
                      {page < totalPages ? (
                        <Link href={`${basePath}?${queryParam}page=${page + 1}`}>
                          Next
                        </Link>
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
