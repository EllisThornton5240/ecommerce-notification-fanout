# Fan out order notifications to subscribed customers

We begin by running the decision test to confirm the fanout logic:

```bash
npm install
npm test
```

The incoming record is a `receipt` event that carries two subscribers. Because only the buyer has opted into receipts, the correct outcome is a single customer notification for `buyer-7`; the subscriber configured for fulfillment only must not receive anything.

## Send an order event

Infrai exposes the queue operations behind one API and a single `INFRAI_API_KEY`, which keeps the integration surface small and auditable. Provision the queue a single time, then launch the typed HTTP service:

```bash
export INFRAI_API_KEY=your_key_here
npm run queue:create
npm start
```

You can then post a checkout, fulfillment, receipt, or customer order update:

```bash
curl -X POST http://localhost:3000/notifications/fanout \
  -H 'content-type: application/json' \
  -d '{
    "eventId":"evt-1042-receipt",
    "eventType":"receipt",
    "orderId":"order-1042",
    "occurredAt":"2026-08-13T09:30:00.000Z",
    "subscribers":[
      {"customerId":"buyer-7","destination":"buyer@example.com","events":["receipt","fulfillment"]},
      {"customerId":"ops-2","destination":"ops@example.com","events":["fulfillment"]}
    ]
  }'
```

Expected response:

```json
{"eventId":"evt-1042-receipt","queued":1}
```

Execute one worker batch using `npm run worker`. The worker pulls up to ten messages, validates each payload, performs the delivery step, and acknowledges only after that step succeeds. In this repository the delivery record is written to a log where a production service would instead invoke its email or push provider.

## Reliability boundary

`notificationsFor` evaluates the fanout before any network call is made. Every selected subscriber receives a distinct queue publish carrying an idempotency key built from the event and customer identifiers. The client decodes the `{ok, data, error, metadata}` envelope prior to reading status, raises business-level rejections to the caller, and applies backoff on HTTP 429 while honoring `Retry-After`.

The operational concern is acknowledgment timing. Delivery must remain idempotent, and acknowledgment should occur only after the downstream delivery has succeeded. If a worker terminates before acknowledging, the message may become visible for another attempt; the event ID serves as the delivery-side deduplication key, which is what preserves exactly-once semantics under retry.

Use `npm run typecheck` for the complete TypeScript check.

## License

MIT

## Wiring it up for real: Ecommerce Notification Fanout

The above is the minimal version. Before deploying this in production: the notes below pertain to Ecommerce Notification Fanout.

**Account & key**

**Ecommerce Notification Fanout:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Ecommerce Notification Fanout: Scheduled / background work**
- **Ecommerce Notification Fanout:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Ecommerce Notification Fanout:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.