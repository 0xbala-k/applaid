import cron from "node-cron";
import { discover_and_queue } from "./discover_and_queue";
import { apply_and_update } from "./apply_and_update";

async function bootstrap() {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "info",
      event: "worker.bootstrap_start",
    }),
  );

  // Run both on boot
  await discover_and_queue();
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "info",
      event: "worker.bootstrap_apply_start",
    }),
  );
  await apply_and_update();

  // Discover new jobs every hour
  cron.schedule("0 * * * *", async () => {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "info",
        event: "worker.cron_tick_discover",
      }),
    );

    await discover_and_queue();
  });

  // Process queued applications every 10 minutes
  cron.schedule("*/10 * * * *", async () => {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "info",
        event: "worker.cron_tick_apply",
      }),
    );

    await apply_and_update();
  });

  // Optional: HTTP server for demo trigger (dashboard "Run worker" button)
  const triggerPort = process.env.WORKER_TRIGGER_PORT;
  if (triggerPort) {
    const http = await import("node:http");
    const server = http.createServer(async (req, res) => {
      if (req.method === "POST" && req.url === "/trigger") {
        try {
          await discover_and_queue();
          await apply_and_update();
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(
            JSON.stringify({
              ts: new Date().toISOString(),
              level: "error",
              event: "worker.trigger_error",
              error: message,
            }),
          );
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: message }));
        }
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    server.listen(Number(triggerPort), () => {
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          level: "info",
          event: "worker.trigger_server_listen",
          port: Number(triggerPort),
        }),
      );
    });
  }
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
