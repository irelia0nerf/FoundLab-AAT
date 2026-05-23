# FoundLab Audit Author Tools — Evidence Artifact Compiler

**Status:** `Draft / Experimental / Not Production`
**Document type:** Initial technical design draft (IETF-Internet-Draft-style, FoundLab internal)
**Draft Maturity Level:** DML-1 (Draft schema) — see §13
**Author role:** Chief Architect, FoundLab
**Created:** 2026-05-23
**Last updated:** 2026-05-23
**Target audience:** Engineering (internal), Compliance, External auditor (pilot)

-----

## Legenda de marcação (lida em todo o documento)

Este documento separa explicitamente quatro classes de afirmação. A classificação é mandatória; nenhuma afirmação normativa aparece sem uma destas marcas quando há risco de ser lida como fato.

- **[FATO]** — Fato normativo verificado contra fonte primária, com link. Defensável diante de auditor.
- **[ASSUMPTION]** — Hipótese de design. Pode estar errada; o que quebra se estiver errada é declarado.
- **[DECISÃO]** — Decisão arquitetural FoundLab. Escolha entre alternativas, com justificativa.
- **[RISCO]** — Risco aberto. Entra no Risk Register (§21).
- **[TODO]** — Lacuna técnica a confirmar contra implementação de produção. Entra em Open Questions (§20).

> Princípio editorial herdado do padrão RFC FoundLab: *RFC honesto > RFC bonito*. Gap escondido morre na primeira pergunta de auditor. Esta é a razão de a marcação acima ser obrigatória.

-----

## Abstract

Este documento especifica, em nível de rascunho, um conjunto de ferramentas — **FoundLab Audit Author Tools** — cujo componente central é o **Evidence Artifact Compiler (EAC)**. O EAC transforma evidência de execução determinística (logs, traces, decisões, policies, metadados de modelo) produzida pelos sistemas Rex, Veritas, Guardian AI e Burn Engine em **pacotes de auditoria criptograficamente verificáveis** e em **dossiês de auditoria legíveis por humanos** derivados desses pacotes.

A tese central é:

```text
FoundLab does not generate audit reports from logs.
FoundLab compiles cryptographically verifiable audit artifacts from deterministic execution evidence.
```

O modelo é inspirado na toolchain de autoria do IETF (`source → validation → rendering → verification`), reaplicado ao domínio de evidência operacional. A fonte da verdade nunca é o relatório renderizado (PDF/HTML/Markdown); a fonte da verdade é a **AEIR (Audit Evidence Intermediate Representation)** acompanhada de manifest, hashes, provas de Merkle e assinaturas. O relatório humano é uma *view* derivada e descartável, cuja fidelidade à AEIR é, ela própria, verificável.

Este é um rascunho experimental. Não declara conformidade regulatória. Não substitui julgamento de auditor. Contém testes obrigatórios, casos negativos, riscos e questões abertas.

-----

## 1. Executive Summary

O problema que o EAC ataca não é “gerar relatórios de auditoria”. É um problema anterior: **garantir que qualquer afirmação sobre o que um sistema fez possa ser reduzida a evidência verificável de forma independente, reproduzível e resistente a adulteração** — sem depender da narrativa de quem operou o sistema.

Hoje, a evidência de uma decisão automatizada na plataforma FoundLab existe (o REX Guard já sela cada decisão de inferência em um `SealedRecibo` assinado em ECDSA P-256 via Cloud KMS HSM, encadeado via `ChainHeadRepository` no Spanner e notarizado em Merkle pela `NotarizationService`). O que **não** existe de forma estruturada é a camada que (a) coleta essa evidência de múltiplos sistemas, (b) a normaliza para uma representação canônica única, (c) a valida por schema, hash, assinatura e Merkle, (d) a empacota num artefato autocontido que um auditor externo possa verificar com uma ferramenta independente, e (e) deriva desse artefato — e somente dele — qualquer relatório humano.

```text
FoundLab does not generate audit reports from logs.
FoundLab compiles cryptographically verifiable audit artifacts from deterministic execution evidence.
```

O EAC é, conceitualmente, um **compilador**. A entrada é evidência bruta heterogênea. A saída é um par: um **Machine-Verifiable Audit Package** (a fonte da verdade) e um **Human-Readable Audit Dossier** (uma view). Entre a entrada e a saída há um pipeline determinístico com pontos de validação que falham fechado (*fail-closed*): se a evidência não pode ser validada, o pacote não é emitido — não se emite um pacote “parcialmente válido” silenciosamente.

A inspiração é a toolchain do IETF Author Tools. **[FATO]** O IETF opera um serviço onde o autor fornece uma fonte estruturada (RFCXML), a ferramenta valida o formato, converte para formatos de publicação (HTML/TXT/PDF) e checa prontidão para submissão (ver `https://authors.ietf.org/` e a documentação viva do vocabulário RFCXML em `https://authors.ietf.org/rfcxml-vocabulary`). A analogia é estrutural, não literal: a FoundLab não está produzindo um RFC, e o EAC não é um conversor de documentos. O que se importa do modelo IETF é a disciplina `source → validation → rendering → verification` com uma fonte canônica única.

Este documento está em DML-1 (§13). É um ponto de partida para evoluir por ciclos de teste, não um produto pronto.

-----

## 2. Background and Inspiration

### 2.1 O que o IETF Author Tools faz

**[FATO]** O IETF Author Tools Web Service (`https://authors.ietf.org/author-tools-web-service`) recebe uma fonte de Internet-Draft, valida-a, e oferece conversão e checagem automática (incluindo verificação de conteúdo obrigatório). O fluxo operacional, em abstrato:

```text
Internet-Draft source
    ↓ validation (idnits e validadores de formato)
    ↓ conversion
HTML / TXT / XML / PDF
    ↓ submission-readiness
```

**[FATO]** O vocabulário usado para a fonte é o **RFCXML (xml2rfc v3)**, definido normativamente na **RFC 7991** (“The ‘xml2rfc’ Version 3 Vocabulary”, IAB, dezembro de 2016, `https://www.rfc-editor.org/rfc/rfc7991`). A documentação viva em `https://authors.ietf.org/rfcxml-vocabulary` declara explicitamente que supersede a RFC 7991 por já conter mudanças posteriores à publicação.

**[FATO]** Termos relacionados que **não** devem ser confundidos com o schema técnico:

- **RFC 9720** (“RFC Formats and Versions”, janeiro de 2025, `https://datatracker.ietf.org/doc/rfc9720/`) trata de *como RFCs são publicadas* e renomeia “xml2rfc v3” para “RFCXML”. É política/terminologia, não schema.
- **RFC 9920** (“RFC Editor Model (Version 3)”, fevereiro de 2026, `https://datatracker.ietf.org/doc/rfc9920/`) é um modelo **institucional/organizacional** (RSWG, RSAB, RPC, RSCE, IETF LLC). **Não** define schema, formato de log, ou qualquer estrutura técnica.

> **[DECISÃO]** Em todo este documento, qualquer referência ao vocabulário XML cita RFC 7991 + a página viva. RFC 9720 é citada apenas para terminologia de publicação; RFC 9920 não é citada como fonte técnica em nenhum ponto. Esta separação evita o erro comum de tratar RFC 9920 como se fosse RFCXML.

