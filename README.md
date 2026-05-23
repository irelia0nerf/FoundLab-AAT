# FoundLab Audit Author Tools — Evidence Artifact Compiler

> **FoundLab does not generate audit reports from logs.**
> **FoundLab compiles cryptographically verifiable audit artifacts from deterministic execution evidence.**

**Status:** Draft / Experimental — **DML-1→DML-3**. Não é produção. Não declara
conformidade regulatória.

Compila evidência técnica bruta (logs, traces, decisões, políticas, metadados de
modelo dos sistemas Rex / Veritas / Guardian AI / Burn Engine) em **pacotes de
auditoria verificáveis por máquina**, dos quais o dossiê humano é uma **view
derivada e descartável** — nunca a fonte da verdade.

## Pipeline (ordem canônica)

```
raw logs / traces / decisions / policies / model metadata
  → normalize → AEIR → validate → seal → package → render
  → machine-verifiable audit package  →  human-readable audit dossier (derivado)
```

> **Decisão arquitetural (DEC-FL):** o `render` vem **depois** do pacote selado.
> O renderer nunca entra na cadeia de confiança (invariante I-RENDER). Ver
> `docs/concept.md` Seção 5.1 — esta ordem diverge deliberadamente do diagrama de
> inspiração original.

## Estrutura

```
docs/concept.md          Documento mestre (23 seções): conceito, AEIR, verificação,
                         testes, error codes, segurança, privacidade, riscos, roadmap.
schemas/*.schema.json    10 JSON Schemas (2020-12), validados.
test-vectors/*.json      10 vetores de regressão (tv-001..tv-010) + README.
src/*.ts                 Verifier de referência (TypeScript / Node 22).
cli/command-spec.md      Spec agnóstica para reimplementação por auditor externo.
cli/README.md            Uso do CLI.
references/references.md  Âncoras normativas verificadas (RFCs, DSSE, SLSA).
examples/                Pacote válido e inválido gerados pelos primitivos atuais,
                         com a saída do verifier (.verification.json).
```

## Quickstart

```bash
npm install
npm run typecheck                       # tsc strict, zero erros
npm run selftest                        # regressão: pass + 3 mutações negativas
npm run build-example -- /tmp/pkg       # materializa um pacote válido
npm run verify -- /tmp/pkg              # -> status: pass, exit 0
```

Requer Node >= 22 (execução via `--experimental-strip-types`, sem build step).

## O que está provado vs. o que é contrato aberto

**Implementado e testado** (selftest verde, tsc limpo): schema AEIR (AJV),
unicidade de evento, recomputação de Merkle root (RFC 9162-style, domain
separation 0x00/0x01), hash de artefatos do manifest, claim de derivação do
relatório, e falha determinística fail-closed.

**Contrato com `[TODO]` explícito** (critério de saída DML-3, ver `docs/concept.md`
Seções 13/20): integração da verificação DSSE ao orquestrador (`verifyDsse` já
existe e é testável isoladamente), `policy_hashes_resolved`,
`model_hashes_resolved`, `redaction_policy_valid`, e — crucialmente — a **fórmula
de produção do DecisionID** (OQ-02), que permanece como contrato e NÃO foi
inventada.

## Avisos honestos

- **Canonicalização:** `src/canonicalize.ts` não é JCS-compliant para floats
  (RISCO R-13). Usar lib auditada em produção.
- **RFC 9162 é Experimental** (RISCO R-09); construções Merkle idênticas à RFC 6962.
- **DSSE não é IETF** (community spec v1.0.0); JWS é fallback possível (OQ-07).
- **DecisionID** é stub-contrato; divergência é `warning` até OQ-02 fechar.

## Licença

UNLICENSED / privado (FoundLab). Material técnico interno.
