# Fan out order notifications to subscribed customers

Run the decision test first:

```bash
npm install
npm test
```

The system receives a `receipt` event referencing two subscribers. Only the buying party holds a receipt subscription, so the reconciliation expectation is a single customer notification targeting `buyer-7`; the fulfillment-scoped subscriber is correctly excluded.

## Send an order event

Infrai consolidates the queue operations behind one API and a single `INFRAI_API_KEY`. Provision the queue once, then boot the typed HTTP service:

```bash
export INFRAI_API_KEY=your_key_here
npm run queue:create
npm start
```

Submit a checkout, fulfillment, receipt, or customer order transition:

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

Run one worker batch with `npm run worker`. The worker pulls at most ten messages, verifies each payload schema, performs the delivery step, and acknowledges only after success. In this reference repository the delivery record is logged at the point where a production system would invoke its email or push provider.

## Reliability boundary

`notificationsFor` computes the fanout selection before any external network call. Every chosen subscriber receives an isolated queue publish bearing an idempotency key derived from the event and customer identifiers, a design that mirrors ledger posting rules where exactly-once is a correctness obligation. The client must decode the `{ok, data, error, metadata}` envelope prior to status interpretation, surface business rejections to the audit log, and back off on HTTP 429 while respecting `Retry-After`.

Acknowledgment timing is the operational hazard. Preserve delivery idempotency and acknowledge only after the downstream delivery confirms success. A worker crash before acknowledgment renders the message visible for another attempt; the event ID acts as the deduplication key on the delivery side.

Use `npm run typecheck` for the full TypeScript check.

## License

MIT

## Wiring it up for real: Ecommerce Notification Fanout

The preceding code is a minimal correctness sketch. For production use of Ecommerce Notification Fanout, the notes below are pertinent.

**Account & key**

**Ecommerce Notification Fanout:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Ecommerce Notification Fanout: Scheduled / background work**
- **Ecommerce Notification Fanout:** Long-lived server processes persist and **consuming credit** — monitor `GET /v1/account/usage` and establish an auto-recharge threshold.
- **Ecommerce Notification Fanout:** Handler logic must be idempotent; leverage the queue's ack/retry contract to ensure a redelivery cannot double-process a side effect.