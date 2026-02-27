/**
 * One-off script to create a single QUEUED ApplyTask for manual testing of
 * apply_and_update (e.g. to verify YutoriBrowsingAdapter).
 *
 * Run from repo root:  cd worker && npm run seed:test-apply
 * Loads .env from repo root automatically.
 */
import path from "path";
import { config } from "dotenv";

// Load root .env when running from worker/
config({ path: path.resolve(__dirname, "../../.env") });

import { ApplyTaskStatus, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TEST_EMAIL = "test-apply@example.com";
const TEST_JOB_URL = "https://reka.ai/careers?ashby_jid=e059e019-b7f1-4ccb-a53b-1db4f821621c";
const TEST_DEDUPE_HASH = "manual-test-" + Date.now();

async function main() {
  const preference = await prisma.preference.upsert({
    where: { email: TEST_EMAIL },
    create: {
      email: TEST_EMAIL,
      title: "Software Engineer",
      location: "Remote",
    },
    update: {},
  });

  const resumeText =
    "Experienced software engineer. Skilled in TypeScript, Node.js, and automated testing. Previously at Acme Corp.";
  let resume = await prisma.resume.findFirst({
    where: { preferenceId: preference.id },
  });
  if (!resume) {
    resume = await prisma.resume.create({
      data: {
        preferenceId: preference.id,
        label: "Default",
        storageKey: "inline",
        rawText: resumeText,
      },
    });
  } else if (!resume.rawText) {
    resume = await prisma.resume.update({
      where: { id: resume.id },
      data: { rawText: resumeText },
    });
  }

  let jobLead = await prisma.jobLead.findFirst({
    where: { dedupeHash: TEST_DEDUPE_HASH },
  });
  if (!jobLead) {
    jobLead = await prisma.jobLead.create({
      data: {
        preferenceId: preference.id,
        title: "Software Engineer",
        company: "Example Corp",
        location: "Remote",
        url: TEST_JOB_URL,
        source: "manual",
        score: 1,
        dedupeHash: TEST_DEDUPE_HASH,
      },
    });
  } else {
    jobLead = await prisma.jobLead.update({
      where: { id: jobLead.id },
      data: { url: TEST_JOB_URL },
    });
  }

  const existing = await prisma.applyTask.findFirst({
    where: { jobLeadId: jobLead.id, status: ApplyTaskStatus.QUEUED },
  });

  if (existing) {
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      level: "info",
      event: "create_test_apply_task.already_queued",
      taskId: existing.id,
      jobLeadId: jobLead.id,
      jobUrl: TEST_JOB_URL,
    }));
    return;
  }

  const task = await prisma.applyTask.create({
    data: {
      jobLeadId: jobLead.id,
      status: ApplyTaskStatus.QUEUED,
    },
  });

  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    level: "info",
    event: "create_test_apply_task.created",
    taskId: task.id,
    jobLeadId: jobLead.id,
    jobUrl: TEST_JOB_URL,
  }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