### 2.2 Por que a analogia é útil

A auditoria tradicional depende de confiança narrativa: alguém escreve um relatório, e o leitor confia que o relatório reflete a realidade dos logs. O modelo IETF inverte isso para documentos: existe uma fonte canônica, e tudo o mais é derivado e checável contra ela. O EAC aplica a mesma inversão à evidência: existe uma representação canônica (AEIR), e o relatório é derivado e checável contra ela.

### 2.3 Por que a FoundLab não está criando um RFC agora

Não há intenção de submeter nada ao IETF. O modelo é importado como *disciplina de engenharia*, não como processo de padronização. A FoundLab não controla o cronograma do IETF, e o valor do EAC não depende de aprovação externa de padrão.

### 2.4 Tradução do fluxo para evidência operacional

|IETF Author Tools      |FoundLab Audit Author Tools                         |
|-----------------------|----------------------------------------------------|
|Internet-Draft source  |Raw technical evidence (logs, traces, SealedRecibos)|
|RFCXML / Markdown / TXT|AEIR / JSON / NDJSON / CBOR                         |
|idnits / validation    |auditnits / verifier                                |
|HTML / XML / PDF       |Audit Dossier / Audit Package                       |
|Publication readiness  |Audit verification readiness                        |

-----

## 3. Problem Statement

O sistema atualmente produz evidência de decisão de forma correta no nível de cada decisão individual (REX Guard sela cada `SealedRecibo`), mas **não há camada de compilação que transforme essa evidência dispersa num artefato de auditoria autocontido e verificável de forma independente**. Em consequência:

- logs são volumosos e pouco interpretáveis isoladamente;
- auditores recebem evidência fragmentada entre Spanner, BigQuery WORM, Cloud Logging e traces;
- decisões automatizadas são reproduzíveis no nível do recibo, mas não há um pacote que comprove a *integridade do conjunto* de decisões de um período;
- policies, modelos e decisões ficam acoplados apenas por referência de hash, sem um índice navegável para o auditor;
- qualquer relatório produzido hoje é manual e, portanto, frágil — não há garantia criptográfica de que o relatório reflete a evidência;
- evidência sem teste vira documentação decorativa;
- evidência sem assinatura é apenas afirmação;
- evidência sem canonicalização não é reproduzível (dois processos podem hashear o mesmo objeto e obter hashes diferentes por ordenação de campos).

A consequência regulatória: sob BCB 538/2025, a FoundLab precisa sustentar defesa de decisão histórica. Sem um pacote verificável que ligue decisão → policy ativa → modelo → input/output (por hash) → posição na cadeia → assinatura → timestamp, a defesa depende de reconstrução manual, que é contestável.

-----

## 4. Proposed Solution

O EAC é um **compilador de evidência**. Componentes obrigatórios:

```text
Collectors → Normalizers → Canonical Evidence Records → AEIR
→ Schema Validators → Hash Validators → Signature Validators → Merkle Validators
→ Cryptographic Sealers → [Audit Package Generator] → Renderers → Verifiers
→ Control Mappers → Auditor CLI → Auditor Portal
```

> **[DECISÃO] Ordem corrigida do pipeline (divergência explícita do diagrama original do prompt).** O prompt original lista `... → cryptographic sealing → rendering → machine-verifiable audit package → human-readable dossier`, com o **rendering antes do pacote verificável**. Isso é incompatível com o invariante central “o renderer nunca é fonte da verdade”: se o render ocorre antes do selo, o output renderizado entra na cadeia de confiança. A ordem implementada é:
> 
> ```text
> normalize → AEIR → validate → seal → package → render
> ```
> 
> O selo e o pacote (AEIR + manifest + hashes + proofs + assinaturas) são produzidos **antes** de qualquer renderização. O dossiê humano é gerado por último, a partir do pacote já selado, e carrega uma *prova de derivação* (§10, `report_derivation_valid`) que permite ao verifier confirmar que o relatório não introduziu nem alterou evidência. Esta decisão é registrada também no Risk Register (§21, R-08) e nas Design Assumptions implícitas.

### 4.1 Descrição dos componentes

- **Collectors** — Adaptadores que leem evidência bruta de cada fonte (Spanner `recibos_sealed`, BigQuery WORM, Cloud Logging, OpenTelemetry traces, Pub/Sub de eventos Burn). Não transformam; apenas extraem e preservam o bruto para fallback forense.
- **Normalizers** — Convertem cada fonte para Canonical Evidence Records, aplicando canonicalização JSON (RFC 8785) e normalização de timestamp (ISO 8601 com timezone, nunca naive).
- **Canonical Evidence Records** — Registros normalizados, ainda por sistema, antes da unificação no formato AEIR.
- **AEIR Builder** — Monta a AEIR (§8): a representação canônica intermediária unificada, fonte da verdade.
- **Schema / Hash / Signature / Merkle Validators** — Quatro validadores independentes (§10). Cada um falha de forma isolada e reportável.
- **Cryptographic Sealers** — Recomputam/encadeiam hashes, validam ou produzem provas de Merkle e assinaturas.
- **Audit Package Generator** — Empacota AEIR + manifest + proofs + assinaturas + schemas + test vectors num diretório autocontido (§9).
- **Renderers** — Geram Markdown/HTML/PDF a partir do pacote selado. Nunca leem evidência fora do pacote. Cada render emite um `report_derivation` checável.
- **Verifiers** — CLI (`foundlab-audit verify`) e biblioteca que reexecutam todas as validações sobre um pacote (§10).
- **Control Mappers** — Mapeiam evidência → controles regulatórios/internos, sem concluir conformidade (§7, §18).
- **Auditor CLI / Portal** — Interfaces. O CLI é o mínimo defensável; o Portal é uma view sobre o mesmo pacote.

-----

## 5. Architectural Model

```text
[Rex]  [Veritas]  [Guardian AI]  [Burn Engine]
[Cloud Logging]  [OpenTelemetry]  [BigQuery WORM]  [Pub/Sub]  [Cloud KMS]
        ↓
Evidence Collectors            (extração; preserva raw evidence)
        ↓
Event Normalizer               (RFC 8785 JCS; timestamp ISO 8601)
        ↓
AEIR Builder                   (fonte da verdade canônica)
        ↓
Schema Validator               (JSON Schema 2020-12)
        ↓
Hash + Signature + Merkle Sealer   (SHA-256; ECDSA P-256 raw r||s; Merkle por perfil)
        ↓
Audit Package Generator        (manifest assinado + proofs)
        ↓        ← FONTE DA VERDADE TERMINA AQUI
Control Mapping Engine
        ↓
Renderer                       (view derivada; emite report_derivation)
        ↓
Audit Package  +  Audit Dossier
        ↓
Verifier CLI / Auditor Portal
```

### 5.1 Papel de cada camada e alinhamento com a mecânica REX Guard existente

**[FATO]** (mecânica de produção, conforme implementação REX Guard/Veritas): o pipeline de runtime do REX Guard intercepta cada chamada Gemini/Vertex AI e executa, em ordem, gates de consentimento (`ConsentValidator`, Redis 60s + OPIN), segurança (`SecurityGates`: PII mask, OFAC stub, Burn/prompt-injection stub), inferência, e então:

