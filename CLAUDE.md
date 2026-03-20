# CLAUDE.md — applaid

Applaid is an autonomous job application agent. It discovers job listings via Tavily, uses browser automation (Yutori/Browserbase+Stagehand) to fill and submit application forms, and tracks everything in a Postgres database with a Next.js dashboard.

---

## Repository Structure

```
applaid/
├── web/                   # Next.js 16 app (frontend + API routes)
│   ├── app/
│   │   ├── api/           # REST API endpoints
│   │   ├── dashboard/     # Dashboard pages
│   │   ├── onboarding/    # Resume + preferences setup
│   │   └── preferences/   # Preferences management
│   ├── components/
│   │   └── ui/            # Radix UI component library (shadcn-style)
│   └── lib/               # Prisma singleton, API helpers, data fetching
├── worker/                # Node.js cron worker
│   └── src/
│       ├── index.ts               # Bootstrap + cron scheduling
│       ├── discover_and_queue.ts  # Tavily search → create ApplyTasks
│       ├── apply_and_update.ts    # Execute queued ApplyTasks
│       ├── apply_runner.ts        # Single-application orchestrator
│       ├── yutori_adapter.ts      # Browser automation adapter (stub + real)
│       ├── query_builder.ts       # Tavily search query generation + scoring
│       ├── domain_throttle.ts     # Per-domain rate limiting
│       ├── retry.ts               # Error classification + exponential backoff
│       └── types.ts               # Shared TypeScript types (ClassifiedError, etc.)
├── prisma/
│   ├── schema.prisma      # Data models
│   └── migrations/        # Migration history
└── .env.example           # Environment variable template
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend + API | Next.js 16, React 18, Tailwind CSS, Radix UI |
| Database | PostgreSQL via Prisma ORM 5.9 |
| Job Discovery | Tavily API |
| Browser Automation | Yutori API (wraps Browserbase + Stagehand) |
| Email/OTP | Gmail MCP |
| Worker Scheduling | node-cron |
| Validation | Zod |
| Testing | Vitest |
| Deployment | Render (web service + background worker + managed Postgres) |

---

## Development Setup

### Prerequisites
- Node.js 18+
- PostgreSQL database
- API keys: Tavily, Yutori, Gmail MCP

### Install & Configure
```bash
npm install                    # Install all workspace dependencies
cp .env.example .env           # Create .env (fill in values)
npm run prisma:generate        # Generate Prisma client
npm run prisma:migrate         # Run database migrations
```

### Run Locally
```bash
npm run dev        # Start Next.js dev server (http://localhost:3000)
npm run worker     # Start background worker (separate terminal)
```

### Build
```bash
npm run build      # Build web (next build) + worker (tsc)
npm run start      # Start production Next.js server
```

---

## Environment Variables

See `.env.example` for the full list. Key variables:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/applaid"

TAVILY_API_KEY="..."           # Job discovery
YUTORI_API_KEY="..."           # Browser automation
GMAIL_MCP_KEY="..."            # OTP/email handling

APPLY_SAFE_MODE="false"        # Set "true" to prefill only (no form submission)
APPLY_MAX_RETRIES="3"
APPLY_BASE_DELAY_MS="1000"
APPLY_MAX_DELAY_MS="30000"
APPLY_DOMAIN_THROTTLE_MS="5000"

NEXT_PUBLIC_APP_NAME="applaid"

# Optional worker trigger HTTP server
WORKER_TRIGGER_PORT="3199"
WORKER_TRIGGER_URL="http://localhost:3199"
```

---

## Database Schema

### Models

**Preference** — User job search profile
- `email` (unique), `title`, `location`, `minSalary`, `keywords`, `autoApply`
- Relations: `resumes[]`, `jobLeads[]`

**Resume** — Parsed resume text
- `preferenceId`, `label`, `storageKey` (`"inline"` = text stored in DB), `rawText`, `keywords`

