// Generated from contract/openapi.json; do not edit.

export interface CreateVerificationRequestBody {
  name: string;
  purpose: string;
  credential_type: string;
  policy_profile: string;
  expires_at?: string | null;
  callback_mode?: string;
  redirect_uri: string;
  registration_certificate_id?: string | null;
  requested_claims: Array<Array<unknown>>;
  rp_service_id?: string | null;
  rp_instance_id?: string | null;
}

export interface VerificationRequestResponse {
  id: string;
  name: string;
  purpose: string;
  credential_type: string;
  policy_profile: string;
  expires_at: string | null;
  callback_mode: string;
  active: boolean;
  published_assets: Record<string, unknown>;
  intended_use_identifier?: string | null;
  requested_claims?: Array<Array<unknown>> | null;
  rp_service_id?: string | null;
  rp_instance_id?: string | null;
}

export interface VerificationSessionResponse {
  session_id: string;
  authorization_request_url: string;
  request_uri?: string | null;
  state?: string | null;
  nonce?: string | null;
  expires_at: string;
  transaction_id?: string | null;
  mode?: string;
  simulated?: boolean;
  billable?: boolean | null;
  branded_verification_page?: boolean;
  branded_qr_code?: boolean;
}

export interface SessionStatusResponse {
  status: string;
  session_id: string;
  created_at?: string | null;
  expires_at?: string | null;
  submission_id?: string | null;
  accepted?: boolean | null;
  failure_reason?: string | null;
  verified_claims?: Record<string, unknown> | null;
  mode?: string;
  simulated?: boolean;
  billable?: boolean | null;
  claims?: Record<string, unknown> | null;
  verification_status?: string | null;
  trust_status?: string | null;
}

export interface Error {
  detail?: unknown;
}

export interface CampaignBody {
  name: string;
  purpose: string;
  profile?: "pid" | "mdl";
}

export interface Campaign {
  id: string;
  name: string;
  purpose: string;
  profile: "pid" | "mdl";
  mode: "simulator";
  simulated: true;
}

export interface TokenBody {
  token: string;
}

export interface OutcomeBody {
  token: string;
  scenario: "approved" | "consent_rejected" | "missing_attributes" | "ineligible" | "timeout";
}

export interface SimulatorInspect {
  status: "pending" | "completed" | "failed" | "expired";
  session_id: string;
  created_at?: string | null;
  expires_at?: string | null;
  submission_id?: string | null;
  accepted?: boolean | null;
  failure_reason?: string | null;
  verified_claims?: null;
  mode: "simulator";
  simulated: true;
  billable: false;
  claims?: Record<string, unknown> | null;
  verification_status?: "simulated_pending" | "simulated_approved" | "simulated_failed";
  trust_status?: "not_evaluated";
  campaign: Campaign;
  preview_claims: Record<string, unknown>;
}

export interface SimulatorResult {
  status: "pending" | "completed" | "failed" | "expired";
  session_id: string;
  created_at?: string | null;
  expires_at?: string | null;
  submission_id?: string | null;
  accepted?: boolean | null;
  failure_reason?: string | null;
  verified_claims?: null;
  mode: "simulator";
  simulated: true;
  billable: false;
  claims?: Record<string, unknown> | null;
  verification_status?: "simulated_pending" | "simulated_approved" | "simulated_failed";
  trust_status?: "not_evaluated";
}
