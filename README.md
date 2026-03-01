# 🧥 applaid

> Autonomous Job Application Agent
> Resume in → Offers out (in theory).

applaid automates the full job application lifecycle — from resume input
to discovery, auto-apply, OTP handling, and outcome tracking — all
deployed with persistent state.

Built for hackathons. Designed for job hunters. Slightly unhinged.

------------------------------------------------------------------------

## 🚀 What It Does

applaid runs as a scheduled autonomous agent that:

1.  Ingests your resume + job preferences
2.  Finds new matching roles every hour
3.  Scores and ranks them automatically
4.  Applies via cloud browser automation (Browserbase + Stagehand)
5.  Handles OTP verification through Gmail
6.  Tracks confirmations & rejections
7.  Displays everything in a live dashboard

------------------------------------------------------------------------

## 🧠 Architecture

    Resume + Preferences
            ↓
       Tavily (Discovery + Scoring)
            ↓
       Filter Top Matches
            ↓
       Browserbase + Stagehand (Auto Apply)
            ↓
       Gmail MCP (OTP + Status)
            ↓
       Airbyte (Sync)
            ↓
       Postgres (Persistent State)
            ↓
       Render Dashboard

### Core Stack

| Component              | Role                                        |
|------------------------|---------------------------------------------|
| Tavily API             | Job discovery + relevance scoring           |
| Browserbase            | Cloud browser sessions + concurrency mgmt   |
| Stagehand              | AI-powered form filling + browser actions   |
| Gmail MCP              | OTP extraction + status parsing             |
| Airbyte                | Email/job sync into DB                      |
| Postgres               | State management                            |
| Render                 | Deployment + cron scheduling                |

------------------------------------------------------------------------

## ⚙️ How Browser Automation Works