- `ChainHeadRepository` — transação atômica no Spanner que encadeia o recibo ao anterior via `prev_hash` usando TrueTime para ordenação;
- `ReciboSigner.seal` — assinatura **ECDSA P-256 via Cloud KMS HSM**, formato **raw `r||s` (128 hex chars = 64 bytes), nunca DER** (`derToRawHex()`);
- `AuditOutbox.enqueue` — escrita assíncrona Spanner → BigQuery WORM;
- `NotarizationService` — constrói a Merkle chain e faz notarização diária.

> **[DECISÃO]** O EAC **consome** os artefatos acima; não os reimplementa nem os substitui. Há, portanto, **duas cadeias** na mecânica real, e o modelo de dados do EAC reflete ambas:
> 
> 1. **Hash-linked chain** (por decisão): cada recibo aponta ao anterior via `prev_hash` (ChainHead/Spanner TrueTime). No AEIR isto é o campo `previous_event_hash`.
> 1. **Merkle tree** (por batch/notarização diária): `merkle_root` + `merkle_position`, produzida pela `NotarizationService`.

> **[DECISÃO] Perfis de Merkle (conflito real resolvido).** A construção de Merkle atualmente implementada concatena os hashes hex dos filhos **sem domain separation** entre folha e nó interno (estilo Bitcoin: `pairHash(l,r) = sha256(hex(l)||hex(r))`). A RFC 9162 (CT v2.0) especifica **domain separation** explícita: folha = `HASH(0x00 || data)`, nó interno = `HASH(0x01 || left || right)`, e o próprio texto da RFC afirma que “this domain separation is required to give second preimage resistance” (`https://www.rfc-editor.org/rfc/rfc9162.html`, §2.1.1). Esta é uma divergência de segurança real. O EAC resolve declarando o perfil de Merkle **explicitamente no manifest** (`merkle_profile`):
> 
> - `rexguard-legacy-v1` — concatenação hex sem domain separation. **Necessário** para verificar Merkle roots já seladas pela `NotarizationService` atual. Carrega **[RISCO] R-12** (ausência de second-preimage resistance no nível da árvore). O verifier implementa, mas marca o resultado com um aviso.
> - `rfc9162-sha256` — domain separation `0x00`/`0x01` conforme RFC 9162 §2.1.1. **Recomendado** para toda evidência nova. Greenfield.
> 
> **[FATO/CAVEAT]** RFC 9162 é **Experimental** (não Standards Track) e obsoleta a RFC 6962; a maior parte do Web PKI ainda opera contra a 6962. As construções de Merkle Tree Hash, inclusion proof e consistency proof são matematicamente idênticas entre 6962 e 9162. O enquadramento defensável para auditor é: “adotamos as construções de Merkle Tree Hash, inclusion-proof e consistency-proof especificadas na RFC 9162 §§2.1.1–2.1.4, formalização canônica IETF da construção CT original (RFC 6962, 2013).”

-----

## 6. Core Concepts

Cada definição é objetiva, operacional e testável. Os contratos formais estão em §14; os schemas executáveis em `/schemas`.

- **Raw Evidence** — Bytes originais extraídos de uma fonte (linha de log, recibo do Spanner, span OTel), preservados sem transformação. Invariante: imutável; referenciado por hash em `raw-evidence-index.json`. Teste: §11.9 (raw indisponível → `RAW_EVIDENCE_UNRESOLVED`).
- **Canonical Evidence Record** — Raw Evidence normalizado e canonicalizado (RFC 8785), ainda específico do sistema de origem. Invariante: canonicalização determinística (mesmo conteúdo → mesmos bytes → mesmo hash).
- **AEIR (Audit Evidence Intermediate Representation)** — Representação canônica intermediária unificada; fonte da verdade. Detalhe em §8.
- **Decision Evidence Envelope** — Estrutura que liga uma decisão (Veritas) a seus commitments: `input_hash`, `policy_snapshot_hash`, `model_hash`, `threshold`, `jurisdiction`, `decision_commitment`, `signature`, posição na cadeia, links de reversão. Mapeia o `SealedRecibo` + a semântica de decisão Veritas.
- **Policy Snapshot** — Estado imutável da policy ativa no instante da decisão, referenciada por `policy_snapshot_hash`. Invariante: nunca hardcoded; sempre resolvível. Teste: §11.7 (ausente → `POLICY_HASH_UNRESOLVED`).
- **Model Binding** — Liga uma decisão ao modelo: `model_id`, `model_version`, `model_hash`, perfil de inferência, status de drift. Teste: §11.3.
- **Rationale Commitment** — Commitment criptográfico (hash) sobre o racional da decisão, permitindo *sealed rationale*: provar que o racional existia e não mudou, sem revelá-lo. Invariante: o hash é verificável; o conteúdo pode estar selado/redigido.
- **Merkle Audit Chain** — A árvore de Merkle (por perfil; §5.1) sobre o batch de evidências, com `merkle_root` e `merkle_position` por registro.
- **Audit Package Manifest** — Índice assinado do pacote: lista de arquivos com hashes, perfil de Merkle, root, chaves, perfis de disclosure. É o ponto de entrada da verificação.
- **Control Mapping** — Associação evidência → controle (regulatório ou interno). Não conclui conformidade. Invariante: todo controle mapeado tem ao menos uma evidência e um teste. Teste: §11.7.
- **Verifier Profile** — Conjunto de checagens que um verificador deve executar e quais devem bloquear. Permite perfis distintos (interno vs. auditor externo).
- **Human-Readable Audit Dossier** — View derivada (MD/HTML/PDF). Nunca fonte da verdade.
- **Machine-Verifiable Audit Package** — O artefato canônico autocontido. Fonte da verdade.
- **Auditnits** — Conjunto de checagens automáticas de “higiene” do pacote (análogo ao idnits do IETF): presença de campos obrigatórios, consistência de contagens, ausência de PII fora de disclosure, etc.
- **Test Vector** — Par entrada/resultado-esperado que exercita uma checagem específica (§12, `/test-vectors`).
- **Evidence Invariant** — Propriedade que toda evidência válida deve satisfazer (ex.: “todo evento crítico tem `event_id`, `trace_id`, `payload_hash`, `signature`”). Cada invariante tem teste positivo e negativo.
- **Disclosure Profile** — Define o que pode ser revelado a qual audiência (auditor interno vê mais que pacote público). Teste: §11.8.
- **Redaction Policy** — Regras determinísticas de redação (o que é mascarado, como, e como permanece verificável). Teste: §11.8.

-----

## 7. System Responsibilities

Evidências esperadas por sistema. Campos marcados `[TODO]` precisam ser confirmados contra a implementação de produção antes de DML-2.

### 7.1 Rex (runtime / proxy de compliance)

`execution event`, `route`, `tenant_id`, `actor`, `trace_id`, `span_id` (OTel), `latency`, `cloud_run_revision`, `region`, `policy invoked` (→ `policy_snapshot_hash`), `decision requested`, `status` (success/error; **fail-closed**: payload desconhecido → `SCOPE_MISMATCH`, nunca `ALLOWED`), `request_hash`, `response_hash`.

### 7.2 Veritas (decisão)

