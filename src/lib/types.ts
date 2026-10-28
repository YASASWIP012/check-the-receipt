export interface Attestation {
  algorithm: string;
  key_id: string;
  key_url: string;
  payload_hash: string;
  signature: string;
  signed_at_utc: string;
}

export interface ReceiptMetadata {
  app?: { legal_entity?: string; platform_name?: string };
  attestation?: Attestation;
  contributor?: {
    account_verification_status?: string;
    anon_id?: string;
    kyc_status?: string;
    kyc_country?: string;
    geo_region?: string;
    consent?: {
      tos_version?: string;
      tos_uri?: string;
      tos_hash?: string;
      privacy_policy_version?: string;
      privacy_policy_uri?: string;
      privacy_policy_hash?: string;
    };
  };
  file?: {
    media_category?: string;
    mime_type?: string;
    size_bytes?: number;
    content_sha256?: string;
    behavior?: { captured_via?: string; client_version?: string };
  };
  timestamps?: { captured_at?: string; uploaded_at?: string; occurred_at?: string };
  schema_version?: string;
  [key: string]: unknown;
}

export interface TraceReceipt {
  data_id: string;
  source_record_id: string;
  provider: string;
  initial_metadata_root: string;
  initial_metadata_json: ReceiptMetadata;
  occurred_at: string;
  ingested_at: string;
  current_seq: number;
  updates: unknown[];
  tx_hash: string | null;
}

export interface Jwk {
  kty: string;
  crv: string;
  x: string;
  y: string;
  kid?: string;
  alg?: string;
}

export interface AnchorTx {
  hash: string;
  rawInput: string;
  blockNumber: number | null;
  timestamp: string | null;
  method: string | null;
  status: string | null;
}

export interface ActivityEvent {
  id: string;
  kind: string;
  provider: string;
  data_id: string;
  source_record_id: string;
  at: string;
  ingested_at: string;
}

export type CheckStatus = "pass" | "mismatch" | "waiting" | "unavailable";

export interface CheckResult {
  status: CheckStatus;
  // Raw values for the "show the bytes" panel.
  evidence: Record<string, string>;
}
