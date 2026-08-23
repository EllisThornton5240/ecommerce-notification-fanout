import assert from "node:assert/strict";
import test from "node:test";
import { fanoutRequestSchema, notificationsFor } from "../src/fanout_policy.js";

test("a receipt is queued only for receipt subscribers", () => {
  const input = fanoutRequestSchema.parse({
    eventId: "evt-1042-receipt",
    eventType: "receipt",
    orderId: "order-1042",
    occurredAt: "2026-08-13T09:30:00.000Z",
    subscribers: [
      { customerId: "buyer-7", destination: "buyer@example.com", events: ["receipt", "fulfillment"] },
      { customerId: "ops-2", destination: "ops@example.com", events: ["fulfillment"] },
    ],
  });

  assert.deepEqual(notificationsFor(input), [{
    eventId: "evt-1042-receipt",
    eventType: "receipt",
    orderId: "order-1042",
    occurredAt: "2026-08-13T09:30:00.000Z",
    customerId: "buyer-7",
    destination: "buyer@example.com",
  }]);
});