`decision_id` (UUID v7), `input_hash`, `policy_snapshot_hash`, `model_hash`, `rationale_hash` (Rationale Commitment), `threshold`, `score`, `decision_type`, `signature` (ECDSA P-256 raw `r||s`), `merkle_position`, `merkle_root`, `previous_event_hash` (ChainHead `prev_hash`), `reversal_link`, `disclosure_profile`, `verifier_profile`, `decision_commitment` (ver §8.2 e §14).

### 7.3 Guardian AI (modelo)

`model_id`, `model_hash`, `inference_profile`, `drift_status`, `feature_commitments`, `confidence_band`, `guardrail_result`, `model_version`, `evaluation_metadata`, `model_card_reference`.

### 7.4 Burn Engine (regras)

`ruleset_id`, `ruleset_hash`, `rule_fired`, `rule_skipped`, `exception`, `override`, `rollback`, `approval_chain`, `signed_rule_execution_log`.

-----

## 8. AEIR — Audit Evidence Intermediate Representation

### 8.1 Propriedades

A AEIR é a representação canônica intermediária e a **fonte da verdade**. Relatórios são views derivadas. A AEIR:

- é determinística (canonicalização RFC 8785 → bytes estáveis → hash estável);
- é versionada (`schema_version`);
- é validada por JSON Schema 2020-12;
- suporta redaction e selective disclosure;
- permite recomputação de hashes e de `decision_commitment`;
- preserva *lineage* entre raw evidence e dossiê (`raw-evidence-index.json`).

### 8.2 DecisionID vs. Decision Commitment — distinção mandatória

> **[DECISÃO]** São dois conceitos distintos, frequentemente confundidos:
> 
> - **`decision_id`** — **UUID v7** (timestamp embutido + entropy). É um *identificador* globalmente ordenável. **Não é recomputável** a partir dos inputs (contém entropy). Escolha de UUID v7 (não v4: perde ordenação; não ULID: compatibilidade BigQuery pior).
> - **`decision_commitment`** — hash **recomputável** sobre os campos da decisão. É o que o teste “DecisionID recompute” (§11.3) de fato verifica.

**[TODO: confirm production formula]** A fórmula base assumida para o `decision_commitment` é:

```text
decision_commitment = "sha256:" + SHA256(
    JCS_canonical({
      input_hash,
      policy_snapshot_hash,
      model_hash,
      threshold,
      jurisdiction
    })
)
```

**[ASSUMPTION]** Assume-se que estes cinco campos são suficientes e que a canonicalização é RFC 8785. **Se a implementação Veritas de produção incluir campos adicionais** (ex.: `tenant_id`, `model_version`, `ruleset_hash`, nonce), o commitment recomputado divergirá e o teste §11.3 falhará legitimamente. O contrato (§14) e a função do verifier (`checks/decision-id.ts`) marcam isto como stub a confirmar; **não foram inventados campos para “parecer completo”**.

### 8.3 Exemplo de AuditEvidenceRecord (AEIR)

```json
{
  "schema_version": "aeir.audit_evidence_record.v1",
  "event_id": "evt_01HX0000000000000000000000",
  "event_type": "decision.executed",
  "system": "veritas",
  "occurred_at": "2026-05-23T14:32:11.203Z",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "span_id": "00f067aa0ba902b7",
  "actor": { "type": "service", "id": "rex-runtime" },
  "subject": { "type": "opaque_ref", "hash": "sha256:0000000000000000000000000000000000000000000000000000000000000000" },
  "jurisdiction": "BR",
  "payload_hash": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
  "previous_event_hash": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
  "signature": "base64url-raw-r-s..."
}
```

-----

## 9. Audit Package Structure

```text
/audit-package
  manifest.json              # índice assinado: arquivos+hashes, merkle_profile, root, chaves, disclosure
  evidence.ndjson            # AEIR, um registro por linha (streaming-friendly)
  evidence.cbor              # mesma AEIR em CBOR (serialização binária compacta; opcional)
  report.md                  # dossiê humano (view derivada)
  report.html                # idem
  report.pdf                 # idem
  controls-mapping.json      # evidência → controle (sem concluir conformidade)
  decision-samples/          # amostras de Decision Evidence Envelopes para inspeção
  merkle-proofs/             # inclusion proofs por registro (e consistency proofs entre roots)
  signatures/                # assinaturas destacadas (DSSE quando aplicável)
  schemas/                   # cópia dos JSON Schemas usados (auto-contido)
  test-vectors/              # vetores que o auditor pode reexecutar
  verification-result.json   # resultado da última verificação interna (informativo, não autoritativo)
  raw-evidence-index.json    # índice de raw evidence (hashes + ponteiros de fallback forense)
  provenance.json            # proveniência do build do pacote (in-toto/SLSA-style; ver §16)
  README.md                  # instruções de verificação para o auditor
```

> **[DECISÃO]** `verification-result.json` é **informativo**, não autoritativo. O auditor não confia nele; ele reexecuta `foundlab-audit verify` e compara. Incluí-lo serve apenas para triagem rápida.

> **[FATO]** `provenance.json` segue o framework de atestação in-toto com `predicateType: https://slsa.dev/provenance/v1`, idealmente embrulhado em envelope DSSE. SLSA é spec da OpenSSF; a versão Approved atual é **SLSA v1.2** (24/nov/2025, `https://slsa.dev/blog/2025/11/announce-slsa-v1.2`), com Build Track de níveis nomeados **Build L0/L1/L2/L3**. Objetivo de design do pipeline do EAC: **Build L3** (plataforma de build endurecida, isolamento entre execuções, chaves de assinatura inacessíveis a passos definidos pelo usuário). **Não** se reivindica “SLSA Level 4” — o nível 4 foi adiado e não faz parte de nenhum Build Track v1.x.

-----

## 10. Verification Model

O auditor executa:

```bash
foundlab-audit verify ./audit-package
```

Saída esperada (sucesso):

```json
{
  "status": "pass",
  "root_hash_verified": true,
  "signatures_verified": true,
  "schema_valid": true,
  "decision_ids_recomputed": true,
  "merkle_chain_valid": true,
  "policy_hashes_resolved": true,
  "model_hashes_resolved": true,
  "redaction_policy_valid": true,
  "report_derivation_valid": true,
  "exceptions": []
}
```

Saída de falha (exemplo):

```json
{
  "status": "fail",
  "root_hash_verified": false,
  "signatures_verified": true,
  "schema_valid": true,
  "decision_ids_recomputed": false,
  "merkle_chain_valid": false,
  "exceptions": [
    {
      "code": "MERKLE_ROOT_MISMATCH",
      "severity": "blocking",
      "evidence_ref": "evt_01HX...",
      "message": "Computed root hash does not match manifest root hash."
    }
  ]
}
```

### 10.1 Explicação de cada verificação

