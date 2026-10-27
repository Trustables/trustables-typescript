import { Trustables } from '../dist/index.js';
export function required(name) {
  if (!process.env[name]) throw new Error(`Set ${name}`);
  return process.env[name];
}
export function client(environment) {
  return new Trustables({baseUrl: required('TRUSTABLES_BASE_URL'), apiKey: required('TRUSTABLES_API_KEY'), orgId: required('TRUSTABLES_ORG_ID'), environment});
}
