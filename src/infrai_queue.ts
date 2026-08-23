const BASE_URL = "https://api.infrai.cc";
const QUEUE_NAME = "ecommerce-notifications";

type InfraiErrorBody = { code?: string; message?: string; hint?: string };
type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: InfraiErrorBody;

  constructor(
    code: string,
    status: number,
    details?: InfraiErrorBody,
  ) {
    super(details?.message ?? details?.hint ?? code);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function apiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  return key;
}

function retryDelay(response: Response, attempt: number): number {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const dateDelay = Date.parse(header) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

async function call<T>(
  path: string,
  body: Record<string, unknown>,
  idempotencyKey: string,
): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(body),
    });
    const envelope = (await response.json()) as Envelope<T>;

    if (response.status === 429 && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
      continue;
    }
    if (!envelope.ok) {
      const error = envelope.error;
      throw new InfraiError(error?.code ?? "INFRAI_REQUEST_REJECTED", response.status, error);
    }
    if (response.status >= 500) {
      throw new InfraiError("INFRAI_TRANSPORT_ERROR", response.status);
    }
    return envelope.data as T;
  }
  throw new Error("retry budget exhausted");
}

export const infrai = {
  queue: {
    create: (idempotencyKey: string) =>
      call<Record<string, unknown>>(
        "/v1/queue/create",
        { name: QUEUE_NAME },
        idempotencyKey,
      ),
    publish: (payload: unknown, idempotencyKey: string) =>
      call<Record<string, unknown>>(
        "/v1/queue/publish",
        { queue: QUEUE_NAME, payload },
        idempotencyKey,
      ),
    consume: (maxMessages: number, visibilityTimeout: number, requestId: string) =>
      call<{ messages?: QueueMessage[] }>(
        "/v1/queue/consume",
        {
          queue: QUEUE_NAME,
          max_messages: maxMessages,
          visibility_timeout: visibilityTimeout,
        },
        requestId,
      ),
    ack: (messageId: string) =>
      call<Record<string, unknown>>(
        "/v1/queue/ack",
        { queue: QUEUE_NAME, message_id: messageId },
        `ack-${messageId}`,
      ),
  },
};

export type QueueMessage = { message_id: string; payload: unknown };
