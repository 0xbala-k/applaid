export default function DashboardPage() {
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-50">
          Live application dashboard
        </h1>
        <p className="max-w-xl text-sm text-slate-400">
          High-level view of your autonomous job search: discovery, submissions,
          and responses. This is wired for data, but starts with sane defaults.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="card p-4">
          <div className="text-xs text-slate-400">Jobs discovered</div>
          <div className="mt-2 text-2xl font-semibold text-slate-50">15</div>
          <div className="mt-1 text-xs text-emerald-400">
            +5 in the last hour
          </div>
        </div>

        <div className="card p-4">
          <div className="text-xs text-slate-400">Applications submitted</div>
          <div className="mt-2 text-2xl font-semibold text-slate-50">12</div>
          <div className="mt-1 text-xs text-emerald-400">
            80% of discovered roles
          </div>
        </div>

        <div className="card p-4">
          <div className="text-xs text-slate-400">Confirmations received</div>
          <div className="mt-2 text-2xl font-semibold text-slate-50">3</div>
          <div className="mt-1 text-xs text-amber-400">
            Waiting on more responses
          </div>
        </div>

        <div className="card p-4">
          <div className="text-xs text-slate-400">Avg match score</div>
          <div className="mt-2 text-2xl font-semibold text-slate-50">0.89</div>
          <div className="mt-1 text-xs text-slate-400">
            Threshold configurable in worker
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card-muted p-4 md:col-span-2">
          <div className="badge text-slate-300">queue</div>
          <h2 className="mt-3 text-sm font-semibold text-slate-50">
            Status lifecycle
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Every job flows through a single, well-defined state machine.
          </p>
          <ol className="mt-3 flex flex-wrap gap-2 text-xs text-slate-200">
            <li className="badge bg-slate-900/40">QUEUED</li>
            <li className="badge bg-slate-900/40">PREFILLED</li>
            <li className="badge bg-slate-900/40">SUBMITTED</li>
            <li className="badge bg-slate-900/40">NEEDS_OTP</li>
            <li className="badge bg-slate-900/40">CONFIRMED</li>
            <li className="badge bg-slate-900/40">REJECTED</li>
            <li className="badge bg-slate-900/40">FAILED</li>
          </ol>
        </div>

        <div className="card p-4 space-y-2">
          <h2 className="text-sm font-semibold text-slate-50">
            Safety rails enabled
          </h2>
          <ul className="list-disc space-y-1 pl-4 text-xs text-slate-400">
            <li>Per-domain throttling baked into worker</li>
            <li>Optional human approval before submit</li>
            <li>OTP-only when explicitly required</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