**JobLead** — Discovered job posting
- `title`, `company`, `location`, `url`, `source` (`"tavily"`), `score` (0–1)
- `preferenceId` — optional (`String?`); a JobLead may not always be linked to a preference
- `dedupeHash` — SHA256 of canonicalized URL (prevents duplicate applications); indexed via `@@index([dedupeHash])` for performant duplicate lookups
- Relations: `applyTasks[]`, `emailEvents[]`

**ApplyTask** — Single application attempt
- `status`: `QUEUED → PREFILLED → SUBMITTED → NEEDS_OTP → CONFIRMED | REJECTED | FAILED`
- `runAt`, `lastError`

**EmailEvent** — Incoming email (OTP, receipt, rejection)
- `type`: `OTP | RECEIPT | REJECTION | OTHER`
- `payload` — Raw Gmail MCP JSON

### Database Commands
```bash
npm run prisma:migrate   # Run pending migrations
npm run prisma:generate  # Regenerate client after schema changes
npm run db:reset         # Reset and re-run all migrations
npm run db:clear         # Clear all data (keep schema)
```

---

## API Routes

All responses use a standard envelope:
```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": { "code": "...", "message": "...", "details": {} } }
```

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/preferences` | Upsert job search preferences (by email) |
| `POST` | `/api/resume` | Ingest resume text, extract keywords |
| `POST` | `/api/resume/upload` | Upload PDF or DOCX resume file, extract text + keywords |
| `GET` | `/api/leads?minScore=0.8` | Fetch job leads above score threshold |
| `GET` | `/api/tasks?status=SUBMITTED&limit=50` | List apply tasks |
| `POST` | `/api/tasks/:id/retry` | Reset task to QUEUED for retry |
| `POST` | `/api/apply-tasks/retry` | **Deprecated** — legacy retry route (uses raw `NextResponse.json()`); use `/api/tasks/:id/retry` instead |
| `POST` | `/api/worker/trigger` | Manually trigger discovery + apply |

Use `web/lib/api.ts` helpers (`apiSuccess`, `apiError`, `zodError`) for all API responses — do not return raw `NextResponse.json()`.

---

## Worker Cron Schedule

| Schedule | Job |
|----------|-----|
| Every hour (`0 * * * *`) | `discover_and_queue()` — Tavily search → create JobLeads + ApplyTasks |
| Every 10 min (`*/10 * * * *`) | `apply_and_update()` — Execute QUEUED ApplyTasks (batch of 10) |

Both jobs also run once immediately on worker startup.

---

## Key Patterns & Conventions

### Naming
- **Files**: `kebab-case.ts` for utilities/components, `snake_case.ts` for worker modules
- **Functions/variables**: `camelCase`
- **Prisma models/enums**: `PascalCase`
- **Database columns**: snake_case (mapped to camelCase in Prisma)

### Validation
Use Zod for all API input validation. Define schemas inline with the route handler.
```ts
const schema = z.object({ email: z.string().email(), ... })
const parsed = schema.safeParse(await req.json())
if (!parsed.success) return zodError(parsed.error)
```

### Prisma Client
Always import the singleton from `web/lib/prisma.ts`, not `new PrismaClient()` directly. This avoids connection pool exhaustion in Next.js dev mode.

### Adapter Pattern (Yutori)
`YutoriAdapter` has two implementations in `worker/src/yutori_adapter.ts`:
- `StubYutoriAdapter` — Returns mock data, used in tests
- `YutoriBrowsingAdapter` — Real browser automation via Yutori API

Inject the adapter into `ApplyRunner`; never instantiate adapters inside runner logic.

### Error Handling in Worker
The `retry.ts` module classifies errors as terminal or retryable:
- **Terminal** (no retry): 401, 403, 404, `/captcha/i`, blocked, forbidden, `not found`, `unauthorized`, `application.*closed`, `position.*filled`
- **Retryable**: network resets (`ECONNREFUSED`, `ENOTFOUND`, `fetch failed`, `socket hang up`), timeouts, 429, 502, 503, rate limit
- **Unknown**: treated as retryable (safe default)

Use `classifyError(err)` before deciding whether to retry or mark a task as FAILED.

### Exponential Backoff
```ts
delay = random(0, min(maxDelayMs, baseDelayMs * 2^attempt))
```
Jitter prevents thundering herd on retries.

### Domain Throttling
`DomainThrottle` (in-memory) enforces a minimum interval between requests to the same domain. It collapses ATS subdomains (e.g., `boards.greenhouse.io → greenhouse.io`). Initialize once per worker run and pass it down.

### Logging
Use structured JSON logs consistently:
```ts
console.log(JSON.stringify({ ts: new Date().toISOString(), level: "info", event: "...", payload: { ... } }))
```

### Deduplication
Before creating a `JobLead`, compute `dedupeHash = sha256(canonicalizeUrl(url))`. Skip if hash already exists in DB. `canonicalizeUrl` strips query params and fragments, lowercases, and removes trailing slashes.

### Query Building for Tavily
`query_builder.ts` generates 3–6 layered search queries per preference (discovery, geographic, skills, combined, compensation, precision). Scoring adds a `+0.05` bonus per additional query match for the same URL.

---

## Testing

Tests live in `worker/src/*.test.ts`. Run with Vitest:

```bash
cd worker && npm test         # Run tests once
cd worker && npm run test:watch  # Watch mode
```

> **Note**: The root-level `npm test` script is a placeholder (`echo "No tests yet"`). Always run tests from the `worker/` subdirectory directly.

When writing tests:
- Use `StubYutoriAdapter` for all apply runner tests
- Mock Prisma with `vi.mock('../lib/prisma')` pattern
- Test query builder with varied preference inputs to verify layered queries

---

## Frontend Components

Components follow shadcn/ui conventions using Radix UI primitives + Tailwind:
- Base UI components live in `web/components/ui/`
- Page-level components (dashboard, onboarding) live in `web/components/`
- All pages are async Server Components with `export const dynamic = "force-dynamic"` for real-time data
- Use the `cn()` utility from `web/lib/utils.ts` for conditional class merging

---

## Common Gotchas

- **`prisma as any` in `/api/apply-tasks/retry`** — This legacy route casts Prisma to `any`, bypassing TypeScript safety. Avoid this pattern; use the typed Prisma client everywhere else.
- **Duplicate retry route** — `/api/apply-tasks/retry` (body param) is a deprecated legacy endpoint. Always use `/api/tasks/:id/retry` (path param) which follows API conventions.
- **Root `npm test` is a no-op** — The workspace root `package.json` has `"test": "echo \"No tests yet\""`. Run tests from `worker/` (`cd worker && npm test`).
- **`JobLead.preferenceId` is optional** — Not every discovered lead is tied to a user preference (e.g., leads created before a preference was set). Handle `null` gracefully.
- **Prisma singleton** — Never call `new PrismaClient()` directly. Always import from `web/lib/prisma.ts` to avoid connection pool exhaustion in Next.js dev mode.

---

## Important Constraints

1. **`APPLY_SAFE_MODE=true`** — Set this during development/testing to prefill forms without submitting. Never submit to real jobs without confirming this is disabled intentionally.
2. **Domain throttle** — Do not bypass `DomainThrottle`; it protects against IP bans and ATS blocks.
3. **Deduplication** — Always check `dedupeHash` before inserting a `JobLead` to prevent applying to the same job twice.
4. **Prisma migrations** — After modifying `prisma/schema.prisma`, always run `npm run prisma:migrate` and commit the generated migration file. Never edit existing migration SQL.
5. **Batch limits** — `apply_and_update` processes a maximum of 10 tasks per run. Do not increase without reviewing Browserbase concurrency limits.