- **schema_valid** — Cada registro valida contra o JSON Schema 2020-12 correspondente. Falha → `AEIR_SCHEMA_INVALID` / `AEIR_REQUIRED_FIELD_MISSING`.
- **root_hash_verified** — O `merkle_root` recomputado a partir das folhas (no `merkle_profile` declarado) bate com o root no manifest. Falha → `MERKLE_ROOT_MISMATCH`.
- **merkle_chain_valid** — As inclusion proofs em `merkle-proofs/` verificam para cada registro; a consistency proof (se presente) liga roots sucessivos. Falha → `MERKLE_PROOF_INVALID`.
- **signatures_verified** — Cada assinatura ECDSA P-256 (raw `r||s`) verifica contra a chave pública declarada, sobre os bytes canônicos corretos. Falha → `SIGNATURE_INVALID` / `SIGNATURE_KEY_REVOKED`.
- **decision_ids_recomputed** — O `decision_commitment` recomputado (§8.2) bate com o registrado. **Stub/contract** enquanto a fórmula de produção não é confirmada. Falha → `DECISION_ID_RECOMPUTE_FAILED`.
- **policy_hashes_resolved** — Todo `policy_snapshot_hash` referenciado é resolvível para um Policy Snapshot presente/indexado. Falha → `POLICY_HASH_UNRESOLVED`.
- **model_hashes_resolved** — Idem para `model_hash`. Falha → `MODEL_HASH_UNRESOLVED`.
- **redaction_policy_valid** — Nenhum campo sensível aparece fora das regras de disclosure; redações são determinísticas e verificáveis. Falha → `REDACTION_POLICY_VIOLATED`.
- **report_derivation_valid** — O dossiê renderizado deriva exclusivamente do pacote: o renderer registra os `event_id`/hashes que consumiu, e o verifier confirma que cada afirmação do relatório tem lastro na AEIR e que nenhum dado foi introduzido. Falha → `REPORT_DERIVATION_FAILED`. **Este é o mecanismo que sustenta o invariante “renderer nunca é fonte da verdade”.**

> **[DECISÃO]** O resultado de `merkle_chain_valid`/`root_hash_verified` sob `merkle_profile: rexguard-legacy-v1` é acompanhado de `warning: SECOND_PREIMAGE_DOMAIN_SEPARATION_ABSENT` (R-12). A verificação **passa** (a evidência legada é válida no esquema em que foi selada), mas o aviso é propagado ao relatório.

-----

## 11. Mandatory Test Strategy

Seção obrigatória, não resumível. Cada subtipo tem ao menos um vetor em `/test-vectors`.

### 11.1 Schema Tests

Campos obrigatórios; tipos; timestamps (ISO 8601 com timezone, rejeitar naive); formatos de hash (`^sha256:[a-f0-9]{64}$`); enums; `schema_version`; compatibilidade entre versões (downgrade → `SCHEMA_DOWNGRADE_ATTEMPT`).

### 11.2 Hash Determinism Tests

Mesma entrada → mesmo hash; mudança mínima → hash diferente; canonicalização JCS (RFC 8785); ordenação de campos irrelevante ao resultado; normalização de timestamp; encoding estável (UTF-8).

### 11.3 DecisionID / Commitment Recompute Tests

Recomputação do `decision_commitment`; alteração de `input_hash`; de `policy_snapshot_hash`; de `model_hash`; de `threshold`; de `jurisdiction` — cada uma deve mudar o commitment. **Stub** até confirmação da fórmula de produção (§8.2).

### 11.4 Merkle Chain Tests

Inclusão de evento; ordem dos eventos; prova de inclusão; evento removido; evento alterado; cadeia quebrada; root divergente. Executar sob **ambos** os perfis (`rexguard-legacy-v1` e `rfc9162-sha256`).

### 11.5 Signature Tests

Assinatura válida; inválida; chave revogada; key rotation; assinatura sobre payload errado; alteração após assinatura. Validar formato raw `r||s` (rejeitar DER silenciosamente convertido).

### 11.6 Renderer Tests

Markdown/HTML/PDF derivam da AEIR; relatório não contém campos sensíveis indevidos; redações aparecem; links internos funcionam; tabelas de controle batem com a evidência; `report_derivation_valid` = true.

### 11.7 Control Mapping Tests

Cada controle tem evidência; evidência inexistente → `CONTROL_WITHOUT_EVIDENCE`; controle sem teste falha; controle com exceção aparece em seção própria; múltiplos frameworks podem mapear a mesma evidência.

### 11.8 Privacy and Redaction Tests

PII não aparece em relatório público; hash de subject estável; payload sensível permanece selado; selective disclosure revela apenas o permitido; rationale selado verificável sem revelar conteúdo.

### 11.9 Negative Tests

Evento sem assinatura; `policy_snapshot_hash` ausente; `decision_commitment` inconsistente; timestamp fora do período; evento duplicado (`DUPLICATE_EVENT`); evento órfão (`ORPHAN_EVENT`, sem `previous_event_hash` resolvível); sistema desconhecido (`UNKNOWN_SYSTEM`); `schema_version` incompatível; raw evidence indisponível (`RAW_EVIDENCE_UNRESOLVED`).

### 11.10 Auditor Acceptance Tests

Para cada pergunta, o campo/arquivo/teste correspondente:

|Pergunta do auditor             |Onde responder                                                              |
|--------------------------------|----------------------------------------------------------------------------|
|Qual decisão foi tomada?        |`decision_type`, `score` no Decision Evidence Envelope (`decision-samples/`)|
|Qual política estava ativa?     |`policy_snapshot_hash` → Policy Snapshot (check `policy_hashes_resolved`)   |
|Qual modelo foi usado?          |`model_hash`/`model_version` → Model Binding (check `model_hashes_resolved`)|
|O input foi alterado?           |recompute `decision_commitment` (§11.3)                                     |
|Houve override?                 |Burn Engine `override` em AEIR; evento `decision.override`                  |
|Houve reversão?                 |`reversal_link`; evento `decision.reversed`                                 |
|Qual jurisdição se aplica?      |`jurisdiction` no AEIR                                                      |
|A cadeia está íntegra?          |`merkle_chain_valid` + `previous_event_hash` linkage                        |
|O relatório deriva da evidência?|`report_derivation_valid`                                                   |

-----

## 12. Test Vectors

Mínimo de 10 vetores em `/test-vectors` (esquema em `/schemas` não é necessário para o vetor em si; o vetor referencia o pacote/fixture). Formato:

```json
{
  "test_vector_id": "tv_001",
  "description": "Minimal valid audit package.",
  "input": {},
  "expected_result": "pass",
  "expected_error_code": null
}
```

Obrigatórios: (1) pacote válido mínimo; (2) hash inválido; (3) `decision_commitment` inconsistente; (4) cadeia Merkle quebrada; (5) assinatura inválida; (6) redaction correta; (7) Policy Snapshot ausente; (8) ReversalEvent válido; (9) OverrideEvent válido; (10) evento fora do período de auditoria.

-----

## 13. Draft Maturity Level

```text
DML-0: Concept only
DML-1: Draft schema
DML-2: Test vectors defined
DML-3: Local verifier prototype
DML-4: Internal audit simulation
DML-5: External auditor pilot
DML-6: Production package profile
```

> **[DECISÃO]** Estado atual: **DML-1**, transicionando para DML-2/DML-3. Justificativa: este documento entrega os schemas (DML-1), os 10 test vectors (DML-2) e um verifier local minimalista (DML-3) — mas o verifier ainda usa stubs (DecisionID, resolução de policy/model por índice, verificação de assinatura dependente de chave fornecida) e não foi exercitado contra evidência de produção real. Não reivindico DML-3 “completo”.

