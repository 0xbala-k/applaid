import "dotenv/config";
import cron from "node-cron";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runDiscoveryAndQueue() {
  const preferences = await prisma.preference.findMany();

  console.log(
    `[worker] Running discovery for ${preferences.length} preference profile(s) at ${new Date().toISOString()}`
  );

  // Placeholder: here you would call Tavily, Yutori, Gmail MCP, etc.
  // For now we just log the preferences that would drive the search.
  for (const pref of preferences) {
    console.log(
      `[worker] Preference: ${pref.email} | ${pref.title ?? "any title"} | ${
        pref.location ?? "anywhere"
      } | min $${pref.minSalary ?? "n/a"} | keywords=${pref.keywords ?? ""}`
    );
  }
}

async function bootstrap() {
  console.log("[worker] Starting cron worker");

  // Run once on boot
  await runDiscoveryAndQueue();

  // Then every hour, aligned with your README
  cron.schedule("0 * * * *", async () => {
    await runDiscoveryAndQueue();
  });
}

bootstrap().catch((err) => {
  console.error("[worker] Fatal error", err);
  process.exit(1);
});

