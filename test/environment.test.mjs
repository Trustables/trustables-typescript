import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Environment, parseEnvironment, Trustables } from '../dist/index.js';
test('typed environments validate configuration and preserve supported strings', () => {
  for (const value of Object.values(Environment)) assert.equal(parseEnvironment(value), value);
  for (const value of [undefined, null, {}, [], '', 'Simulator', 'sandbx']) {
    assert.throws(() => parseEnvironment(value), /Invalid environment/);
    assert.throws(() => new Trustables({baseUrl:'https://api.example', apiKey:'fixture', orgId:'org', environment:value}), /Invalid environment/);
  }
  for (const value of [Environment.SIMULATOR, Environment.SANDBOX, 'simulator', 'sandbox'])
    new Trustables({baseUrl:'https://api.example', apiKey:'fixture', orgId:'org', environment:value});
  assert.throws(() => new Trustables({baseUrl:'https://api.example', apiKey:'fixture', orgId:'org', environment:Environment.PRODUCTION}), /Production is not supported/);
});
