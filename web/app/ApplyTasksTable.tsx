"use client";

import { useState, useTransition } from "react";

type ApplyTaskRow = {
  id: string;
  status: string;
  lastError: string | null;
  updatedAt: string;
};

type Props = {
  initialTasks: ApplyTaskRow[];
};

export function ApplyTasksTable({ initialTasks }: Props) {
  const [tasks, setTasks] = useState<ApplyTaskRow[]>(initialTasks);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function retryTask(id: string) {
    setError(null);
    setPendingId(id);

    try {
      const res = await fetch("/api/apply-tasks/retry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ id })
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to retry task");
      }

      const updated = json.task as {
        id: string;
        status: string;
        lastError: string | null;
        updatedAt: string;
      };

      startTransition(() => {
        setTasks((prev) =>
          prev.map((task) =>
            task.id === updated.id
              ? {
                  ...task,
                  status: updated.status,
                  lastError: updated.lastError,
                  updatedAt: updated.updatedAt
                }
              : task
          )
        );
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-50">Apply tasks</h2>
          <p className="text-xs text-slate-400">
            Recent automation runs with retry controls for failures.
          </p>
        </div>
      </div>

      {error && (
        <p className="text-xs text-rose-400" role="alert">
          {error}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs text-slate-200">
          <thead>
            <tr className="border-b border-slate-800/60 text-[11px] uppercase tracking-wide text-slate-400">
              <th className="py-2 pr-3 text-left font-medium">Status</th>
              <th className="py-2 px-3 text-left font-medium">Last error</th>
              <th className="py-2 px-3 text-left font-medium">Updated</th>
              <th className="py-2 pl-3 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="py-4 text-center text-xs text-slate-500"
                >
                  No apply tasks yet. Once the worker runs, they will appear
                  here.
                </td>
              </tr>
            ) : (
              tasks.map((task) => (
                <tr
                  key={task.id}
                  className="border-b border-slate-800/40 last:border-b-0"
                >
                  <td className="py-2 pr-3">
                    <span className="badge bg-slate-900/40 text-[10px] text-slate-200">
                      {task.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 align-top">
                    {task.lastError ? (
                      <span className="line-clamp-2 text-[11px] text-slate-300">
                        {task.lastError}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-500">
                        –
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-[11px] text-slate-400">
                    {new Date(task.updatedAt).toLocaleString()}
                  </td>
                  <td className="py-2 pl-3 text-right">
                    <button
                      type="button"
                      onClick={() => retryTask(task.id)}
                      disabled={pendingId === task.id || isPending}
                      className="rounded-md bg-blue-600 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-50 shadow-sm shadow-blue-500/40 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {pendingId === task.id ? "Retrying…" : "Retry"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

