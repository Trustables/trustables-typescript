import { verifyWebhook } from '../dist/index.js';
// Call from your HTTP handler BEFORE parsing JSON. Pass normalized string headers.
export function authenticateEvent(rawBody, headers, secret) {
  if (!verifyWebhook(secret, 'POST', '/webhooks/trustables', rawBody, headers)) throw new Error('Invalid webhook');
  const event = JSON.parse(Buffer.from(rawBody).toString('utf8'));
  // Before returning 2xx: validate event/organisation/session, durably record and
  // deduplicate Idempotency-Key. Never treat a Simulator event as identity evidence.
  return event;
}