applaid uses **[Browserbase](https://www.browserbase.com)** as the cloud browser infrastructure
and **[Stagehand](https://docs.stagehand.dev)** as the AI-driven automation layer to fill and
submit job applications.

### Flow per Application

```
1. Create Stagehand session  →  Browserbase spins up a cloud browser
2. Navigate to job URL       →  page.goto(jobUrl)
3. Detect form fields        →  stagehand.observe() / stagehand.act()
4. Fill applicant data       →  stagehand.act("type 'Ada Lovelace' into the name field")
5. Upload resume             →  observe file input → setInputFiles(resumePdf)
6. Submit                    →  stagehand.act("click the submit button")
7. Detect result             →  stagehand.extract() → SUBMITTED / NEEDS_OTP / BLOCKED
8. Close session             →  stagehand.close()
```

### Concurrency

Browserbase project limits cap how many simultaneous browser sessions can run.
A semaphore pattern (based on [Browserbase's job-application template](https://www.browserbase.com/templates/job-application))
controls parallel applications so we never exceed those limits.

You can watch live sessions at:

```
https://browserbase.com/sessions/<sessionId>
```

------------------------------------------------------------------------

## 📊 Example Dashboard Output

    15 jobs discovered
    12 applications submitted
    3 confirmation emails received
    Avg match score: 0.89

------------------------------------------------------------------------

## 🏗 Project Structure

    /web        → Next.js frontend + API routes
    /worker     → Cron discovery + apply runner
    /prisma     → DB schema + migrations
    /lib        → Integrations (Tavily, Browserbase, Gmail)
    /dashboard  → UI components

------------------------------------------------------------------------

## 📡 HTTP API

All API responses share a consistent envelope:

- **Success**:
  `200`–`299`

  ```json
  {
    "success": true,
    "data": { "...route specific..." }
  }
  ```

- **Error**:
  `4xx` or `5xx`

  ```json
  {
    "success": false,
    "error": {
      "code": "BAD_REQUEST | VALIDATION_ERROR | NOT_FOUND | INTERNAL_SERVER_ERROR",
      "message": "Human readable message",
      "details": { "...optional extra context..." }
    }
  }
  ```

Validation is handled with **zod**; invalid input returns `400` with `code = "VALIDATION_ERROR"`.

### `POST /api/preferences`

- **Purpose**: Upsert job search preferences by email.
- **Body**:

  ```json
  {
    "email": "user@example.com",
    "title": "Software Engineer",
    "location": "Remote",
    "minSalary": 150000,
    "keywords": "java, go, solidity"
  }
  ```

- **Notes**:
  - `email` is required and used as the upsert key.
  - Returns the saved `preference` record.

### `POST /api/resume`

- **Purpose**: Ingest a resume as plain text and extract keywords.
- **Body**:

  ```json
  {
    "label": "Main resume",
    "text": "Full resume text here...",
    "email": "user@example.com"
  }
  ```

  - `label`: Required, short identifier for this resume.
  - `text`: Required, raw resume text (stored as `rawText`).
  - One of `email` or `preferenceId` is required.

- **Behavior**:
  - Looks up (or creates) a `Preference` by `email` if needed.
  - Stores:
    - `rawText` (full text)
    - `keywords` (top extracted tokens)
    - `storageKey = "inline"` for text-stored resumes.
  - **Response** includes:
    - The created `resume` record.
    - `keywords`: array of extracted keyword strings.

### `GET /api/leads?minScore=0.8`

- **Purpose**: Fetch discovered job leads above a given relevance score.
- **Query params**:
  - `minScore` (optional, default `0.8`): number in \[0, 1\].

- **Behavior**:
  - Returns up to 100 `JobLead`s where:
    - `score >= minScore` **or** `score` is `null`.
  - Sorted by `score desc`, then `createdAt desc`.
  - Includes:
    - Basic associated `preference` (email, title, etc.).
    - Latest `ApplyTask` for each lead (status, last error, run time).

### `GET /api/tasks`

- **Purpose**: Inspect apply tasks and their latest state.
- **Query params**:
  - `status` (optional): one of
    `QUEUED | PREFILLED | SUBMITTED | NEEDS_OTP | CONFIRMED | REJECTED | FAILED`
  - `limit` (optional): integer, default `50`, max `200`.

- **Behavior**:
  - Returns recent `ApplyTask`s, optionally filtered by status.
  - Sorted by `createdAt desc`.
  - Each task includes its associated `JobLead` (title, company, url, score).

### `POST /api/tasks/:id/retry`

- **Purpose**: Reset an `ApplyTask` so the worker can retry it.
- **Params**:
  - `id`: `ApplyTask.id` (path param).

- **Behavior**:
  - If the task exists, sets:
    - `status = "QUEUED"`
    - `runAt = null`
    - `lastError = null`
  - Returns the updated task plus its `JobLead`.
  - If the task is missing, returns `404` with `code = "NOT_FOUND"`.

------------------------------------------------------------------------

## 🔐 Safety Features

-   Per-domain throttling
-   Optional human approval before submit (safe mode)
-   Browserbase concurrency limits (semaphore-controlled)
-   Rate limiting
-   OTP only when user-initiated
-   Deduplication of job URLs
-   Error tracking & retries
-   Live session monitoring via Browserbase dashboard

------------------------------------------------------------------------

## 🛠 Setup

### 1️⃣ Clone

``` bash
git clone https://github.com/yourusername/applaid
cd applaid
```

### 2️⃣ Install

``` bash
npm install
```

### 3️⃣ Configure Environment

Create `.env`:

    DATABASE_URL=
    TAVILY_API_KEY=
    BROWSERBASE_API_KEY=
    BROWSERBASE_PROJECT_ID=
    GOOGLE_GENERATIVE_AI_API_KEY=
    GMAIL_MCP_KEY=

- `BROWSERBASE_API_KEY` — from [Browserbase dashboard](https://www.browserbase.com)
- `BROWSERBASE_PROJECT_ID` — your Browserbase project ID
- `GOOGLE_GENERATIVE_AI_API_KEY` — used by Stagehand's AI model (Gemini 2.5 Flash) to understand forms

### 4️⃣ Run Locally

``` bash
npm run dev
```

### 5️⃣ Run Worker

``` bash
npm run worker
```

### 6️⃣ Manual verification (Browserbase apply)

To test the real Browserbase + Stagehand integration end-to-end:

1. **Set your API keys**
   In `.env`, set:
   ``` env
   BROWSERBASE_API_KEY=your-browserbase-api-key
   BROWSERBASE_PROJECT_ID=your-project-id
   GOOGLE_GENERATIVE_AI_API_KEY=your-google-ai-key
   ```
   (If `BROWSERBASE_API_KEY` is unset, the worker uses the stub adapter and no real browser runs.)

2. **Create a test ApplyTask**
   From repo root, create one QUEUED task (plus Preference, Resume, JobLead if needed):
   ``` bash
   cd worker && npm run seed:test-apply
   ```
   This seeds a single QUEUED apply task for `test-apply@example.com` pointing at `https://example.com/job/123`.

3. **Run the apply step once**
   From repo root:
   ``` bash
   cd worker && npm run apply:once
   ```
   Or run the full worker (discover + apply on boot, then cron):
   ``` bash
   npm run worker
   ```

4. **Watch the session live**
   - Logs will print a live session URL: `https://browserbase.com/sessions/<id>`
   - You can watch the browser fill out the application form in real time.

------------------------------------------------------------------------

## ⏰ Cron (Render)

applaid runs hourly:

``` bash
node worker/dist/discover_and_queue.js
```

Deploy as: - Web Service - Background Worker - Managed Postgres - Render
Cron Job

------------------------------------------------------------------------

## 🧪 Status Lifecycle

    QUEUED
    → PREFILLED
    → SUBMITTED
    → NEEDS_OTP
    → CONFIRMED
    → REJECTED
    → FAILED

------------------------------------------------------------------------

## 🎯 Use Case Example

Preferences:

-   Title: Software Engineer – Stablecoins
-   Salary: $150k+
-   Location: Bay Area / Remote
-   Keywords: Java, Go, Solidity, Blockchain

applaid automatically:

-   Searches
-   Scores
-   Applies
-   Tracks responses

While you sleep.

------------------------------------------------------------------------

## 🔥 Why applaid?

Because manually applying to jobs is:

-   Repetitive
-   Time-consuming
-   Emotionally exhausting

So we automated it.

------------------------------------------------------------------------

## 🧪 Future Improvements

-   Resume tailoring per job description
-   LLM-based cover letter generation
-   Interview calendar auto-detection
-   Multi-user support
-   Analytics: conversion rates per keyword

------------------------------------------------------------------------

## ⚠ Disclaimer

applaid respects rate limits and site policies.
Automation should be used responsibly and ethically.

------------------------------------------------------------------------

## 🏆 Built For

Hackathons.
Dream jobs.
Rent being due.
