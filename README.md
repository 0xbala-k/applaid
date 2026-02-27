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
4.  Applies via browser automation  
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
       Yutori (Auto Apply)
            ↓
       Gmail MCP (OTP + Status)
            ↓
       Airbyte (Sync)
            ↓
       Postgres (Persistent State)
            ↓
       Render Dashboard

### Core Stack

| Component  | Role                              |
|------------|-----------------------------------|
| Tavily API | Job discovery + relevance scoring |
| Yutori MCP | Browser automation + form filling |
| Gmail MCP  | OTP extraction + status parsing   |
| Airbyte    | Email/job sync into DB            |
| Postgres   | State management                  |
| Render     | Deployment + cron scheduling      |

------------------------------------------------------------------------

## ⚙️ Workflow

| Step | Action                                  |
|------|-----------------------------------------|
| 1    | User submits resume + preferences       |
| 2    | Cron job runs hourly search             |
| 3    | Top matches (score \> threshold) queued |
| 4    | Auto-apply task triggered               |
| 5    | OTP fetched from Gmail if required      |
| 6    | Status stored in DB                     |
| 7    | Dashboard updates in real-time          |

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
    /lib        → Integrations (Tavily, Yutori, Gmail)
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
-   Optional human approval before submit
-   Rate limiting
-   OTP only when user-initiated
-   Deduplication of job URLs
-   Error tracking & retries

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
    YUTORI_API_KEY=
    GMAIL_MCP_KEY=

### 4️⃣ Run Locally

``` bash
npm run dev
```

### 5️⃣ Run Worker

``` bash
npm run worker
```

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
