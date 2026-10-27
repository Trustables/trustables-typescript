import { client } from './config.mjs';
const api = client('simulator');
const campaignId = process.env.TRUSTABLES_CAMPAIGN_ID || (await api.createSimulatorCampaign({name:'SDK example',purpose:'Test integration outcomes',profile:'pid'})).id;
console.log('Save campaign ID for reuse:', campaignId);
const session = await api.createSession(campaignId);
if (!session.simulated || session.mode !== 'simulator' || session.billable !== false) throw new Error('Unexpected environment');
// Capability-bearing URL: show only to the person completing this test; never log in production.
console.log('Open privately in your browser and complete the hosted flow:', session.authorization_request_url);
const result = await api.waitForSession(session.session_id, {timeoutMs: 300000});
console.log({sessionId: result.session_id, status: result.status, simulated: result.simulated});
// accepted=true does not establish business eligibility; apply your own policy.
