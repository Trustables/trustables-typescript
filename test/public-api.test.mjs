import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Trustables } from '../dist/index.js';

test('default origin and override preserve the environment and authenticated versioned route', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({url, init});
    return new Response('{"status":"pending"}', {status: 200});
  });
  for (const environment of ['simulator', 'sandbox']) {
    for (const baseUrl of [undefined, 'https://api.dev.trustables.de']) {
      const client = new Trustables({apiKey: 'fixture', orgId: 'org', environment, baseUrl});
      await client.getSession('session');
      const {url, init} = calls.at(-1);
      assert.equal(url, `${baseUrl ?? 'https://api.trustables.de'}/v1/rp/orgs/org/sessions/session/status`);
      assert.equal(init.headers.Authorization, 'Bearer fixture');
      assert.equal(init.headers['X-Trustables-Environment'], environment);
      assert.equal(init.redirect, 'manual');
    }
  }
});
