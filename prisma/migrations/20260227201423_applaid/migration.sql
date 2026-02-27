-- CreateEnum
CREATE TYPE "ApplyTaskStatus" AS ENUM ('QUEUED', 'PREFILLED', 'SUBMITTED', 'NEEDS_OTP', 'CONFIRMED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailEventType" AS ENUM ('OTP', 'RECEIPT', 'REJECTION', 'OTHER');

-- CreateTable
CREATE TABLE "preferences" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "title" TEXT,
    "location" TEXT,
    "minSalary" INTEGER,
    "keywords" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resumes" (
    "id" TEXT NOT NULL,
    "preference_id" TEXT,
    "label" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "raw_text" TEXT,
    "keywords" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resumes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_leads" (
    "id" TEXT NOT NULL,
    "preference_id" TEXT,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT,
    "url" TEXT NOT NULL,
    "source" TEXT,
    "score" DOUBLE PRECISION,
    "dedupe_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apply_tasks" (
    "id" TEXT NOT NULL,
    "job_lead_id" TEXT NOT NULL,
    "status" "ApplyTaskStatus" NOT NULL,
    "run_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "apply_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_events" (
    "id" TEXT NOT NULL,
    "job_lead_id" TEXT,
    "type" "EmailEventType" NOT NULL,
    "message_id" TEXT NOT NULL,
    "subject" TEXT,
    "from_address" TEXT,
    "to_address" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "preferences_email_key" ON "preferences"("email");

-- CreateIndex
CREATE INDEX "job_leads_dedupe_hash_idx" ON "job_leads"("dedupe_hash");

-- CreateIndex
CREATE INDEX "apply_tasks_job_lead_id_status_idx" ON "apply_tasks"("job_lead_id", "status");

-- AddForeignKey
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_preference_id_fkey" FOREIGN KEY ("preference_id") REFERENCES "preferences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_leads" ADD CONSTRAINT "job_leads_preference_id_fkey" FOREIGN KEY ("preference_id") REFERENCES "preferences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apply_tasks" ADD CONSTRAINT "apply_tasks_job_lead_id_fkey" FOREIGN KEY ("job_lead_id") REFERENCES "job_leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_job_lead_id_fkey" FOREIGN KEY ("job_lead_id") REFERENCES "job_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