**Critérios objetivos para avançar:**

- **→ DML-2:** todos os 10 vetores executam contra o verifier com resultado esperado. *(parcial: vetores entregues; execução fim-a-fim contra fixtures reais pendente)*
- **→ DML-3:** verifier valida um pacote real (não-fixture) com chaves reais; `decision_commitment` confirmado contra Veritas de produção.
- **→ DML-4:** simulação de auditoria interna sobre Rex+Veritas reais; primeiro audit package real gerado.
- **→ DML-5:** pacote entregue a auditor externo; feedback coletado.
- **→ DML-6:** integração CI/CD; geração periódica assinada; provenance SLSA Build L3.

-----

## 14. Output Contracts

Para cada contrato: descrição, campos obrigatórios/opcionais, invariantes, exemplo, erros, testes. Os schemas executáveis estão em `/schemas`. Resumo:

### 14.1 AuditEvidenceRecord

- **Descrição:** unidade base da AEIR.
- **Obrigatórios:** `schema_version`, `event_id`, `event_type`, `system`, `occurred_at`, `payload_hash`.
- **Opcionais:** `trace_id`, `span_id`, `actor`, `subject`, `jurisdiction`, `previous_event_hash`, `signature`.
- **Invariantes:** `payload_hash` recomputável da canonicalização do payload; `occurred_at` com timezone; `system` ∈ enum {rex, veritas, guardian, burn}.
- **Erros:** `AEIR_SCHEMA_INVALID`, `AEIR_REQUIRED_FIELD_MISSING`, `UNKNOWN_SYSTEM`, `HASH_MISMATCH`.
- **Testes:** §11.1, §11.2, §11.9.

### 14.2 DecisionEvidenceEnvelope

- **Obrigatórios:** `decision_id` (UUID v7), `input_hash`, `policy_snapshot_hash`, `model_hash`, `threshold`, `jurisdiction`, `decision_commitment`, `signature`.
- **Opcionais:** `score`, `decision_type`, `rationale_hash`, `reversal_link`, `merkle_position`, `merkle_root`, `previous_event_hash`, `disclosure_profile`, `verifier_profile`.
- **Invariantes:** `decision_commitment` recomputável (§8.2, **[TODO]**); `decision_id` casa o padrão UUID v7.
- **Erros:** `DECISION_ID_RECOMPUTE_FAILED`, `POLICY_HASH_UNRESOLVED`, `MODEL_HASH_UNRESOLVED`, `SIGNATURE_INVALID`.
- **Testes:** §11.3, §11.5.

### 14.3 PolicySnapshot

- **Obrigatórios:** `policy_snapshot_hash`, `captured_at`, `policy_body_ref` (ou inline redacted).
- **Invariantes:** nunca hardcoded; resolvível; hash bate com o corpo.
- **Erros:** `POLICY_HASH_UNRESOLVED`.
- **Testes:** §11.7.

### 14.4 ModelBinding

- **Obrigatórios:** `model_id`, `model_version`, `model_hash`.
- **Opcionais:** `inference_profile`, `drift_status`, `confidence_band`, `model_card_reference`.
- **Erros:** `MODEL_HASH_UNRESOLVED`.

### 14.5 ControlMapping

- **Obrigatórios:** `control_id`, `framework`, `evidence_refs[]` (≥1), `test_refs[]` (≥1).
- **Invariantes:** evidência e teste existem; não conclui conformidade.
- **Erros:** `CONTROL_WITHOUT_EVIDENCE`.

### 14.6 AuditPackageManifest

- **Obrigatórios:** `package_id`, `created_at`, `files[]` (path+hash), `merkle_profile`, `merkle_root`, `signing_keys[]`, `signature`.
- **Invariantes:** todo arquivo do pacote está listado com hash correto; manifest assinado.
- **Erros:** `HASH_MISMATCH`, `SIGNATURE_INVALID`, `MERKLE_ROOT_MISMATCH`.

### 14.7 VerificationResult

- **Obrigatórios:** `status` (pass/fail), os booleanos de §10, `exceptions[]`.
- **Invariante:** `status=pass` ⇔ nenhum exception `severity=blocking`.

### 14.8 RedactionPolicy

- **Obrigatórios:** `rules[]` (campo, método, escopo de disclosure).
- **Invariante:** redação determinística; resultado verificável.
- **Erros:** `REDACTION_POLICY_VIOLATED`.

### 14.9 DisclosureProfile

- **Obrigatórios:** `profile_id`, `allowed_fields[]` por audiência.
- **Erros:** `REDACTION_POLICY_VIOLATED`.

### 14.10 MerkleProof

- **Obrigatórios:** `leaf_index`, `tree_size`, `inclusion_path[]`, `merkle_root`, `merkle_profile`.
- **Invariante:** recomputar root a partir de folha+path = `merkle_root`.
- **Erros:** `MERKLE_PROOF_INVALID`, `MERKLE_ROOT_MISMATCH`.

-----

## 15. Error Codes

```text
AEIR_SCHEMA_INVALID            # registro não valida contra schema
AEIR_REQUIRED_FIELD_MISSING    # campo obrigatório ausente
HASH_MISMATCH                  # hash recomputado ≠ declarado
SIGNATURE_INVALID              # assinatura não verifica
SIGNATURE_KEY_REVOKED          # chave revogada/expirada
MERKLE_ROOT_MISMATCH           # root recomputado ≠ manifest
MERKLE_PROOF_INVALID           # inclusion/consistency proof falha
DECISION_ID_RECOMPUTE_FAILED   # decision_commitment recomputado ≠ registrado
POLICY_HASH_UNRESOLVED         # policy_snapshot_hash não resolvível
MODEL_HASH_UNRESOLVED          # model_hash não resolvível
CONTROL_WITHOUT_EVIDENCE       # controle mapeado sem evidência/teste
REDACTION_POLICY_VIOLATED      # campo sensível fora da regra de disclosure
UNKNOWN_SYSTEM                 # system fora do enum
EVENT_OUT_OF_SCOPE             # evento fora do período/escopo de auditoria
DUPLICATE_EVENT                # event_id repetido
ORPHAN_EVENT                   # previous_event_hash não resolvível
REPORT_DERIVATION_FAILED       # relatório não deriva da AEIR
SCHEMA_DOWNGRADE_ATTEMPT       # tentativa de usar schema_version anterior
RAW_EVIDENCE_UNRESOLVED        # raw evidence indisponível para fallback
```

Para cada erro — causa provável, severidade, ação corretiva, se bloqueia, teste associado — ver a tabela em `/cli/command-spec.md` (seção “Error taxonomy”), onde a taxonomia é mantida em forma operacional para o verifier.

-----

## 16. Security Considerations

