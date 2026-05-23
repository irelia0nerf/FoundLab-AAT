#!/usr/bin/env node
/**
 * cli.ts — entry point. `foundlab-audit verify <dir>`
 *
 * Saida: VerificationResult em JSON no stdout. Exit code 0 se pass, 1 se fail,
 * 2 para erro de uso. Determinista (concept.md I-FAIL).
 */
import { verifyPackage } from "./verify.ts";

function usage(): never {
  process.stderr.write(
    [
      "foundlab-audit — Evidence Artifact Compiler verifier (DML draft)",
      "",
      "Uso:",
      "  foundlab-audit verify <audit-package-dir>",
      "",
      "Saida: VerificationResult JSON no stdout.",
      "Exit: 0=pass, 1=fail, 2=erro de uso.",
      "",
      "Spec agnostica para reimplementacao: cli/command-spec.md",
      "",
    ].join("\n"),
  );
  process.exit(2);
}

function main(): void {
  const [, , cmd, target] = process.argv;
  if (cmd !== "verify" || !target) usage();

  const result = verifyPackage(target);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(result.status === "pass" ? 0 : 1);
}

main();
