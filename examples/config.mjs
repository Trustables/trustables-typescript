import { Trustables, parseEnvironment } from '../dist/index.js';
export function required(name) {
  if (!process.env[name]) throw new Error(`Set ${name}`);
  return process.env[name];
}
export function client(environment) {
  const configured = parseEnvironment(process.env.TRUSTABLES_ENVIRONMENT ?? environment);
  if (configured !== environment) throw new Error('TRUSTABLES_ENVIRONMENT must match the selected example');
  return new Trustables({baseUrl: process.env.TRUSTABLES_BASE_URL, apiKey: required('TRUSTABLES_API_KEY'), orgId: required('TRUSTABLES_ORG_ID'), environment: configured});
}
