import * as amqp from "amqplib";
import {
  APPROVED_ORDERS_STATUS_CHANGE_ROUTING_KEY,
  ORDERS_EVENTS_EXCHANGE,
  ORDERS_ORDER_CREATED_V1,
  parseOrdersLifecycleEvent
} from "./order-lifecycle-events";
import { logDecision } from "./logger";
import { getStore, MarketingStore } from "./store";

type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>;
type AmqpChannel = Awaited<ReturnType<AmqpConnection["createChannel"]>>;

export interface OrdersEventsConsumerOptions {
  enabled: boolean;
  rabbitmqUrl?: string;
  exchange: string;
  queue: string;
  routingKeys: string[];
  deadLetterExchange: string;
  prefetch: number;
  requeueOnError: boolean;
}

export interface OrdersEventsConsumerController {
  close(): Promise<void>;
}

export interface OrdersEventMessageResult {
  accepted: boolean;
  duplicate: boolean;
  rejected: boolean;
  reason?: string;
  eventId?: string;
  eventType?: string;
  orderId?: string;
}

export function ordersEventsConsumerOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): OrdersEventsConsumerOptions {
  return {
    enabled: env.ORDERS_EVENTS_CONSUMER_ENABLED === "true",
    rabbitmqUrl: env.RABBITMQ_URL,
    exchange: env.ORDERS_EVENTS_EXCHANGE || ORDERS_EVENTS_EXCHANGE,
    queue: env.ORDERS_EVENTS_QUEUE || "marketing.orders.lifecycle",
    routingKeys: parseRoutingKeys(env.ORDERS_EVENTS_ROUTING_KEYS),
    deadLetterExchange: env.ORDERS_EVENTS_DEAD_LETTER_EXCHANGE || "marketing.orders.lifecycle.dlx",
    prefetch: positiveInteger(env.ORDERS_EVENTS_PREFETCH, 10),
    requeueOnError: env.ORDERS_EVENTS_REQUEUE_ON_ERROR === "true"
  };
}

export async function processOrdersEventMessage(
  content: Buffer | string,
  store: MarketingStore,
  receivedAt = new Date().toISOString()
): Promise<OrdersEventMessageResult> {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(Buffer.isBuffer(content) ? content.toString("utf8") : content);
  } catch {
    return { accepted: false, duplicate: false, rejected: true, reason: "invalid_order_event_json" };
  }

  const parsed = parseOrdersLifecycleEvent(parsedJson);
  if (!parsed.ok) {
    return { accepted: false, duplicate: false, rejected: true, reason: parsed.reason };
  }

  const stored = await store.recordOrdersLifecycleEvent(parsed.signal, receivedAt);
  return {
    accepted: stored.accepted,
    duplicate: stored.duplicate,
    rejected: false,
    eventId: parsed.signal.eventId,
    eventType: parsed.signal.eventType,
    orderId: parsed.signal.orderId
  };
}

export async function startOrdersEventsConsumer(
  store: MarketingStore = getStore(),
  options: OrdersEventsConsumerOptions = ordersEventsConsumerOptionsFromEnv()
): Promise<OrdersEventsConsumerController | null> {
  if (!options.enabled) {
    logDecision("orders_events_consumer_disabled", {
      exchange: options.exchange,
      queue: options.queue,
      routingKeys: options.routingKeys,
      duration_ms: 0
    });
    return null;
  }

  if (!options.rabbitmqUrl) {
    logDecision("orders_events_consumer_not_started", {
      exchange: options.exchange,
      queue: options.queue,
      reason: "rabbitmq_url_missing",
      duration_ms: 0
    });
    return null;
  }

  const connection = await amqp.connect(options.rabbitmqUrl);
  const channel = await connection.createChannel();
  await channel.assertExchange(options.exchange, "topic", { durable: true });
  await channel.assertExchange(options.deadLetterExchange, "fanout", { durable: true });
  await channel.assertQueue(options.queue, {
    durable: true,
    arguments: {
      "x-dead-letter-exchange": options.deadLetterExchange
    }
  });
  for (const routingKey of options.routingKeys) {
    await channel.bindQueue(options.queue, options.exchange, routingKey);
  }
  await channel.prefetch(options.prefetch);
  await channel.consume(options.queue, async (message) => {
    if (!message) return;
    try {
      const result = await processOrdersEventMessage(message.content, store);
      logDecision(result.rejected ? "orders_lifecycle_event_rejected" : "orders_lifecycle_event_consumed", {
        exchange: options.exchange,
        queue: options.queue,
        routingKey: message.fields.routingKey,
        eventId: result.eventId ?? null,
        eventType: result.eventType ?? null,
        orderRef: result.orderId ? `orders:order:${result.orderId}` : null,
        accepted: result.accepted,
        duplicate: result.duplicate,
        reason: result.reason ?? null,
        duration_ms: 0
      });
      channel.ack(message);
    } catch (error) {
      logDecision("orders_lifecycle_event_processing_failed", {
        exchange: options.exchange,
        queue: options.queue,
        routingKey: message.fields.routingKey,
        reason: (error as Error).message,
        requeue: options.requeueOnError,
        duration_ms: 0
      });
      channel.nack(message, false, options.requeueOnError);
    }
  });

  logDecision("orders_events_consumer_started", {
    exchange: options.exchange,
    queue: options.queue,
    routingKeys: options.routingKeys,
    deadLetterExchange: options.deadLetterExchange,
    prefetch: options.prefetch,
    duration_ms: 0
  });

  return {
    async close(): Promise<void> {
      await channel.close();
      await connection.close();
    }
  };
}

function parseRoutingKeys(value: string | undefined): string[] {
  const parsed = (value || `${ORDERS_ORDER_CREATED_V1},${APPROVED_ORDERS_STATUS_CHANGE_ROUTING_KEY}`)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return Array.from(new Set(parsed));
}

function positiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