|Ameaça                                 |Mitigação                                                                                 |Teste       |
|---------------------------------------|------------------------------------------------------------------------------------------|------------|
|Adulteração de logs                    |Hash + assinatura + Merkle; raw evidence imutável indexada                                |§11.2, §11.4|
|Replay de eventos                      |`event_id` único + `DUPLICATE_EVENT`; ordenação por UUID v7/TrueTime                      |§11.9       |
|Manipulação de timestamp               |TSA RFC 3161 sobre o root (mecânica REX Guard); rejeição de timestamp naive               |§11.1       |
|Vazamento de dados sensíveis           |Redaction determinística; selective disclosure; sealed rationale; crypto-shredding via KMS|§11.8       |
|Assinatura com chave comprometida      |`SIGNATURE_KEY_REVOKED`; rotação de chave; provenance                                     |§11.5       |
|Geração de relatório falso             |`report_derivation_valid`; renderer não é fonte da verdade                                |§11.6       |
|Inconsistência relatório × evidência   |`REPORT_DERIVATION_FAILED`                                                                |§11.6       |
|Downgrade de schema                    |`SCHEMA_DOWNGRADE_ATTEMPT`                                                                |§11.1       |
|Colisão / uso incorreto de hash        |SHA-256; domain separation no perfil `rfc9162-sha256` (R-12 no legacy)                    |§11.4       |
|Comprometimento do pipeline de build   |Provenance SLSA (objetivo Build L3); DSSE; isolamento                                     |§16.1       |
|Dependência excessiva do cloud provider|Pacote autocontido + verifier offline; raw evidence preservada                            |§11.9       |
|Exfiltração via relatório renderizado  |Disclosure profile + auditnits no render                                                  |§11.8       |

### 16.1 Nota sobre PAE/DSSE (anti-confusão de tipo)

> **[FATO]** DSSE é uma **especificação comunitária** (Secure Systems Lab, NYU; `https://github.com/secure-systems-lab/dsse`), **não** um RFC IETF. Tag estável atual v1.0.0. O envelope é `{payload, payloadType, signatures:[{keyid, sig}]}` e a assinatura é computada sobre o **PAE (Pre-Authentication Encoding)**: `"DSSEv1" SP LEN(type) SP type SP LEN(body) SP body`. O PAE vincula um `payloadType` explícito ao corpo, prevenindo que um verificador aceite bytes assinados sob outro tipo (confusão de tipo). Regra de implementação crítica: o mesmo `SERIALIZED_BODY` verificado deve ser o entregue à aplicação — nunca re-parsear o envelope após verificação. Se um anchor IETF for exigido em vez de DSSE, o par de fallback é JWS (RFC 7515) + JCS (RFC 8785), com perda da proteção do PAE.

-----

## 17. Privacy Considerations

- **Minimização de dados** — AEIR carrega hashes, não payloads em claro. (Mecânica REX Guard: input/output **nunca** persistidos em claro, apenas hashes.)
- **Pseudonimização / hashing de subject** — `subject` é `opaque_ref` com hash estável; o mesmo subject hasheia igual (permite correlação sem reidentificação direta).
- **Selective disclosure** — Disclosure Profile controla o que cada audiência vê.
- **Sealed rationale** — Rationale Commitment permite provar existência/imutabilidade do racional sem revelá-lo.
- **Segregação por jurisdição** — Campo `jurisdiction`; **[DECISÃO]** nunca misturar tenants no mesmo batch Merkle (cross-contamination de evidência).
- **Política de retenção / Retention Paradox** — **[FATO]** BCB 538/2025 exige retenção de logs de decisão; LGPD Art. 18 VI dá direito de deleção. A mecânica REX Guard resolve via **crypto-shredding**: o registro permanece (compliance bancário), a chave de envelope é destruída no Cloud KMS (`shred_key()` real, não flag) — deleção criptográfica satisfaz LGPD. O `envelope_key_ref` no recibo aponta, após shred, para chave destruída: recibo verificável, payload original inacessível.
- **Redaction determinística** — Redação reproduzível e verificável.
- **Risco de reidentificação** — **[RISCO]** R-03: hashes de subject estáveis permitem correlação; se o espaço de subjects for pequeno, ataque de dicionário reidentifica. Mitigação: salt por tenant **[TODO: confirmar se há salt na implementação]**.
- **Separação raw evidence × dossiê** — Raw evidence é fallback forense de acesso restrito; o dossiê é a view divulgável.

-----

## 18. Compliance and Audit Considerations

Sem prometer conformidade automática. Distinção mandatória:

- **Evidência técnica** — o que o EAC produz (hashes, proofs, assinaturas).
- **Conclusão de auditoria** — julgamento humano do auditor sobre a evidência.
- **Controle interno** — processo da organização.
- **Requisito regulatório** — norma externa (BCB 538/2025, LGPD).
- **Prova criptográfica** — propriedade matemática (integridade, autenticidade).
- **Julgamento humano do auditor** — insubstituível.

```text
The system provides verifiable evidence.
It does not replace legal, regulatory, or audit judgment.
```

### 18.1 Regulatory mapping (parcial — honesto)

|Requisito                              |Fonte          |Como o EAC endereça                                                         |Gap                                                 |
|---------------------------------------|---------------|----------------------------------------------------------------------------|----------------------------------------------------|
|Retenção/integridade de logs de decisão|BCB 538/2025   |Pacote verificável liga decisão→policy→modelo→IO por hash; Merkle+assinatura|partial — depende da NotarizationService de produção|
|Defesa de decisão histórica            |BCB 538/2025   |`decision_commitment` recomputável + Policy Snapshot                        |partial — **[TODO]** fórmula de commitment          |
|Direito de deleção                     |LGPD Art. 18 VI|Crypto-shredding (KMS) preserva recibo, destrói chave                       |partial — verificar grace period KMS                |
|Não reidentificação                    |LGPD           |`opaque_ref` + hashing                                                      |partial — **[RISCO]** R-03 salt                     |


> Marcas “partial”/“TBD” são deliberadas e justificadas. Não há declaração de conformidade.

-----

## 19. Implementation Roadmap

- **Phase 0 — Concept Draft:** escrever documentação; definir AEIR; listar evidências existentes; mapear gaps. *(este documento)*
- **Phase 1 — Schema and Test Vectors:** criar schemas (`/schemas`); exemplos válidos/inválidos; test vectors (`/test-vectors`); error codes (§15). *(entregue)*
- **Phase 2 — Local CLI Prototype:** validar pacote local; recomputar hashes; validar assinaturas; gerar relatório Markdown. *(verifier minimalista entregue; render pendente)*
- **Phase 3 — Internal Audit Simulation:** simular auditoria de Rex e Veritas; gerar primeiro audit package real; testar perguntas de auditor.
- **Phase 4 — External Pilot:** entregar pacote a auditor/parceiro; coletar feedback; ajustar control mappings.
- **Phase 5 — Production Profile:** integrar CI/CD; Cloud Logging/BigQuery/OTel/KMS; assinar pacotes; geração periódica; provenance SLSA Build L3.

-----

## 20. Open Questions

