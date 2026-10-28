import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { Trustables, TrustablesError, PollTimeoutError, verifyWebhook } from '../dist/index.js';
const cases = JSON.parse(readFileSync(new URL('../contract/simulator-cases.json', import.meta.url)));
const vector = JSON.parse(readFileSync(new URL('../contract/webhook-vector.json', import.meta.url)));
async function server(t, handler, environment = 'simulator') {
  const requests = [];
  const http = createServer(async (req, res) => {
    let body = ''; for await (const part of req) body += part;
    requests.push({method: req.method, path: req.url, headers: req.headers, body: body ? JSON.parse(body) : null});
    const [status, value, headers = {}] = handler(requests.at(-1), requests.length);
    res.writeHead(status, {'Content-Type': 'application/json', ...headers}); res.end(JSON.stringify(value));
  });
  await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => http.close(resolve)));
  return {requests, client: new Trustables({baseUrl: `http://127.0.0.1:${http.address().port}`, apiKey: 'fixture-key', orgId: 'org', environment, allowInsecureLocalhost: true})};
}
for (const fixture of cases) {
  test(`simulator HTTP flow: ${fixture.scenario}`, async t => {
    const campaign = {id: 'campaign', name: 'SDK test', purpose: 'contract test', profile: 'pid', mode: 'simulator', simulated: true};
    const session = {session_id: fixture.result.session_id, authorization_request_url: 'https://assigned.example/review#opaque', expires_at: fixture.result.expires_at, mode: 'simulator', simulated: true, billable: false};
    const {client, requests} = await server(t, req => [200, req.path.endsWith('/campaigns') ? campaign : req.path.endsWith('/session') ? session : fixture.result]);
    assert.deepEqual(await client.createSimulatorCampaign({name: 'SDK test', purpose: 'contract test', profile: 'pid'}), campaign);
    assert.deepEqual(await client.createSession(campaign.id), session);
    assert.deepEqual(await client.completeSimulator('fixture-capability', fixture.scenario), fixture.result);
    assert.deepEqual(await client.getSession(session.session_id), fixture.result);
    assert.equal(requests[0].headers.authorization, 'Bearer fixture-key');
    assert.equal(requests[0].headers['x-trustables-environment'], 'simulator');
    assert.equal(requests[0].path, '/api/v1/rp/orgs/org/simulator/campaigns');
    assert.equal(requests[0].method, 'POST');
    assert.equal(requests[1].path, '/api/v1/rp/orgs/org/verification-requests/campaign/session');
    assert.equal(requests[2].path, '/api/v1/rp/simulator/complete');
    assert.equal(requests[3].path, `/api/v1/rp/orgs/org/sessions/${session.session_id}/status`);
    assert.equal(requests[1].method, 'GET');
    assert.equal(requests[2].headers.authorization, undefined);
    assert.equal(requests[2].headers['x-trustables-environment'], undefined);
    assert.equal(requests[2].body.scenario, fixture.scenario);
    assert.equal(fixture.result.simulated, true);
    assert.equal(fixture.result.billable, false);
    assert.equal(fixture.result.verified_claims, null);
    if (fixture.scenario === 'ineligible') { assert.equal(fixture.result.accepted, true); assert.equal(fixture.result.claims.birth_date, '2026-01-01'); }
  });
}
test('sandbox routes and typed request body use explicit environment', async t => {
  const {client, requests} = await server(t, () => [200, {id: 'request'}], 'sandbox');
  const body = {name: 'Sandbox', purpose: 'Verify age', credential_type: 'PID', policy_profile: 'high', requested_claims: [['age_over_18']], redirect_uri: 'https://app.example/callback'};
  await client.createVerificationRequest(body);
  assert.deepEqual(requests[0].body, body);
  assert.equal(requests[0].headers['x-trustables-environment'], 'sandbox');
  assert.throws(() => client.createSimulatorCampaign({name:'test',purpose:'test'}));
});
for (const status of [401, 403, 409, 422, 429, 503]) {
  test(`HTTP ${status} preserves error and never retries session creation`, async t => {
    const {client, requests} = await server(t, () => [status, {detail: 'fixture-error'}, {'Retry-After': '7'}]);
    await assert.rejects(client.createSession('campaign'), error => error instanceof TrustablesError && error.status === status && error.detail === 'fixture-error' && error.retryAfter === '7' && !error.message.includes('fixture-key'));
    assert.equal(requests.length, 1);
  });
}
test('redirects are not followed; path identifiers cannot inject routes', async t => {
  const {client, requests} = await server(t, () => [302, {}, {Location:'/unexpected'}]);
  await assert.rejects(client.getSession('a/b?c'), error => error.status === 302);
  assert.equal(requests.length, 1); assert.ok(requests[0].path.includes('a%2Fb%3Fc'));
});
test('polls status until terminal and enforces deadline', async t => {
  const {client, requests} = await server(t, (_, count) => [200, count < 2 ? {status:'pending'} : cases[0].result]);
  assert.deepEqual(await client.waitForSession('session', {intervalMs:1}), cases[0].result);
  assert.equal(requests.length, 2);
  const pending = await server(t, () => [200, {status:'pending'}]);
  await assert.rejects(pending.client.waitForSession('session', {timeoutMs:20,intervalMs:2}), PollTimeoutError);
});
test('webhook agrees with backend signer and rejects tampering, replay and malformed values', () => {
  const verify = (body = vector.body, path = vector.path, headers = vector.headers, now = vector.now) => verifyWebhook(vector.secret, vector.method, path, Buffer.from(body), headers, {now});
  assert.equal(verify(), true);
  assert.equal(verify(vector.body + ' '), false);
  assert.equal(verify(vector.body, '/wrong'), false);
  assert.equal(verify(vector.body, vector.path, vector.headers, vector.now + 301), false);
  assert.equal(verify(vector.body, vector.path, {...vector.headers, 'X-Trustables-Signature':'v1=abc'}), false);
  assert.equal(verify(vector.body, vector.path, Object.fromEntries(Object.entries(vector.headers).map(([k,v]) => [k.toLowerCase(),v]))), true);
});
test('rejects invalid configuration', () => {
  for (const baseUrl of ['http://public.example', 'https://user:pass@example.com', 'https://example.com/path', 'https://example.com?x=1']) {
    assert.throws(() => new Trustables({baseUrl, apiKey:'key', orgId:'org', environment:'simulator'}));
  }
});
test('HTTP request timeout aborts a stalled session creation without retry', async t => {
  let calls = 0;
  const http = createServer(() => { calls++; });
  await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
  t.after(() => { http.closeAllConnections(); http.close(); });
  const client = new Trustables({baseUrl:`http://127.0.0.1:${http.address().port}`,apiKey:'fixture-key',orgId:'org',environment:'simulator',allowInsecureLocalhost:true,timeoutMs:30});
  await assert.rejects(client.createSession('campaign'), {name:'TimeoutError'});
  assert.equal(calls, 1);
});

