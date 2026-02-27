export default function Loading() {
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <div className="h-6 w-64 rounded-md bg-slate-800/60" />
        <div className="h-4 w-80 rounded-md bg-slate-900/70" />
      </header>

      <div className="grid gap-4 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div key={idx} className="card p-4 space-y-2">
            <div className="h-3 w-20 rounded bg-slate-800/70" />
            <div className="h-7 w-16 rounded bg-slate-700/80" />
            <div className="h-3 w-32 rounded bg-slate-900/70" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card-muted p-4 md:col-span-2 space-y-3">
          <div className="h-4 w-32 rounded bg-slate-800/70" />
          <div className="h-3 w-64 rounded bg-slate-900/70" />
          <div className="mt-3 space-y-2">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="h-5 w-full rounded-md bg-slate-900/60"
              />
            ))}
          </div>
        </div>

        <div className="card p-4 space-y-3">
          <div className="h-4 w-28 rounded bg-slate-800/70" />
          <div className="h-3 w-64 rounded bg-slate-900/70" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="h-5 w-full rounded-md bg-slate-900/60"
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

