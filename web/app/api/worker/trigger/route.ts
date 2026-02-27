import { apiError, apiSuccess } from "@/lib/api";

/**
 * POST /api/worker/trigger
 * Proxies to the worker's trigger endpoint for demo (discover + apply once).
 * Requires WORKER_TRIGGER_URL (e.g. http://localhost:3199) and worker running with WORKER_TRIGGER_PORT=3199.
 */
export async function POST() {
  const baseUrl = process.env.WORKER_TRIGGER_URL;
  if (!baseUrl) {
    return apiError(
      "BAD_REQUEST",
      "Worker trigger not configured. Set WORKER_TRIGGER_URL and run the worker with WORKER_TRIGGER_PORT.",
      { status: 503 }
    );
  }

  const url = baseUrl.replace(/\/$/, "") + "/trigger";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(5 * 60 * 1000), // 5 min for discover + apply
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return apiError(
        "INTERNAL_SERVER_ERROR",
        (body && typeof body.error === "string" ? body.error : null) ||
          `Worker returned ${res.status}`,
        { status: 502, details: body }
      );
    }

    return apiSuccess({ triggered: true, ...body });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to reach worker";
    return apiError(
      "INTERNAL_SERVER_ERROR",
      `Worker trigger failed: ${message}. Is the worker running with WORKER_TRIGGER_PORT?`,
      { status: 502 }
    );
  }
}