test('widget methods bind sandbox, encode session IDs and preserve QR requests', async t => {
  const {client, requests} = await server(t, () => [200,{status:'pending'}], 'sandbox');
  await client.getWidgetReview('a/b');await client.activateWidget('a/b');await client.getWidgetStatus('a/b');await client.cancelWidget('a/b');await client.createQr('https://merchant.example/handoff#opaque',240);
  assert.deepEqual(requests.map(r=>[r.method,r.path]),[
    ['GET','/api/v1/rp/orgs/org/sessions/a%2Fb/widget'],['POST','/api/v1/rp/orgs/org/sessions/a%2Fb/widget'],
    ['GET','/api/v1/rp/orgs/org/sessions/a%2Fb/widget/status'],['POST','/api/v1/rp/orgs/org/sessions/a%2Fb/widget/cancel'],['POST','/api/v1/rp/orgs/org/qr']]);
  assert.ok(requests.every(r=>r.headers['x-trustables-environment']==='sandbox'));
  assert.equal(requests.at(-1).body.size,240);
  const sim=await server(t,()=>[200,{}]);assert.throws(()=>sim.client.activateWidget('s'));assert.equal(sim.requests.length,0);
});
test('private HTTP requires explicit operator opt-in',()=>{
  const opts={baseUrl:'http://api.internal:8000',apiKey:'test',orgId:'org',environment:'sandbox'};
  assert.throws(()=>new Trustables(opts));assert.throws(()=>new Trustables({...opts,allowInsecureLocalhost:true}));
  new Trustables({...opts,allowInsecureHttp:true});
  assert.throws(()=>new Trustables({...opts,baseUrl:'http://user:password@api.internal',allowInsecureHttp:true}));
});
