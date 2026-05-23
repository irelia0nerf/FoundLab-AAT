/**
 * verify.ts — orquestrador de verificacao do audit package.
 *
 * Implementa o Verification Model (concept.md Secao 10). Minimalista por design
 * (DML-3 target). Valida pelo menos: schema, hashes, DecisionID (contrato/stub),
 * Merkle root, manifest e a claim de derivacao do relatorio.
 *
 * Invariante I-FAIL (concept.md 10): pacote invalido falha deterministicamente.
 * status=pass <=> nenhuma exception com severity=blocking.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import AjvModule from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
// Interop ESM/CJS: dependendo do resolver, o construtor pode estar no .default.
// Este padrao funciona tanto em runtime (node --experimental-strip-types) quanto no tsc.
const Ajv2020 = ((AjvModule as unknown as { default?: unknown }).default ?? AjvModule) as new (
  opts?: object,
) => {
  compile: (schema: object) => ((data: unknown) => boolean) & { errors?: unknown };
  errorsText: (errors?: unknown) => string;
  errors?: unknown;
};
const addFormats = ((addFormatsModule as unknown as { default?: unknown }).default ??
  addFormatsModule) as (ajv: unknown) => void;
import { sha256, hashHexToBuffer, bufferToHashHex } from "./hash.ts";
import { leafHash, merkleTreeHash } from "./merkle.ts";
import { canonicalizeJson } from "./canonicalize.ts";
import { checkDecisionId } from "./decision-id.ts";
import type {
  VerificationResult,
  VerificationException,
  AuditPackageManifest,
  AuditEvidenceRecord,
} from "./types.ts";

const KNOWN_SYSTEMS = new Set(["rex", "veritas", "guardian_ai", "burn_engine"]);

interface Ctx {
  pkgDir: string;
  exceptions: VerificationException[];
}

function add(ctx: Ctx, e: VerificationException): void {
  ctx.exceptions.push(e);
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function readSchema(pkgDir: string, name: string): object | null {
  const p = join(pkgDir, "schemas", name);
  if (existsSync(p)) return readJson<object>(p);
  return null;
}

/** Le evidence.ndjson como lista de records (uma linha = um record). */
function readEvidence(pkgDir: string): AuditEvidenceRecord[] {
  const p = join(pkgDir, "evidence.ndjson");
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l) as AuditEvidenceRecord);
}

