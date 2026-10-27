import { readFileSync } from 'node:fs';
import { client, required } from './config.mjs';
const api = client('sandbox');
// Use permitted claims, an approved redirect and your provisioned certificate/instance IDs.
const body = JSON.parse(readFileSync(required('TRUSTABLES_REQUEST_FILE'), 'utf8'));
const request = await api.createVerificationRequest(body);
const session = await api.createSession(request.id);
if (session.simulated || session.mode !== 'wallet') throw new Error('Unexpected environment');
console.log('Open privately with your test wallet:', session.authorization_request_url);
const result = await api.waitForSession(session.session_id, {timeoutMs:300000});
console.log({sessionId: result.session_id, status: result.status, accepted: result.accepted});
// Validate verified_claims and your business policy; these remain test credentials.
