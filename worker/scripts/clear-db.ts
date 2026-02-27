/**
 * Delete all data from the database (keeps schema).
 * Run from repo root:  npm run db:clear  (or  cd worker && npm run db:clear)
 */
import path from "path";
import { config } from "dotenv";

config({ path: path.resolve(__dirname, "../../.env") });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Delete in order of foreign keys: EmailEvent → ApplyTask → JobLead, Resume → Preference
  const deleted = {
    emailEvents: await prisma.emailEvent.deleteMany(),
    applyTasks: await prisma.applyTask.deleteMany(),
    jobLeads: await prisma.jobLead.deleteMany(),
    resumes: await prisma.resume.deleteMany(),
    preferences: await prisma.preference.deleteMany(),
  };
  console.log("Deleted:", deleted);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
