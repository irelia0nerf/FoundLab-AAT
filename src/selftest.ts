/**
 * selftest.ts — teste reproduzivel do verifier (DML-2/DML-3).
 *
 * Gera um pacote valido, confirma pass, aplica mutacoes e confirma fail
 * deterministico (I-FAIL). Sai com codigo 0 se todos os casos baterem o
 * esperado, 1 caso contrario. NAO substitui os test vectors em /test-vectors;
 * e a checagem de regressao minima do verifier.
 *
 * Uso: node --experimental-strip-types src/selftest.ts
 */
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface Case {
  name: string;
  mutate?: (dir: string) => void;
  expectStatus: "pass" | "fail";
  expectCodes?: string[]; // codigos que DEVEM aparecer
}

function runVerify(dir: string): { status: string; codes: string[]; exit: number } {
  let out = "";
  let exit = 0;
  try {
    out = execFileSync(
      process.execPath,
      ["--experimental-strip-types", join(__dirname, "cli.ts"), "verify", dir],
      { encoding: "utf8" },
    );
  } catch (e) {
    const err = e as { stdout?: string; status?: number };
    out = err.stdout ?? "";
    exit = err.status ?? 1;
  }
  const parsed = JSON.parse(out);
  return { status: parsed.status, codes: parsed.exceptions.map((x: { code: string }) => x.code), exit };
}

function mutateLine0(dir: string, fn: (rec: Record<string, unknown>) => void): void {
  const p = join(dir, "evidence.ndjson");
  const lines = readFileSync(p, "utf8").trim().split("\n");
  const rec = JSON.parse(lines[0]!) as Record<string, unknown>;
  fn(rec);
  lines[0] = JSON.stringify(rec);
  writeFileSync(p, lines.join("\n") + "\n");
}

const cases: Case[] = [
  { name: "valido", expectStatus: "pass" },
  {
    name: "trace_id adulterado (Merkle+hash)",
    mutate: (d) => mutateLine0(d, (r) => { r.trace_id = "ffffffffffffffffffffffffffffffff"; }),
    expectStatus: "fail",
    expectCodes: ["MERKLE_ROOT_MISMATCH", "HASH_MISMATCH"],
  },
  {
    name: "system fora do enum (schema)",
    mutate: (d) => mutateLine0(d, (r) => { r.system = "sistema_falso"; }),
    expectStatus: "fail",
    expectCodes: ["AEIR_SCHEMA_INVALID"],
  },
  {
    name: "evento duplicado",
    mutate: (d) => {
      const p = join(d, "evidence.ndjson");
      const lines = readFileSync(p, "utf8").trim().split("\n");
      writeFileSync(p, lines.join("\n") + "\n" + lines[0] + "\n");
    },
    expectStatus: "fail",
    expectCodes: ["DUPLICATE_EVENT"],
  },
];

function main(): void {
  const base = mkdtempSync(join(tmpdir(), "fl-selftest-"));
  // gera pacote valido base
  execFileSync(
    process.execPath,
    ["--experimental-strip-types", join(__dirname, "build-example.ts"), join(base, "valid")],
    { stdio: "ignore" },
  );

  let allOk = true;
  for (const c of cases) {
    const dir = join(base, c.name.replace(/[^a-z0-9]+/gi, "_"));
    cpSync(join(base, "valid"), dir, { recursive: true });
    if (c.mutate) c.mutate(dir);
    const res = runVerify(dir);
    const statusOk = res.status === c.expectStatus;
    const codesOk = (c.expectCodes ?? []).every((code) => res.codes.includes(code));
    const ok = statusOk && codesOk;
    allOk = allOk && ok;
    process.stdout.write(
      `[${ok ? "OK" : "FALHOU"}] ${c.name} -> status=${res.status} exit=${res.exit}` +
        (c.expectCodes ? ` codes=[${res.codes.join(",")}]` : "") +
        "\n",
    );
  }
  rmSync(base, { recursive: true, force: true });
  process.stdout.write(allOk ? "\nSELFTEST: TODOS OK\n" : "\nSELFTEST: HOUVE FALHA\n");
  process.exit(allOk ? 0 : 1);
}

main();