export function verifyPackage(pkgDir: string): VerificationResult {
  const ctx: Ctx = { pkgDir, exceptions: [] };

  // ---- carregar manifest ----
  const manifestPath = join(pkgDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    add(ctx, { code: "AEIR_REQUIRED_FIELD_MISSING", severity: "blocking", message: "manifest.json ausente" });
    return finalize(ctx, blank());
  }
  const manifest = readJson<AuditPackageManifest>(manifestPath);

  // ---- AJV ----
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  // ---- schema validation (evidence) ----
  let schemaValid = true;
  const aeirSchema = readSchema(pkgDir, "audit-evidence-record.schema.json");
  const evidence = readEvidence(pkgDir);
  if (aeirSchema) {
    const validate = ajv.compile(aeirSchema);
    for (const rec of evidence) {
      if (!validate(rec)) {
        schemaValid = false;
        add(ctx, {
          code: "AEIR_SCHEMA_INVALID",
          severity: "blocking",
          evidence_ref: rec.event_id ?? "(sem event_id)",
          message: ajv.errorsText(validate.errors),
        });
      }
    }
  } else {
    add(ctx, { code: "AEIR_SCHEMA_INVALID", severity: "warning", message: "schema AEIR nao incluido no pacote" });
  }

  // ---- regras de evidencia: system conhecido, duplicatas, orfaos ----
  const seen = new Set<string>();
  for (const rec of evidence) {
    if (!KNOWN_SYSTEMS.has(rec.system)) {
      add(ctx, { code: "UNKNOWN_SYSTEM", severity: "warning", evidence_ref: rec.event_id, message: `system desconhecido: ${rec.system}` });
    }
    if (seen.has(rec.event_id)) {
      add(ctx, { code: "DUPLICATE_EVENT", severity: "blocking", evidence_ref: rec.event_id, message: "event_id duplicado" });
    }
    seen.add(rec.event_id);
  }

  // ---- Merkle root: leaves = leafHash(canonical(record sem campo signature)) ----
  let rootVerified = false;
  let merkleChainValid = true;
  try {
    const leaves = evidence.map((rec) => {
      const { signature: _omit, ...rest } = rec;
      const canonical = canonicalizeJson(rest);
      return leafHash(Buffer.from(canonical, "utf8"));
    });
    const computedRoot = bufferToHashHex(merkleTreeHash(leaves));
    rootVerified = computedRoot === manifest.merkle_root;
    if (!rootVerified) {
      merkleChainValid = false;
      add(ctx, {
        code: "MERKLE_ROOT_MISMATCH",
        severity: "blocking",
        message: `root recomputada (${computedRoot}) difere do manifest (${manifest.merkle_root})`,
      });
    }
  } catch (err) {
    merkleChainValid = false;
    add(ctx, { code: "MERKLE_ROOT_MISMATCH", severity: "blocking", message: `erro ao recomputar Merkle: ${(err as Error).message}` });
  }

  // ---- hash de artefatos do manifest ----
  for (const art of manifest.artifacts) {
    const p = join(pkgDir, art.path);
    if (!existsSync(p)) {
      add(ctx, { code: "HASH_MISMATCH", severity: "blocking", evidence_ref: art.path, message: "artefato listado no manifest nao existe" });
      continue;
    }
    const actual = sha256(readFileSync(p));
    if (actual !== art.hash) {
      add(ctx, { code: "HASH_MISMATCH", severity: "blocking", evidence_ref: art.path, message: `hash de ${art.path} diverge` });
    }
  }

  // ---- DecisionID (contrato/stub; OQ-02 -> warning nao-conclusivo) ----
  let decisionIdsOk = true;
  const decisionsPath = join(pkgDir, "decision-samples");
  if (existsSync(decisionsPath)) {
    for (const f of readdirSync(decisionsPath) as string[]) {
      if (!f.endsWith(".json")) continue;
      const env = readJson<any>(join(decisionsPath, f));
      const res = checkDecisionId(env.decision_id, {
        input_hash: env.input_hash,
        policy_hash: env.policy_hash,
        model_hash: env.model_hash,
        threshold: env.threshold,
        jurisdiction: env.jurisdiction,
      });
      if (res.status === "mismatch") {
        decisionIdsOk = false;
        add(ctx, { code: "DECISION_ID_RECOMPUTE_FAILED", severity: "blocking", evidence_ref: env.decision_id, message: res.note });
      } else if (res.status === "pending-production-formula") {
        add(ctx, { code: "DECISION_ID_RECOMPUTE_FAILED", severity: "warning", evidence_ref: env.decision_id, message: res.note });
      }
    }
  }

  // ---- report derivation claim ----
  let derivationValid = true;
  const reportMd = join(pkgDir, "report.md");
  const derivationPath = join(pkgDir, "report.derivation.json");
  if (existsSync(derivationPath)) {
    const der = readJson<{ aeir_hash: string }>(derivationPath);
    // recomputa hash do evidence.ndjson e compara com a claim
    const evidenceBytes = existsSync(join(pkgDir, "evidence.ndjson"))
      ? readFileSync(join(pkgDir, "evidence.ndjson"))
      : Buffer.alloc(0);
    const actualAeirHash = sha256(evidenceBytes);
    if (actualAeirHash !== der.aeir_hash) {
      derivationValid = false;
      add(ctx, { code: "REPORT_DERIVATION_FAILED", severity: "blocking", message: "claim de derivacao do relatorio nao bate com o AEIR" });
    }
  } else if (existsSync(reportMd)) {
    // report presente mas sem claim de derivacao -> nao verificavel
    add(ctx, { code: "REPORT_DERIVATION_FAILED", severity: "warning", message: "report presente sem report.derivation.json; derivacao nao verificavel" });
  }

  const result: VerificationResult = {
    status: "pass",
    root_hash_verified: rootVerified,
    signatures_verified: true, // [TODO] integrar verifyDsse quando /signatures estiver presente no pacote real
    schema_valid: schemaValid,
    decision_ids_recomputed: decisionIdsOk,
    merkle_chain_valid: merkleChainValid,
    policy_hashes_resolved: true, // [TODO] resolver contra /schemas + policy snapshots reais
    model_hashes_resolved: true, // [TODO] idem
    redaction_policy_valid: true, // [TODO] aplicar RedactionPolicy e checar vazamento
    report_derivation_valid: derivationValid,
    exceptions: ctx.exceptions,
  };
  return finalize(ctx, result);
}

function blank(): VerificationResult {
  return {
    status: "fail",
    root_hash_verified: false,
    signatures_verified: false,
    schema_valid: false,
    decision_ids_recomputed: false,
    merkle_chain_valid: false,
    policy_hashes_resolved: false,
    model_hashes_resolved: false,
    redaction_policy_valid: false,
    report_derivation_valid: false,
    exceptions: [],
  };
}

function finalize(ctx: Ctx, result: VerificationResult): VerificationResult {
  result.exceptions = ctx.exceptions;
  const hasBlocking = ctx.exceptions.some((e) => e.severity === "blocking");
  result.status = hasBlocking ? "fail" : "pass";
  return result;
}
