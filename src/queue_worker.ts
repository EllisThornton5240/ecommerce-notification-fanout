import { fanoutRequestSchema } from "./fanout_policy.js";
import { infrai } from "./infrai_queue.js";

const notificationSchema = fanoutRequestSchema.omit({ subscribers: true }).extend({
  customerId: fanoutRequestSchema.shape.subscribers.element.shape.customerId,
  destination: fanoutRequestSchema.shape.subscribers.element.shape.destination,
});

async function deliver(payload: unknown): Promise<void> {
  const notification = notificationSchema.parse(payload);
  console.log(JSON.stringify({
    delivered: true,
    eventId: notification.eventId,
    customerId: notification.customerId,
    eventType: notification.eventType,
  }));
}

async function run(): Promise<void> {
  const batch = await infrai.queue.consume(10, 30, `consume-${Date.now()}`);
  for (const message of batch.messages ?? []) {
    await deliver(message.payload);
    await infrai.queue.ack(message.message_id);
  }
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
