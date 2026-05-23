# CLI — `foundlab-audit`

Verifier de referência do Evidence Artifact Compiler. Recompila e checa um
Audit Package de forma determinística e fail-closed.

> Status: Draft / Experimental (DML-1→DML-3). Não é produção.

## Requisitos

- Node.js >= 22 (usa `--experimental-strip-types`; nenhum build step necessário).
- Dependências: `ajv`, `ajv-formats` (`npm install` na raiz do repo).

## Uso

```bash
# verificar um pacote
node --experimental-strip-types src/cli.ts verify <audit-package-dir>

# atalhos npm (na raiz do repo)
npm run verify -- <audit-package-dir>
npm run typecheck         # tsc --noEmit (type-check estrito)
npm run selftest          # regressão: gera pacote válido + mutações negativas
npm run build-example -- /tmp/pkg   # materializa um pacote válido de exemplo
```

Saída: `VerificationResult` (JSON) no stdout. Exit `0`=pass, `1`=fail, `2`=uso.

## Exemplo

```bash
npm run build-example -- /tmp/pkg
npm run verify -- /tmp/pkg
# -> { "status": "pass", ... , "exceptions": [] }   (exit 0)
```

## O que o verifier checa hoje

Implementado e testado (selftest verde):
- Schema AEIR (JSON Schema 2020-12 via AJV).
- `system` conhecido; `event_id` único (duplicata detectada).
- Merkle root recomputada (RFC 9162-style) vs. manifest.
- Hash de cada artefato do manifest.
- Claim de derivação do relatório (`report.derivation.json`).
- Falha determinística e fail-closed (status=fail se houver exception blocking).

Marcado `[TODO]` (critério de saída DML-3, ver `docs/concept.md` Seções 13/20):
- Verificação de assinatura DSSE integrada ao orquestrador (`verifyDsse` já
  existe em `src/dsse.ts`, falta plugar no fluxo do pacote real).
- `policy_hashes_resolved`, `model_hashes_resolved`.
- `redaction_policy_valid`.

## Reimplementação independente

Auditores que queiram reimplementar o verifier em outra linguagem devem seguir
`command-spec.md` (especificação agnóstica do algoritmo e dos parâmetros
criptográficos). A implementação TypeScript é referência, não autoridade — o
contrato está na spec e nos `/test-vectors`.

## Avisos honestos

- `src/canonicalize.ts` NÃO é JCS-compliant para floats/números grandes (ver
  caveat em `command-spec.md` Seção 6 e RISCO R-13). Usar lib auditada em produção.
- DecisionID é um CONTRATO com `[TODO] confirm production formula` (OQ-02).
  Enquanto aberto, divergência é `warning`, não `blocking`.
- `signatures_verified` retorna `true` como stub no orquestrador até a
  integração do trust store do pacote real.
