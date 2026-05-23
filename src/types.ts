/**
 * types.ts — tipos compartilhados do verifier.
 * Espelham os JSON Schemas em /schemas. Ver concept.md Secao 14.
 */

export type ErrorCode =
  | "AEIR_SCHEMA_INVALID"
  | "AEIR_REQUIRED_FIELD_MISSING"
  | "HASH_MISMATCH"
  | "SIGNATURE_INVALID"
  | "SIGNATURE_KEY_REVOKED"
  | "MERKLE_ROOT_MISMATCH"
  | "MERKLE_PROOF_INVALID"
  | "DECISION_ID_RECOMPUTE_FAILED"
  | "POLICY_HASH_UNRESOLVED"
  | "MODEL_HASH_UNRESOLVED"
  | "CONTROL_WITHOUT_EVIDENCE"
  | "REDACTION_POLICY_VIOLATED"
  | "UNKNOWN_SYSTEM"
  | "EVENT_OUT_OF_SCOPE"
  | "DUPLICATE_EVENT"
  | "ORPHAN_EVENT"
  | "REPORT_DERIVATION_FAILED"
  | "SCHEMA_DOWNGRADE_ATTEMPT"
  | "RAW_EVIDENCE_UNRESOLVED";

export type Severity = "blocking" | "warning" | "info";

export interface VerificationException {
  code: ErrorCode;
  severity: Severity;
  evidence_ref?: string;
  message: string;
}

export interface VerificationResult {
  status: "pass" | "fail";
  root_hash_verified: boolean;
  signatures_verified: boolean;
  schema_valid: boolean;
  decision_ids_recomputed: boolean;
  merkle_chain_valid: boolean;
  policy_hashes_resolved: boolean;
  model_hashes_resolved: boolean;
  redaction_policy_valid: boolean;
  report_derivation_valid: boolean;
  exceptions: VerificationException[];
}

export interface ManifestArtifact {
  path: string;
  hash: string;
  derived?: boolean;
}

export interface AuditPackageManifest {
  manifest_version: string;
  package_id: string;
  created_at: string;
  merkle_root: string;
  hash_algorithm: "SHA-256";
  tree_size?: number;
  artifacts: ManifestArtifact[];
  signature: string;
}

export interface AuditEvidenceRecord {
  schema_version: string;
  event_id: string;
  event_type: string;
  system: string;
  occurred_at: string;
  trace_id?: string;
  span_id?: string;
  actor?: { type: string; id: string };
  subject?: { type: string; hash?: string };
  jurisdiction?: string;
  payload_hash: string;
  previous_event_hash?: string;
  signature?: string;
}
