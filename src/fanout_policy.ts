import { z } from "zod";

export const eventTypes = ["checkout", "fulfillment", "receipt", "order_update"] as const;

export const fanoutRequestSchema = z.object({
  eventId: z.string().min(1),
  eventType: z.enum(eventTypes),
  orderId: z.string().min(1),
  occurredAt: z.string().datetime(),
  subscribers: z.array(z.object({
    customerId: z.string().min(1),
    destination: z.string().email(),
    events: z.array(z.enum(eventTypes)),
  })).max(1000),
});

export type FanoutRequest = z.infer<typeof fanoutRequestSchema>;

export type CustomerNotification = {
  eventId: string;
  eventType: FanoutRequest["eventType"];
  orderId: string;
  occurredAt: string;
  customerId: string;
  destination: string;
};

export function notificationsFor(input: FanoutRequest): CustomerNotification[] {
  return input.subscribers
    .filter((subscriber) => subscriber.events.includes(input.eventType))
    .map((subscriber) => ({
      eventId: input.eventId,
      eventType: input.eventType,
      orderId: input.orderId,
      occurredAt: input.occurredAt,
      customerId: subscriber.customerId,
      destination: subscriber.destination,
    }));
}
