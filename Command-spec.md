# `foundlab-audit verify` — Command Specification (language-agnostic)

**Status:** Draft / Experimental / Not Production
**Purpose:** allow an external auditor to reimplement the verifier in any language and reach the **same verdict** on the same audit package. The reference implementation (TypeScript/Node 22) is in `/verifier`, but it is not privileged: the package is the source of truth, not the tool.

This spec is normative for the verdict; the reference implementation is illustrative.

-----

## 1. Invocation

```
foundlab-audit verify <package-dir> [--schemas <dir>] [--json]
```

- `<package-dir>` — path to an unpacked audit package (see `concept.md` §9).
- `--schemas <dir>` — override the schema directory (defaults to `<package-dir>/schemas`).
- `--json` — emit only the `VerificationResult` JSON (schema: `schemas/verification-result.schema.json`).

### Exit codes

|Code|Meaning                                           |
|----|--------------------------------------------------|
|`0` |`status: "pass"` — no blocking exception          |
|`1` |`status: "fail"` — at least one blocking exception|
|`2` |usage error (bad arguments)                       |

A verifier MUST set the process exit code from the verdict so it can gate CI.

-----

## 2. Inputs the verifier reads

|File                       |Required|Used for                                                                                          |
|---------------------------|--------|--------------------------------------------------------------------------------------------------|
|`manifest.json`            |yes     |entry point: file hashes, `merkle_profile`, `merkle_root`, signing keys, signature, `audit_period`|
|`evidence.ndjson`          |yes     |AEIR records, one JSON object per line                                                            |
|`schemas/*.schema.json`    |yes     |JSON Schema 2020-12 validation                                                                    |
|`merkle-proofs/proofs.json`|optional|inclusion proofs (array of `MerkleProof`)                                                         |
|`policy-snapshots.json`    |optional|resolve `policy_snapshot_hash`                                                                    |
|`model-bindings.json`      |optional|resolve `model_hash`                                                                              |
|`redaction-policy.json`    |optional|redaction enforcement                                                                             |
|`report-derivation.json`   |optional|report-derivation claim (renderer output)                                                         |

If a required file is missing, the verifier MUST fail with a blocking exception and MUST NOT proceed as if the package were valid (fail-closed).

-----

## 3. Canonicalization (REQUIRED, must match exactly)

All hashing and signing operate over a canonical byte serialization. Profile:

- JSON Canonicalization Scheme, **RFC 8785 (JCS)** — `https://www.rfc-editor.org/rfc/rfc8785`.
- Object keys sorted by UTF-16 code units; no insignificant whitespace; UTF-8 output.
- **[TODO / known limitation]** The reference implementation uses recursive key-sorting + the host JSON serializer for scalars. Full RFC 8785 number serialization (ECMAScript `Number`-to-`String`, §3.2.2.3) is **not** fully reimplemented; for the AEIR field set (strings, integers, ISO-8601 timestamps) the output matches JCS. Floating-point values with many significant digits are a divergence risk (`concept.md` R-11). A reimplementer SHOULD use a conformant RFC 8785 library and MUST agree on float handling before relying on float fields.
- Local-only fields whose key begins with `_` (e.g. `_payload`) are **not** part of the canonical AEIR and MUST be stripped before schema validation and before leaf hashing.

Hash notation: every hash is the lowercase string `sha256:<64 hex>`.

-----

## 4. Checks (each independent; all blocking unless stated)

The verifier MUST run all of the following and report each outcome. `status = pass` **iff** there is no exception with `severity: "blocking"`.

### 4.1 `schema_valid`

Every record in `evidence.ndjson` (after stripping `_`-prefixed keys) MUST validate against `audit-evidence-record.schema.json` (JSON Schema 2020-12). Embedded `decision` objects validate against `decision-evidence-envelope.schema.json` via `$ref`.
Fail → `AEIR_SCHEMA_INVALID` or `AEIR_REQUIRED_FIELD_MISSING`.

### 4.2 `root_hash_verified`

