import cron from "node-cron";
import { discover_and_queue } from "./discover_and_queue";

async function bootstrap() {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "info",
      event: "worker.bootstrap_start",
    }),
  );

  // Run once on boot
  await discover_and_queue();

  // Then every hour, aligned with the README
  cron.schedule("0 * * * *", async () => {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "info",
        event: "worker.cron_tick",
      }),
    );

    await discover_and_queue();
  });
}

bootstrap().catch((err: unknown) => {
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "error",
      event: "worker.fatal",
      error:
        err instanceof Error
          ? { message: err.message, stack: err.stack }
          : { message: String(err) },
    }),
  );
  process.exit(1);
});
