"use client";

import { FormEvent, useState } from "react";

type PreferencePayload = {
  email: string;
  title?: string;
  location?: string;
  minSalary?: number;
  keywords?: string;
};

export default function PreferencesPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload: PreferencePayload = {
      email: String(formData.get("email") || "").trim(),
      title: String(formData.get("title") || "").trim() || undefined,
      location: String(formData.get("location") || "").trim() || undefined,
      minSalary: formData.get("minSalary")
        ? Number(formData.get("minSalary"))
        : undefined,
      keywords: String(formData.get("keywords") || "").trim() || undefined
    };

    try {
      const res = await fetch("/api/preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to save preferences");
      }

      setMessage("Preferences saved. Worker will use these on the next run.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-50">
          Job preferences
        </h1>
        <p className="max-w-xl text-sm text-slate-400">
          Tell applaid what you are looking for. The worker reads these
          preferences before every discovery run.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="card max-w-xl space-y-4 p-5"
        autoComplete="on"
      >
        <div className="space-y-1">
          <label
            htmlFor="email"
            className="text-xs font-medium text-slate-200"
          >
            Contact email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="you@fast-moving-startup.com"
          />
          <p className="text-[11px] text-slate-500">
            Used to associate discoveries, auto-applies and OTP flows with your
            profile.
          </p>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="title"
            className="text-xs font-medium text-slate-200"
          >
            Target title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            placeholder="Senior Software Engineer – Agent Systems"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label
              htmlFor="location"
              className="text-xs font-medium text-slate-200"
            >
              Preferred location
            </label>
            <input
              id="location"
              name="location"
              type="text"
              placeholder="Bay Area / Remote"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="minSalary"
              className="text-xs font-medium text-slate-200"
            >
              Minimum base salary (USD)
            </label>
            <input
              id="minSalary"
              name="minSalary"
              type="number"
              min={0}
              step={5000}
              placeholder="150000"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="keywords"
            className="text-xs font-medium text-slate-200"
          >
            Role keywords
          </label>
          <textarea
            id="keywords"
            name="keywords"
            rows={3}
            placeholder="Java, Go, Solidity, Blockchain, Stablecoins"
          />
          <p className="text-[11px] text-slate-500">
            Comma-separated or plain text; worker can turn this into filters for
            Tavily, Yutori and Gmail.
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-50 shadow-md shadow-blue-500/40 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Saving…" : "Save preferences"}
          </button>

          <p className="text-[11px] text-slate-500">
            These values are stored in Postgres via Prisma.
          </p>
        </div>

        {message && (
          <p className="text-xs text-emerald-400" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="text-xs text-rose-400" role="alert">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}

