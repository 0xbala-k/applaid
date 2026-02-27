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
