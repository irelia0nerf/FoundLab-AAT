# FoundLab Audit Author Tools — Evidence Artifact Compiler (EAC)

**Status:** `Draft / Experimental / Not Production` · **Maturity:** DML-1→DML-3 (see `docs/concept.md` §13)

> FoundLab does not generate audit reports from logs.
> FoundLab compiles cryptographically verifiable audit artifacts from deterministic execution evidence.

The EAC turns deterministic execution evidence from Rex / Veritas / Guardian AI / Burn Engine into
**machine-verifiable audit packages** and **human-readable dossiers derived from those packages**.
The rendered report (PDF/HTML/MD) is never the source of truth — the canonical AEIR + manifest +
hashes + Merkle proofs + signatures are. The model is borrowed (as engineering discipline, not as a
standardization process) from the IETF Author Tools pipeline: `source → validate → seal → package → render → verify`.

This is a first design draft. It does **not** declare regulatory compliance and does not replace
auditor judgment.

## What’s here

```
docs/concept.md          Master design document (23 sections): AEIR, pipeline, verification model,
                         mandatory test strategy, output contracts, error taxonomy, security/privacy,
                         compliance mapping, open questions, risk register.
schemas/                 10 JSON Schemas (2020-12): AEIR record, decision envelope, policy snapshot,
                         model binding, control mapping, package manifest, verification result,
                         redaction policy, disclosure profile, merkle proof.
test-vectors/            10 executable test vectors (tv-001..tv-010) + generated real-crypto fixtures.
cli/                     command-spec.md (language-agnostic verification contract) + CLI README.
verifier/                Reference verifier (TypeScript / Node 22), runnable as native TS.
references.md            Verified normative anchors (with status flags: Experimental / non-IETF / etc).
```

## Quickstart (auditor)

```bash
cd verifier
npm install
npm run make-fixture     # generate real-crypto fixtures
npm test                 # run all 10 test vectors -> "ALL VECTORS PASSED"
node src/index.ts verify ../test-vectors/fixtures/valid-minimal-package          # PASS, exit 0
node src/index.ts verify ../test-vectors/fixtures/invalid-signature --json       # FAIL, exit 1
```

No build step is required — Node 22.6+ executes TypeScript natively. `npm run typecheck` runs `tsc --noEmit`.

## Reading order

1. `docs/concept.md` — start at the Abstract and the marking legend (`[FATO]`/`[ASSUMPTION]`/`[DECISÃO]`/`[RISCO]`/`[TODO]`).
1. `cli/command-spec.md` — the verification contract (so the verdict does not depend on our tool).
1. `verifier/` — the reference implementation and its honest list of stubs.
1. `references.md` — sources, with maturity flags.

## Honest status (do not skip)

- `decision_commitment` recompute uses a **STUB** 5-field formula — production formula unconfirmed (§8.2).
- Two Merkle profiles: `rfc9162-sha256` (recommended, domain-separated) and `rexguard-legacy-v1`
  (matches the existing NotarizationService; no domain separation; carries risk **R-12**).
- Pipeline order diverges from the original prompt diagram on purpose: **seal/package before render**
  (§4), enforced by the `report_derivation_valid` check.
- Several specified error checks are not yet implemented (see `cli/command-spec.md` §6 note and §19 roadmap).

## License

Internal FoundLab artifact. Not for distribution outside the audit pilot without authorization.