1. **[TODO]** Fórmula de produção do `decision_commitment` — quais campos exatos Veritas inclui? (§8.2)
1. Canonicalização: usar JCS (RFC 8785) para JSON e CBOR (RFC 8949) para o binário; NDJSON é só transporte. Confirmar se CBOR é necessário no MVP.
1. Envelope: DSSE v1.0.0 quando aplicável; JWS (RFC 7515) como fallback IETF. Definir o critério de escolha por artefato.
1. Algoritmo de assinatura: ECDSA P-256 raw `r||s` (alinhado ao ReciboSigner). Pareamento com FIPS 186-5 / RFC 6979 (k determinístico) a confirmar.
1. Rotação de chaves: como o pacote referencia chave revogada vs. vigente? `signing_keys[]` com validade.
1. Granularidade da Merkle tree: por batch diário (NotarizationService) ou por período de auditoria? Ambos?
1. Preservação de raw evidence: por quanto tempo e onde (BigQuery WORM vs. cold storage)?
1. Quanto revelar no rationale por padrão? Sealed por default, disclosure sob perfil.
1. Mapeamento de controles entre frameworks distintos (BCB vs. futuros): modelo many-to-many.
1. Versionamento de schemas: política de compat e bloqueio de downgrade.
1. Perfil mínimo para auditor externo (Verifier Profile “external”).
1. Como provar que o renderer não alterou conteúdo além do `report_derivation`? (assinar o dossiê? hash do dossiê no manifest?)
1. Eventos retroativos: como entram sem violar append-only?
1. Correções de evidência: emitir evento de correção (nunca alterar o original) — modelar `evidence.correction`.
1. Logs parcialmente indisponíveis: `RAW_EVIDENCE_UNRESOLVED` bloqueia o pacote ou marca degradado?
1. **[RISCO/Open]** Perfil Merkle legacy (`rexguard-legacy-v1`) sem domain separation: migrar a NotarizationService para `rfc9162-sha256` é viável sem quebrar roots históricos? (R-12)

-----

## 21. Risks and Mitigations (Risk Register)

|ID  |Risco                                                |Impacto|Prob.|Mitigação                                                   |Teste |
|----|-----------------------------------------------------|-------|-----|------------------------------------------------------------|------|
|R-01|Complexidade excessiva afasta adoção                 |Alto   |Média|MVP minimalista; CLI antes do Portal                        |—     |
|R-02|Auditor não aceita o pacote                          |Alto   |Média|Pilot externo cedo (Phase 4); command-spec agnóstico        |§11.10|
|R-03|Reidentificação via hash de subject                  |Alto   |Média|Salt por tenant **[TODO]**                                  |§11.8 |
|R-04|Dependência de cloud provider                        |Médio  |Média|Pacote autocontido; verifier offline                        |§11.9 |
|R-05|Falso senso de conformidade                          |Alto   |Média|§18 separa evidência de conclusão; sem claim regulatório    |—     |
|R-06|Inconsistência entre sistemas                        |Médio  |Média|AEIR unificada; `UNKNOWN_SYSTEM`                            |§11.9 |
|R-07|Falta de test vectors                                |Médio  |Baixa|10 vetores entregues                                        |§12   |
|R-08|Renderer tratado como fonte da verdade               |Alto   |Média|Ordem seal→package→render; `report_derivation_valid`        |§11.6 |
|R-09|Schema imaturo                                       |Médio  |Alta |DML explícito; versionamento; downgrade bloqueado           |§11.1 |
|R-10|Logs incompletos                                     |Médio  |Média|`RAW_EVIDENCE_UNRESOLVED`; modo degradado a definir         |§11.9 |
|R-11|Canonicalização instável                             |Alto   |Baixa|RFC 8785 JCS; testes de determinismo                        |§11.2 |
|R-12|Merkle legacy sem domain separation (second-preimage)|Alto   |Média|Perfil `rfc9162-sha256` para evidência nova; aviso no legacy|§11.4 |
|R-13|Falha na rotação de chaves                           |Médio  |Baixa|`signing_keys[]` com validade; `SIGNATURE_KEY_REVOKED`      |§11.5 |
|R-14|Raw evidence indisponível                            |Médio  |Média|Índice + fallback; política de retenção                     |§11.9 |
|R-15|Relatório humano divergente da AEIR                  |Alto   |Média|`REPORT_DERIVATION_FAILED`                                  |§11.6 |
|R-16|DSSE é spec comunitária (não IETF)                   |Baixo  |—    |Fallback JWS+JCS; pin de commit                             |§11.5 |
|R-17|RFC 9162 é Experimental                              |Baixo  |—    |Constructs idênticos à 6962; enquadramento explícito        |§11.4 |
|R-18|SLSA muda de versão/tracks                           |Baixo  |Média|Pin SLSA v1.2; reavaliar em v1.3/v2.0                       |—     |

-----

## 22. Success Criteria

- 100% dos eventos críticos têm `event_id`, `trace_id`, `payload_hash` e `signature`.
- 100% das decisões Veritas têm `decision_commitment` recomputável *(condicionado à confirmação da fórmula — §8.2)*.
- 100% dos pacotes têm manifest assinado.
- 100% dos relatórios humanos derivam da AEIR (`report_derivation_valid`).
- 0 campos sensíveis fora das regras de disclosure.
- Auditor responde as perguntas de §11.10 usando pacote + verifier.
- Pacote inválido falha **deterministicamente** (mesma entrada → mesmo veredito + mesmos error codes).
- Test vectors cobrem casos positivos e negativos.
- Renderer **nunca** é fonte da verdade.
- Toda exceção é explicitamente reportada (nada silenciado).

-----

## 23. First Draft Deliverables

Entregues neste pacote (estrutura-alvo do repositório `foundlab-audit-author-tools`):

```text
/docs
  concept.md                 # este documento
  (architecture.md, verification-model.md, test-strategy.md,
   threat-model.md, privacy-model.md, references.md — derivar de §5,§10,§11,§16,§17 + references.md)
/schemas
  audit-evidence-record.schema.json
  decision-evidence-envelope.schema.json
  policy-snapshot.schema.json
  model-binding.schema.json
  control-mapping.schema.json
  audit-package-manifest.schema.json
  verification-result.schema.json
  redaction-policy.schema.json
  disclosure-profile.schema.json
  merkle-proof.schema.json
/test-vectors
  tv-001-valid-minimal.json ... tv-010-event-out-of-scope.json
/cli
  README.md
  command-spec.md            # contrato de verificação agnóstico + tabela de error taxonomy (§15)
/verifier
  package.json, tsconfig.json, src/, scripts/  (TypeScript / Node 22 — verifier executável + 10 test vectors)
/references.md               # links normativos verificados (raiz)
```

> **[DECISÃO]** Os documentos `architecture.md`, `verification-model.md`, etc., listados no prompt original como arquivos separados, são entregues nesta primeira rodada **embutidos** nas seções correspondentes deste `concept.md` (§5, §10, §11, §16, §17), com `references.md` como arquivo autônomo na raiz. Fragmentar agora geraria duplicação a manter. A fragmentação ocorre em DML-2, quando o conteúdo estabilizar.

-----

## Restrições honradas (checklist do prompt)

- [x] Começa como rascunho (`Draft / Experimental / Not Production`).
- [x] Contém testes (§11) e casos negativos (§11.9).
- [x] Não declara conformidade regulatória (§18, mapping parcial honesto).
- [x] Não é pitch.
- [x] Inclui riscos (§21) e links de referência (`references.md`).
- [x] Não confunde RFC 9920 com RFCXML (§2.1).
- [x] PDF/HTML/MD não são fonte da verdade (§4 decisão de ordem; §10 `report_derivation_valid`).
- [x] Renderer não altera/inventa evidência (§10).
- [x] IA generativa não é fonte canônica da evidência (a evidência vem dos sistemas; o EAC só compila/verifica).