Recompute the Merkle root from the ordered record leaves under the manifest’s `merkle_profile` (§5) and compare to `manifest.merkle_root`.
Fail → `MERKLE_ROOT_MISMATCH`.

### 4.3 `merkle_chain_valid`

For each proof in `merkle-proofs/proofs.json`, recompute the root from `leaf_hash` + `inclusion_path` and compare to `merkle_root`.
Fail → `MERKLE_PROOF_INVALID`. (`merkle_chain_valid` is true only if `root_hash_verified` is also true.)

### 4.4 `signatures_verified`

Verify `manifest.signature` (ECDSA P-256, **raw `r||s`**, NOT DER) over the canonical manifest body (all fields except `signature`) using `signing_keys[0].public_key_pem`. If `signing_keys[0].revoked` is true → `SIGNATURE_KEY_REVOKED`.
Fail → `SIGNATURE_INVALID`.

> Implementation note: in Node’s `crypto`, raw `r||s` corresponds to `dsaEncoding: "ieee-p1363"`. In other stacks, decode the 64-byte signature as `(r, s)` each 32 bytes big-endian.

### 4.5 `decision_ids_recomputed`

For every record with an embedded `decision`, recompute `decision_commitment` and compare.
**STUB formula** (`concept.md` §8.2): `sha256:` + SHA-256 of JCS over `{input_hash, jurisdiction, model_hash, policy_snapshot_hash, threshold}`.
The verifier MUST emit warning `DECISION_COMMITMENT_FORMULA_UNCONFIRMED` whenever any decision is present.
Fail → `DECISION_ID_RECOMPUTE_FAILED`.

> `decision_id` itself is a UUID v7 and is NOT recomputable (contains entropy). Do not attempt to recompute it.

### 4.6 `policy_hashes_resolved`

Every `decision.policy_snapshot_hash` MUST appear in `policy-snapshots.json`.
Fail → `POLICY_HASH_UNRESOLVED`.

### 4.7 `model_hashes_resolved`

Every `decision.model_hash` MUST appear in `model-bindings.json`.
Fail → `MODEL_HASH_UNRESOLVED`.

### 4.8 `redaction_policy_valid`

If `redaction-policy.json` is present, no field marked `method: "drop"` or `"seal"` may appear in clear in any record.
Fail → `REDACTION_POLICY_VIOLATED`.

### 4.9 `report_derivation_valid`

If `report-derivation.json` is present, every `consumed_event_ids` entry and every `claims[].backed_by` entry MUST exist as an `event_id` in the AEIR. Absent file → trivially valid.
Fail → `REPORT_DERIVATION_FAILED`.

### 4.10 Audit-period scope

If `manifest.audit_period` is present, every record’s `occurred_at` MUST fall within `[from, to]`.
Fail → `EVENT_OUT_OF_SCOPE`.

-----

## 5. Merkle profiles (REQUIRED)

The manifest declares `merkle_profile`. Both MUST be supported.

### `rfc9162-sha256` (recommended)

Domain-separated, per **RFC 9162 §2.1.1** (`https://www.rfc-editor.org/rfc/rfc9162.html`, Experimental; constructions identical to RFC 6962):

- leaf: `SHA256(0x00 || leaf_data)`
- node: `SHA256(0x01 || left_hash_bytes || right_hash_bytes)`

### `rexguard-legacy-v1` (legacy; carries R-12)

Matches the existing NotarizationService construction (no domain separation):

- leaf: `SHA256(leaf_data)`
- node: `SHA256(left_hash_bytes || right_hash_bytes)`

The verifier MUST emit warning `SECOND_PREIMAGE_DOMAIN_SEPARATION_ABSENT` for `rexguard-legacy-v1`. Verification still passes for legacy-sealed evidence.

Common to both: hash bytes are the raw 32 bytes (hex-decoded from the `sha256:` string); odd levels duplicate the last node; leaves are ordered as in `evidence.ndjson`.

-----

## 6. Error taxonomy (referenced by `concept.md` §15)

