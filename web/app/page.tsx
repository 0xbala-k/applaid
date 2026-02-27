import { prisma } from "../lib/prisma";
import { ApplyTasksTable } from "./ApplyTasksTable";

async function getDashboardData() {
  const [discovered, queued, submitted, needsOtp, confirmed, topLeads, tasks] =
    await Promise.all([
      prisma.jobLead.count(),
      prisma.applyTask.count({ where: { status: "QUEUED" } }),
      prisma.applyTask.count({ where: { status: "SUBMITTED" } }),
      prisma.applyTask.count({ where: { status: "NEEDS_OTP" } }),
      prisma.applyTask.count({ where: { status: "CONFIRMED" } }),
      prisma.jobLead.findMany({
        orderBy: [{ score: "desc" }, { createdAt: "desc" }],
        take: 10,
        select: {
          id: true,
          company: true,
          title: true,
          score: true,
          url: true
        }
      }),
      prisma.applyTask.findMany({
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: {
          id: true,
          status: true,
          lastError: true,
          updatedAt: true
        }
      })
    ]);

  return {
    kpis: {
      discovered,
      queued,
      submitted,
      needsOtp,
      confirmed
    },
    topLeads,
    tasks: tasks.map((task) => ({
      ...task,
      updatedAt: task.updatedAt.toISOString()
    }))
  };
}

export default async function DashboardPage() {
  const { kpis, topLeads, tasks } = await getDashboardData();

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-50">
          Live application dashboard
        </h1>
        <p className="max-w-xl text-sm text-slate-400">
          High-level view of your autonomous job search: discovery, queue
          health, submissions, and confirmations.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-5">
        <div className="card p-4">
          <div className="text-xs text-slate-400">Discovered</div>
          <div className="mt-2 text-2xl font-semibold text-slate-50">
            {kpis.discovered}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Total unique job leads tracked.
          </div>
        </div>

        <div className="card p-4">
          <div className="text-xs text-slate-400">Queued</div>
          <div className="mt-2 text-2xl font-semibold text-slate-50">
            {kpis.queued}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Waiting for the next apply run.
          </div>
        </div>

        <div className="card p-4">
          <div className="text-xs text-slate-400">Submitted</div>
          <div className="mt-2 text-2xl font-semibold text-slate-50">
            {kpis.submitted}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Completed auto-apply submissions.
          </div>
        </div>

        <div className="card p-4">
          <div className="text-xs text-slate-400">Needs OTP</div>
          <div className="mt-2 text-2xl font-semibold text-slate-50">
            {kpis.needsOtp}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Waiting on inbox verification.
          </div>
        </div>

        <div className="card p-4">
          <div className="text-xs text-slate-400">Confirmed</div>
          <div className="mt-2 text-2xl font-semibold text-slate-50">
            {kpis.confirmed}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Applications with receipt/confirmation.
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card-muted p-4 md:col-span-2 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-50">
                Top leads
              </h2>
              <p className="text-xs text-slate-400">
                Highest scoring roles discovered from your preferences.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs text-slate-200">
              <thead>
                <tr className="border-b border-slate-800/60 text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-3 text-left font-medium">Company</th>
                  <th className="py-2 px-3 text-left font-medium">Title</th>
                  <th className="py-2 px-3 text-left font-medium">Score</th>
                  <th className="py-2 pl-3 text-right font-medium">Link</th>
                </tr>
              </thead>
              <tbody>
                {topLeads.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-4 text-center text-xs text-slate-500"
                    >
                      No leads yet. Once the worker discovers roles, they will
                      appear here.
                    </td>
                  </tr>
                ) : (
                  topLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-b border-slate-800/40 last:border-b-0"
                    >
                      <td className="py-2 pr-3 text-sm text-slate-100">
                        {lead.company}
                      </td>
                      <td className="py-2 px-3 text-xs text-slate-300">
                        {lead.title}
                      </td>
                      <td className="py-2 px-3 text-xs text-slate-200">
                        {typeof lead.score === "number"
                          ? lead.score.toFixed(2)
                          : "—"}
                      </td>
                      <td className="py-2 pl-3 text-right text-xs">
                        <a
                          href={lead.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 underline-offset-2 hover:underline"
                        >
                          View
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <ApplyTasksTable initialTasks={tasks} />
      </div>
    </section>
  );
}

