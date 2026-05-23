# Test Vectors

Vetores de regressão determinística para o verifier (concept.md Seção 12).
Estado: **DML-2** (vetores definidos). Cada vetor é um descritor JSON com
`expected_result` e `expected_error_code`. Os vetores que precisam de um pacote
materializado referenciam um diretório em `fixtures/`.

## Formato do descritor

```json
{
  "test_vector_id": "tv_001",
  "description": "...",
  "fixture": "fixtures/tv-001/",      // opcional; pacote materializado
  "expected_result": "pass",          // pass | fail
  "expected_error_codes": []          // códigos que DEVEM aparecer (subset)
}
```

## Mapa dos vetores

| ID | Descrição | Esperado | Código(s) |
|----|-----------|----------|-----------|
| tv-001 | pacote válido mínimo | pass | — |
| tv-002 | evento com hash inválido | fail | HASH_MISMATCH, MERKLE_ROOT_MISMATCH |
| tv-003 | DecisionID inconsistente | fail | DECISION_ID_RECOMPUTE_FAILED (warning enquanto OQ-02 aberta) |
| tv-004 | cadeia Merkle quebrada | fail | MERKLE_ROOT_MISMATCH |
| tv-005 | redaction correta | pass | — |
| tv-006 | assinatura inválida | fail | SIGNATURE_INVALID |
| tv-007 | PolicySnapshot ausente | fail | POLICY_HASH_UNRESOLVED |
| tv-008 | ReversalEvent válido | pass | — |
| tv-009 | OverrideEvent válido | pass | — |
| tv-010 | evento fora do período de auditoria | fail | EVENT_OUT_OF_SCOPE |

## Estado de implementação no verifier minimalista (DML-3 alvo)

O verifier deste rascunho já materializa e valida automaticamente: tv-001
(pass), tv-002/tv-004 (Merkle/hash). Os demais (assinatura, policy/model
resolution, redaction, scope) dependem de componentes marcados `[TODO]` em
`src/verify.ts` (signatures_verified, policy_hashes_resolved,
model_hashes_resolved, redaction_policy_valid). Os descritores ficam aqui como
contrato de teste; a verificação automática completa é critério de saída de
DML-3 → DML-4. Ver concept.md Seções 13 e 20.

## Rodar

```bash
node --experimental-strip-types src/build-example.ts /tmp/tv001 && \
node --experimental-strip-types src/cli.ts verify /tmp/tv001
```
