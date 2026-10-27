// Opt-in live acceptance. Requires a person to select outcomes in the hosted UI.
import assert from 'node:assert/strict';
import { client, required } from './config.mjs';
const api = client('simulator');
const campaignId = required('TRUSTABLES_CAMPAIGN_ID');
for (const [scenario, status, accepted] of [['approved','completed',true],['consent_rejected','failed',false],['missing_attributes','failed',false],['ineligible','completed',true],['timeout','expired',false]]) {
  const session = await api.createSession(campaignId);
  console.log(`Open privately and select ${scenario}:`, session.authorization_request_url);
  const result = await api.waitForSession(session.session_id, {timeoutMs:300000});
  assert.equal(result.session_id, session.session_id);
  assert.equal(result.status, status); assert.equal(result.accepted, accepted);
  assert.equal(result.mode, 'simulator'); assert.equal(result.simulated, true);
  assert.equal(result.billable, false); assert.equal(result.verified_claims, null);
  assert.equal(result.trust_status, 'not_evaluated');
  if (!accepted) assert.equal(result.failure_reason, scenario);
  if (scenario === 'missing_attributes') assert.equal(result.claims?.birth_date, undefined);
  if (scenario === 'ineligible') assert.equal(result.claims?.birth_date, new Date().toISOString().slice(0, 10));
  console.log(`Passed ${scenario}`);
}
