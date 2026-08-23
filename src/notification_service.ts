import { createServer } from "node:http";
import { ZodError } from "zod";
import { fanoutRequestSchema, notificationsFor } from "./fanout_policy.js";
import { InfraiError, infrai } from "./infrai_queue.js";

const port = Number(process.env.PORT ?? 3000);

async function readJson(request: AsyncIterable<unknown>): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk as Uint8Array));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  if (request.method !== "POST" || request.url !== "/notifications/fanout") {
    response.writeHead(404).end(JSON.stringify({ error: "route not found" }));
    return;
  }

  try {
    const input = fanoutRequestSchema.parse(await readJson(request));
    const notifications = notificationsFor(input);
    await Promise.all(notifications.map((notification) =>
      infrai.queue.publish(notification, `${input.eventId}:${notification.customerId}`),
    ));
    response.writeHead(202).end(JSON.stringify({
      eventId: input.eventId,
      queued: notifications.length,
    }));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      response.writeHead(400).end(JSON.stringify({ error: "invalid request body" }));
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      response.writeHead(status).end(JSON.stringify({ error: error.code }));
      return;
    }
    response.writeHead(500).end(JSON.stringify({ error: "internal error" }));
  }
});

server.listen(port, () => console.log(`notification service listening on :${port}`));
