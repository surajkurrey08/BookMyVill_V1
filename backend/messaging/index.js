const { EventEmitter } = require('node:events');
const { randomUUID } = require('node:crypto');
const { EVENTS, versionOf, names } = require('../shared/contracts/events');
const { createLogger } = require('../shared/logger');

// RabbitMQ event bus (topic exchange "bookmyvilla.events").
//
// Reliability:
// - durable exchange/queues, persistent messages, publisher confirms
// - manual acks; a failed handler is retried via "<queue>.retry" (message TTL,
//   dead-lettered back to the queue) up to MAX_ATTEMPTS, then parked in
//   "<queue>.dlq" for inspection — nothing is silently lost
// - automatic reconnect with re-binding of consumers; graceful shutdown
// - publish() never throws into request handlers (the business write already
//   committed); failures are logged with the event id
//
// Consumers must be idempotent (deliveries can repeat). Without RABBITMQ_URL
// events are delivered in-process with the same retry semantics.

const logger = createLogger(process.env.SERVICE_NAME || 'messaging').child('bus');
const MAX_ATTEMPTS = Number(process.env.EVENT_MAX_ATTEMPTS) || 5;
const RETRY_DELAY_MS = Number(process.env.EVENT_RETRY_DELAY_MS) || 10000;
const local = new EventEmitter();
local.setMaxListeners(100);
let connection = null, channel = null, connecting = null, closed = false;
const subscriptions = [];

async function connect() {
  if (!process.env.RABBITMQ_URL || closed) return null;
  if (channel) return channel;
  if (connecting) return connecting;
  connecting = (async () => {
    try {
      const amqp = require('amqplib');
      connection = await amqp.connect(process.env.RABBITMQ_URL, { timeout: 5000 });
      connection.on('error', error => logger.warn('RabbitMQ connection error', { error }));
      connection.on('close', () => { channel = null; connection = null; if (!closed) setTimeout(() => connect().catch(() => {}), 5000).unref(); });
      const ch = await connection.createConfirmChannel();
      await ch.assertExchange(EVENTS.EXCHANGE, 'topic', { durable: true });
      await ch.prefetch(Number(process.env.EVENT_PREFETCH) || 20);
      channel = ch;
      for (const sub of subscriptions) await bind(sub);
      logger.info('RabbitMQ connected');
      return ch;
    } catch (error) {
      logger.warn('RabbitMQ unavailable; retrying', { error });
      if (!closed) setTimeout(() => connect().catch(() => {}), 5000).unref();
      return null;
    } finally { connecting = null; }
  })();
  return connecting;
}

function envelope(event, data, requestId) {
  return { id: randomUUID(), event, version: versionOf(event), occurredAt: new Date().toISOString(), requestId, data };
}

async function publish(event, data = {}, { requestId } = {}) {
  const message = envelope(event, data, requestId);
  if (!process.env.RABBITMQ_URL) { setImmediate(() => local.emit(event, message)); return true; }
  try {
    const ch = await connect();
    if (!ch) throw new Error('broker not connected');
    ch.publish(EVENTS.EXCHANGE, event, Buffer.from(JSON.stringify(message)), { persistent: true, contentType: 'application/json', messageId: message.id, type: event });
    await ch.waitForConfirms();
    return true;
  } catch (error) {
    logger.error('event not published', { event, eventId: message.id, error });
    return false;
  }
}

async function bind({ queue, patterns, handler }) {
  await channel.assertQueue(queue, { durable: true });
  await channel.assertQueue(`${queue}.retry`, { durable: true, arguments: { 'x-message-ttl': RETRY_DELAY_MS, 'x-dead-letter-exchange': '', 'x-dead-letter-routing-key': queue } });
  await channel.assertQueue(`${queue}.dlq`, { durable: true });
  for (const pattern of patterns) await channel.bindQueue(queue, EVENTS.EXCHANGE, pattern);
  await channel.consume(queue, async msg => {
    if (!msg) return;
    const attempts = Number(msg.properties.headers?.['x-attempts'] || 0) + 1;
    let message;
    try { message = JSON.parse(msg.content.toString()); }
    catch { channel.sendToQueue(`${queue}.dlq`, msg.content, { persistent: true, headers: { 'x-error': 'invalid JSON' } }); channel.ack(msg); return; }
    try {
      await handler(message);
      channel.ack(msg);
    } catch (error) {
      const target = attempts < MAX_ATTEMPTS ? `${queue}.retry` : `${queue}.dlq`;
      logger.error('event handler failed', { queue, event: message.event, eventId: message.id, attempts, parkedInDlq: target.endsWith('.dlq'), error });
      channel.sendToQueue(target, msg.content, { persistent: true, contentType: 'application/json', messageId: msg.properties.messageId, headers: { 'x-attempts': attempts, 'x-error': String(error.message).slice(0, 200) } });
      channel.ack(msg);
    }
  }, { noAck: false });
}

function topicMatcher(patterns) {
  const regexes = patterns.map(p => new RegExp(`^${p.replace(/\./g, '\\.').replace(/\*/g, '[^.]+').replace(/#/g, '.*')}$`));
  return name => regexes.some(r => r.test(name));
}

// queue: durable queue owned by the consuming service; patterns: e.g. ['payment.success'].
async function subscribe(queue, patterns, handler) {
  const sub = { queue, patterns, handler };
  subscriptions.push(sub);
  if (!process.env.RABBITMQ_URL) {
    const matches = topicMatcher(patterns);
    for (const name of names.filter(matches)) {
      local.on(name, function deliver(message, attempt = 1) {
        Promise.resolve().then(() => handler(message)).catch(error => {
          logger.error('event handler failed', { queue, event: name, eventId: message.id, attempts: attempt, error });
          if (attempt < MAX_ATTEMPTS) setTimeout(() => deliver(message, attempt + 1), Math.min(RETRY_DELAY_MS, 50 * 2 ** attempt)).unref();
        });
      });
    }
    return;
  }
  if (await connect()) await bind(sub);
}

// null when RabbitMQ is not configured; true/false when it is.
function brokerReady() { return process.env.RABBITMQ_URL ? Boolean(channel) : null; }

async function closeBroker() {
  closed = true;
  try { await channel?.close(); await connection?.close(); } catch { /* already closed */ }
  channel = null; connection = null;
}

module.exports = { events: EVENTS, publish, subscribe, connectBroker: connect, brokerReady, closeBroker };
