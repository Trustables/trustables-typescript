import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { Campaign, CampaignBody, CreateVerificationRequestBody, VerificationRequestResponse, VerificationSessionResponse, SessionStatusResponse, SimulatorInspect, SimulatorResult, OutcomeBody } from './types.js';
export * from './types.js';

export type Environment = 'simulator' | 'sandbox';
export interface ClientOptions {
  baseUrl: string;
  apiKey: string;
  orgId: string;
  environment: Environment;
  timeoutMs?: number;
  /** Only for local HTTP fixtures. HTTPS is otherwise required. */
  allowInsecureLocalhost?: boolean;
}
export class TrustablesError extends Error {
  constructor(public readonly status: number, public readonly detail: unknown, public readonly retryAfter: string | null) {
    super(`Trustables API returned HTTP ${status}`);
    this.name = 'TrustablesError';
  }
}
export class PollTimeoutError extends Error {
  constructor() { super('Session polling deadline reached'); this.name = 'PollTimeoutError'; }
}

/** Server-side API client. Requests never automatically retry or follow redirects. */
export class Trustables {
  private readonly base: string;
  readonly #key: string;
  private readonly orgPath: string;
  private readonly environment: Environment;
  private readonly timeout: number;
  constructor(options: ClientOptions) {
    const url = new URL(options.baseUrl);
    const local = options.allowInsecureLocalhost && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !local) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
      throw new TypeError('baseUrl must be an HTTPS origin (no path, credentials, query or fragment)');
    }
    if (!options.apiKey || /[\r\n]/.test(options.apiKey) || !options.orgId) throw new TypeError('apiKey and orgId are required');
    if (!['simulator', 'sandbox'].includes(options.environment)) throw new TypeError('Unsupported environment');
    this.timeout = options.timeoutMs ?? 10000;
    if (!Number.isFinite(this.timeout) || this.timeout <= 0) throw new TypeError('timeoutMs must be positive');
    this.base = url.origin;
    this.#key = options.apiKey;
    this.orgPath = `/api/v1/rp/orgs/${this.id(options.orgId)}`;
    this.environment = options.environment;
  }
  private async request<T>(method: string, path: string, body?: unknown, capability = false, timeoutMs = this.timeout): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (!capability) {
      headers.Authorization = `Bearer ${this.#key}`;
      headers['X-Trustables-Environment'] = this.environment;
    }
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(this.base + path, {method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual', signal: AbortSignal.timeout(Math.max(1, Math.ceil(timeoutMs)))});
    const text = await response.text();
    let value: unknown;
    try { value = text ? JSON.parse(text) : null; }
    catch { if (response.ok) throw new Error('Trustables returned invalid JSON'); }
    if (!response.ok) {
      const detail = value && typeof value === 'object' && 'detail' in value ? value.detail : null;
      throw new TrustablesError(response.status, detail, response.headers.get('retry-after'));
    }
    return value as T;
  }
  createVerificationRequest(body: CreateVerificationRequestBody): Promise<VerificationRequestResponse> {
    if (this.environment !== 'sandbox') throw new TypeError('Wallet verification requires sandbox; use createSimulatorCampaign for simulator');
    return this.request('POST', `${this.orgPath}/verification-requests`, body);
  }
  createSimulatorCampaign(body: CampaignBody): Promise<Campaign> {
    this.requireSimulator();
    return this.request('POST', `${this.orgPath}/simulator/campaigns`, body);
  }
  createSession(requestId: string): Promise<VerificationSessionResponse> {
    return this.request('GET', `${this.orgPath}/verification-requests/${this.id(requestId)}/session`);
  }
  getSession(sessionId: string): Promise<SessionStatusResponse> {
    return this.request('GET', `${this.orgPath}/sessions/${this.id(sessionId)}/status`);
  }
  /** Use only a simulator capability token, never a hosted-review token. */
  inspectSimulator(token: string): Promise<SimulatorInspect> {
    this.requireSimulator();
    return this.request('POST', '/api/v1/rp/simulator/inspect', {token}, true);
  }
  completeSimulator(token: string, scenario: OutcomeBody['scenario']): Promise<SimulatorResult> {
    this.requireSimulator();
    return this.request('POST', '/api/v1/rp/simulator/complete', {token, scenario}, true);
  }
  async waitForSession(sessionId: string, options: { timeoutMs?: number; intervalMs?: number } = {}): Promise<SessionStatusResponse> {
    const timeout = options.timeoutMs ?? 60000, interval = options.intervalMs ?? 1000;
    if (!Number.isFinite(timeout) || !Number.isFinite(interval) || timeout <= 0 || interval <= 0) throw new TypeError('Polling timeout and interval must be positive');
    const deadline = performance.now() + timeout;
    const path = `${this.orgPath}/sessions/${this.id(sessionId)}/status`;
    while (performance.now() < deadline) {
      let result: SessionStatusResponse;
      try { result = await this.request('GET', path, undefined, false, Math.min(this.timeout, deadline - performance.now())); }
      catch (error) { if (performance.now() >= deadline) throw new PollTimeoutError(); throw error; }
      if (result.status !== 'pending') return result;
      await new Promise(resolve => setTimeout(resolve, Math.min(interval, Math.max(0, deadline - performance.now()))));
    }
    throw new PollTimeoutError();
  }
  private id(value: string): string { if (!value || value === '.' || value === '..') throw new TypeError('Invalid identifier'); return encodeURIComponent(value); }
  private requireSimulator(): void { if (this.environment !== 'simulator') throw new TypeError('Simulator operation requires simulator environment'); }
}

/** Authenticate raw bytes; callers must validate event data and durably deduplicate. */
export function verifyWebhook(secret: string, method: string, path: string, rawBody: Uint8Array, headers: Record<string, string>, options: { now?: number; toleranceSeconds?: number } = {}): boolean {
  const normalized = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  const timestamp = normalized['x-trustables-timestamp'] ?? '', id = normalized['idempotency-key'] ?? '', signature = normalized['x-trustables-signature'] ?? '';
  const now = options.now ?? Date.now() / 1000, tolerance = options.toleranceSeconds ?? 300;
  if (!secret || !id || !/^\d+$/.test(timestamp) || !/^v1=[0-9a-f]{64}$/.test(signature) || !Number.isFinite(now) || !Number.isFinite(tolerance) || tolerance < 0 || Math.abs(now - Number(timestamp)) > tolerance) return false;
  const canonical = ['v1', timestamp, method.toUpperCase(), path, createHash('sha256').update(rawBody).digest('hex'), id].join('\n');
  const expected = createHmac('sha256', secret).update(canonical).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(3), 'hex'));
}