|Code                                      |Cause                                              |Severity                  |Corrective action                           |Blocking|Test |
|------------------------------------------|---------------------------------------------------|--------------------------|--------------------------------------------|--------|-----|
|`AEIR_SCHEMA_INVALID`                     |record fails schema                                |blocking                  |fix producer serialization                  |yes     |§11.1|
|`AEIR_REQUIRED_FIELD_MISSING`             |mandatory field absent                             |blocking                  |add field at source                         |yes     |§11.1|
|`HASH_MISMATCH`                           |recomputed hash ≠ declared (payload or listed file)|blocking                  |re-derive evidence; do not edit sealed data |yes     |§11.2|
|`SIGNATURE_INVALID`                       |manifest signature fails                           |blocking                  |re-sign with correct key over canonical body|yes     |§11.5|
|`SIGNATURE_KEY_REVOKED`                   |signing key revoked/expired                        |blocking                  |rotate key; re-seal                         |yes     |§11.5|
|`MERKLE_ROOT_MISMATCH`                    |recomputed root ≠ manifest                         |blocking                  |rebuild tree from authentic leaves          |yes     |§11.4|
|`MERKLE_PROOF_INVALID`                    |inclusion proof fails                              |blocking                  |regenerate proof from authentic tree        |yes     |§11.4|
|`DECISION_ID_RECOMPUTE_FAILED`            |`decision_commitment` ≠ recompute                  |blocking                  |confirm production formula (§8.2)           |yes     |§11.3|
|`POLICY_HASH_UNRESOLVED`                  |`policy_snapshot_hash` not found                   |blocking                  |include policy snapshot in package          |yes     |§11.7|
|`MODEL_HASH_UNRESOLVED`                   |`model_hash` not found                             |blocking                  |include model binding                       |yes     |§11.3|
|`CONTROL_WITHOUT_EVIDENCE`                |mapped control without evidence/test               |blocking                  |attach evidence or drop control             |yes     |§11.7|
|`REDACTION_POLICY_VIOLATED`               |sensitive field in clear                           |blocking                  |apply redaction at render                   |yes     |§11.8|
|`UNKNOWN_SYSTEM`                          |`system` outside enum                              |blocking                  |map source to known system                  |yes     |§11.9|
|`EVENT_OUT_OF_SCOPE`                      |`occurred_at` outside `audit_period`               |blocking                  |scope correctly or exclude event            |yes     |§11.9|
|`DUPLICATE_EVENT`                         |repeated `event_id`                                |blocking                  |dedupe at collection                        |yes     |§11.9|
|`ORPHAN_EVENT`                            |`previous_event_hash` unresolvable                 |blocking                  |repair chain linkage                        |yes     |§11.9|
|`REPORT_DERIVATION_FAILED`                |report not derived from AEIR                       |blocking                  |re-render from package only                 |yes     |§11.6|
|`SCHEMA_DOWNGRADE_ATTEMPT`                |older `schema_version` than package baseline       |blocking                  |reject; upgrade source                      |yes     |§11.1|
|`RAW_EVIDENCE_UNRESOLVED`                 |raw evidence pointer dead                          |warning/blocking (profile)|restore from WORM/cold storage              |profile |§11.9|
|`DECISION_COMMITMENT_FORMULA_UNCONFIRMED` |stub formula in use                                |warning                   |confirm Veritas formula (§8.2)              |no      |§11.3|
|`SECOND_PREIMAGE_DOMAIN_SEPARATION_ABSENT`|legacy Merkle profile                              |warning                   |migrate to `rfc9162-sha256`                 |no      |§11.4|


> `CONTROL_WITHOUT_EVIDENCE`, `UNKNOWN_SYSTEM`, `DUPLICATE_EVENT`, `ORPHAN_EVENT`, `SCHEMA_DOWNGRADE_ATTEMPT`, `RAW_EVIDENCE_UNRESOLVED` are defined in the taxonomy and schemas; their checks are **not yet implemented** in the reference verifier (DML-3 scope). They are listed here so a reimplementer and an auditor see the full contract. See `concept.md` §19 roadmap.
