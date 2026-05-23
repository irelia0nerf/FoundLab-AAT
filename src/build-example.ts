/**
 * build-example.ts — gera um audit-package valido minimo REAL.
 *
 * Usa os proprios primitivos (hash, merkle, canonicalize) para produzir um
 * pacote consistente, garantindo que o verifier tem um caso pass de verdade.
 * NAO assina (signatures_verified e stub no verifier); foca em Merkle+hash+schema.
 *
 * Uso: node --experimental-strip-types src/build-example.ts <outDir>
 */
import { mkdirSync, writeFileSync, readFileSync, cpSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256, bufferToHashHex } from "./hash.ts";
import { leafHash, merkleTreeHash } from "./merkle.ts";
import { canonicalizeJson } from "./canonicalize.ts";
import type { AuditEvidenceRecord, AuditPackageManifest } from "./types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

function build(outDir: string): void {
  mkdirSync(outDir, { recursive: true });
  mkdirSync(join(outDir, "schemas"), { recursive: true });

  // ---- evidencia minima: 2 eventos ----
  const records: AuditEvidenceRecord[] = [
    {
      schema_version: "aeir.audit_evidence_record.v1",
      event_id: "evt_01HX0000000000000000000001",
      event_type: "evidence.collected",
      system: "rex",
      occurred_at: "2026-05-23T14:30:00.000Z",
      trace_id: "4bf92f3577b34da6a3ce929d0e0e4736",
      span_id: "00f067aa0ba902b7",
      actor: { type: "service", id: "rex-runtime" },
      jurisdiction: "BR",
      payload_hash: sha256(Buffer.from("payload-1", "utf8")),
    },
    {
      schema_version: "aeir.audit_evidence_record.v1",
      event_id: "evt_01HX0000000000000000000002",
      event_type: "decision.executed",
      system: "veritas",
      occurred_at: "2026-05-23T14:31:00.000Z",
      trace_id: "4bf92f3577b34da6a3ce929d0e0e4736",
      span_id: "00f067aa0ba902b8",
      actor: { type: "service", id: "veritas-runtime" },
      jurisdiction: "BR",
      payload_hash: sha256(Buffer.from("payload-2", "utf8")),
      previous_event_hash: sha256(Buffer.from("payload-1", "utf8")),
    },
  ];

  // evidence.ndjson
  const ndjson = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
  writeFileSync(join(outDir, "evidence.ndjson"), ndjson);

  // Merkle root sobre leaves = leafHash(canonical(record sem signature))
  const leaves = records.map((rec) => {
    const { signature: _o, ...rest } = rec as AuditEvidenceRecord & { signature?: string };
    return leafHash(Buffer.from(canonicalizeJson(rest), "utf8"));
  });
  const merkleRoot = bufferToHashHex(merkleTreeHash(leaves));

  // copia schema AEIR para o pacote (pin)
  cpSync(
    join(repoRoot, "schemas", "audit-evidence-record.schema.json"),
    join(outDir, "schemas", "audit-evidence-record.schema.json"),
  );

  // report derivado + claim de derivacao
  const reportMd = "# Audit Dossier (derivado)\n\nView humana derivada do AEIR. Nao e fonte da verdade.\n";
  writeFileSync(join(outDir, "report.md"), reportMd);
  const aeirHash = sha256(readFileSync(join(outDir, "evidence.ndjson")));
  writeFileSync(join(outDir, "report.derivation.json"), JSON.stringify({ aeir_hash: aeirHash }, null, 2) + "\n");

  // manifest: hash dos artefatos
  const artifactPaths = ["evidence.ndjson", "report.md", "report.derivation.json", "schemas/audit-evidence-record.schema.json"];
  const artifacts = artifactPaths.map((p) => ({
    path: p,
    hash: sha256(readFileSync(join(outDir, p))),
    derived: p.startsWith("report"),
  }));

  const manifest: AuditPackageManifest = {
    manifest_version: "aeir.audit_package_manifest.v1",
    package_id: "pkg_example_valid_minimal",
    created_at: "2026-05-23T14:35:00.000Z",
    merkle_root: merkleRoot,
    hash_algorithm: "SHA-256",
    tree_size: records.length,
    artifacts,
    signature: "ref:signatures/manifest.dsse.json (stub neste exemplo)",
  };
  writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  process.stdout.write(`pacote valido gerado em ${outDir}\n  merkle_root=${merkleRoot}\n`);
}

const out = process.argv[2];
if (!out) {
  process.stderr.write("uso: build-example.ts <outDir>\n");
  process.exit(2);
}
build(out);
