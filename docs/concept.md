# FoundLab Audit Author Tools — Evidence Artifact Compiler

**Status do documento:** `Draft / Experimental / Not Production`
**Draft Maturity Level:** DML-1 (Draft schema)
**Versão do documento:** 0.1.0-draft
**Data:** 2026-05-23
**Escopo:** Especificação inicial (rascunho técnico). Não é material comercial. Não declara conformidade regulatória.

---

## Convenções de marcação

Este documento separa explicitamente quatro categorias de afirmação. A marcação é obrigatória e aparece inline ao longo do texto:

- **[FATO-NORM]** — Fato normativo verificado contra fonte primária (RFC, spec oficial). Inclui URL.
- **[DESIGN]** — Design Assumption: hipótese de design da FoundLab, ainda não validada empiricamente.
- **[DEC-FL]** — Decisão arquitetural FoundLab: escolha deliberada, com alternativa registrada.
- **[RISCO]** — Risco aberto, rastreado no Risk Register (Seção 21).
- **[TODO]** — Pendência técnica explícita que precisa de resolução antes de avançar de DML.

As palavras-chave MUST, MUST NOT, SHOULD, MAY seguem o sentido de RFC 2119/8174 quando em maiúsculas, mas **este documento não é um RFC e não pleiteia status normativo IETF**.

---

## Abstract

Este documento especifica, em nível de rascunho, um sistema que transforma evidência técnica bruta — logs, traces, decisões, políticas e metadados de modelo dos sistemas Rex, Veritas, Guardian AI e Burn Engine — em pacotes auditáveis, verificáveis por máquina e renderizáveis para leitura humana.

A tese central é:

```text
FoundLab does not generate audit reports from logs.
FoundLab compiles cryptographically verifiable audit artifacts from deterministic execution evidence.
```

O sistema é inspirado no modelo de toolchain do IETF Author Tools (`source → validation → conversion → verification`), mas aplicado à transformação de evidência operacional em pacotes auditáveis. A fonte da verdade não é o relatório renderizado (PDF/HTML/Markdown); é uma representação intermediária canônica — **AEIR (Audit Evidence Intermediate Representation)** — validada por schema, selada por hash e assinatura ECDSA P-256, encadeada em uma Merkle tree construída conforme RFC 9162, e empacotada com um manifesto assinado. O dossiê humano é uma **view derivada e descartável**, sempre reproduzível a partir do pacote, nunca o contrário.

Este é um rascunho experimental. Contém testes obrigatórios, casos negativos, critérios de falha e riscos. Não trata a ideia como pronta.

---

## 1. Executive Summary

A operação de sistemas regulados produz um volume alto de evidência técnica que, na prática de auditoria tradicional, chega ao auditor de forma fragmentada, não reproduzível e dependente de narrativa. Logs isolados não respondem à pergunta "esta decisão automatizada foi tomada sob qual política, com qual modelo, e o input foi alterado?". Relatórios manuais respondem, mas são frágeis: não há garantia de que o texto do relatório corresponde à evidência subjacente.

O Evidence Artifact Compiler resolve isso invertendo a fonte da verdade. Em vez de tratar o relatório como o artefato primário, o sistema define uma representação canônica intermediária — AEIR — que é determinística, versionada, validável por schema e selada criptograficamente. Toda evidência relevante é normalizada para AEIR antes de qualquer renderização. O relatório humano passa a ser uma projeção do AEIR, e o sistema carrega a prova de que a projeção não alterou nem inventou conteúdo.

```text
FoundLab does not generate audit reports from logs.
FoundLab compiles cryptographically verifiable audit artifacts from deterministic execution evidence.
```

A inspiração estrutural vem do modelo operacional do IETF Author Tools: um autor fornece uma fonte técnica estruturada, a ferramenta valida o formato, converte para múltiplos outputs e permite checagem automática, resultando em algo legível por humanos e processável por máquinas. A FoundLab **não copia o processo IETF** e não tenta produzir um RFC. A analogia é o fluxo `source → validation → rendering → verification`, traduzido para `raw evidence → AEIR → seal → package → dossier`.

O sistema começa como rascunho (DML-1) e deve evoluir por ciclos de teste. O critério de maturidade é objetivo (Seção 13). Nenhum relatório humano deve existir sem evidência canônica correspondente, e nenhum pacote deve ser aceito sem passar pela verificação determinística descrita na Seção 10.

Este documento alinha-se à mecânica criptográfica já existente no REX Guard/Veritas — ECDSA P-256, Merkle chain, SealedRecibo, DecisionID recomputável, eventos reversíveis, policy/model hash, sealed rationale — e trata como greenfield apenas onde há gap explícito, marcado como **[TODO]** ou registrado em Open Questions (Seção 20).

---

## 2. Background and Inspiration

### 2.1 O que o IETF Author Tools faz

O IETF Author Tools é um conjunto de ferramentas web que recebe a fonte de um Internet-Draft (tipicamente em RFCXML, mas também Markdown ou texto), valida essa fonte, converte para os formatos de publicação (HTML, TXT, XML, PDF) e executa checagens automáticas de prontidão para submissão (por exemplo, `idnits`). Referência oficial: `https://authors.ietf.org/author-tools-web-service` e `https://authors.ietf.org/`.

### 2.2 Por que o modelo é útil como analogia

O modelo é útil porque separa três camadas que a auditoria tradicional costuma misturar: a **fonte** (estruturada, canônica), a **validação** (automática, determinística) e o **rendering** (múltiplos formatos derivados da mesma fonte). No IETF, ninguém edita o HTML publicado para "corrigir" um RFC; corrige-se a fonte XML e re-renderiza. Essa disciplina é exatamente o que falta na evidência de auditoria.

### 2.3 Por que a FoundLab não está criando um RFC

A FoundLab não pleiteia status IETF, não submete Internet-Drafts e não usa o processo editorial do RFC Editor. **[FATO-NORM]** O modelo editorial e institucional do RFC Editor é especificado na RFC 9920 ("RFC Editor Model (Version 3)", Editorial Stream, Informational, fevereiro de 2026; `https://datatracker.ietf.org/doc/rfc9920/`), que é um documento de governança organizacional (RSWG, RSAB, RPC, RSCE, IETF LLC) e **não define schema técnico, formato de dados ou estrutura de log**. Este documento não usa RFC 9920 como referência técnica, apenas a cita para deixar claro o que NÃO está sendo adotado.

**[FATO-NORM]** O vocabulário RFCXML / xml2rfc v3 — caso fosse relevante para nós, o que não é — é definido na RFC 7991 ("The 'xml2rfc' Version 3 Vocabulary", IAB Stream, Informational, dezembro de 2016; `https://www.rfc-editor.org/rfc/rfc7991`), atualmente superseded na prática pela documentação viva em `https://authors.ietf.org/rfcxml-vocabulary`. **[FATO-NORM]** A RFC 9720 ("RFC Formats and Versions", Editorial Stream, Informational, janeiro de 2025; `https://datatracker.ietf.org/doc/rfc9720/`) trata de formatos de publicação de RFCs e renomeia o termo "xml2rfc v3" para "RFCXML"; também não define schema de evidência. **A FoundLab não confunde RFC 9920 com RFCXML, e não usa nenhum dos dois como schema técnico.**

### 2.4 Onde a inspiração realmente está

A inspiração está no fluxo, não no formato:

```text
source → validation → rendering → verification
```

traduzido para evidência operacional:

```text
raw logs / traces / decisions / policies / model metadata
   → normalization
   → canonical evidence representation (AEIR)
   → validation
   → cryptographic sealing
   → machine-verifiable audit package
   → human-readable audit dossier (view derivada)
```

### 2.5 Comparação direta

| IETF Author Tools | FoundLab Audit Author Tools |
|---|---|
| Internet-Draft source | Raw technical evidence |
| RFCXML / Markdown / TXT | AEIR / JSON / NDJSON / CBOR |
| idnits / validation | auditnits / verifier |
| HTML / XML / PDF | Audit Dossier / Audit Package |
| Publication readiness | Audit verification readiness |

---

## 3. Problem Statement

O problema atual, na operação de sistemas regulados como o REX Guard:

- Logs são volumosos e pouco interpretáveis isoladamente.
- Auditores recebem evidência fragmentada, em formatos heterogêneos, sem prova de integridade.
- Decisões automatizadas nem sempre são reproduzíveis a partir da evidência arquivada.
- Políticas, modelos e decisões ficam desacoplados — não há binding criptográfico entre "qual política estava ativa" e "qual decisão foi tomada".
- Relatórios manuais criam risco operacional: o texto pode divergir da evidência sem que isso seja detectável.
- Auditoria tradicional depende excessivamente de confiança narrativa ("confie que o relatório reflete os logs").
- Ambientes regulados (financeiro brasileiro, BCB 538/2025, LGPD, PCI-DSS) precisam de evidência técnica, rastreável e verificável, não de afirmação.

Três invariantes-diagnóstico orientam o desenho:

- Evidência sem teste vira documentação decorativa.
- Evidência sem assinatura vira afirmação.
- Evidência sem canonicalização não é reproduzível.

---

## 4. Proposed Solution

A solução é um **compilador de evidência**: um pipeline determinístico que recebe evidência bruta e produz um pacote auditável verificável. Componentes obrigatórios:

- **Collectors** — coletam evidência bruta de cada sistema-fonte (Rex, Veritas, Guardian AI, Burn Engine) e das camadas de infraestrutura (Cloud Logging, OpenTelemetry, BigQuery, Pub/Sub, Cloud KMS). Não interpretam; apenas adquirem e preservam o raw.
- **Normalizers** — convertem cada formato bruto em um Canonical Evidence Record com campos previsíveis. A normalização é a única etapa que "lê" o formato nativo de cada sistema.
- **Canonical Evidence Records** — registros normalizados, mas ainda não selados.
- **AEIR Builder** — agrega Canonical Evidence Records na representação intermediária canônica (Seção 8), aplicando canonicalização JCS (RFC 8785) ao payload antes do hashing.
- **Schema Validators** — validam cada objeto AEIR contra JSON Schema 2020-12 (Seção 14).
- **Hash Validators** — recomputam `payload_hash` e verificam encadeamento (`previous_event_hash`).
- **Signature Validators** — verificam assinaturas ECDSA P-256 sobre o input correto (PAE quando em envelope DSSE).
- **Merkle Validators** — recomputam a Merkle root conforme construção RFC 9162-style e validam inclusion proofs.
- **Cryptographic Sealers** — selam o conjunto: computam root hash, assinam o manifesto, emitem o equivalente a um Signed Tree Head.
- **Renderers** — produzem views humanas (Markdown, HTML, PDF) **derivadas** do AEIR já selado. Nunca são fonte da verdade.
- **Verifiers** — recomputam tudo a partir do pacote e emitem um VerificationResult determinístico.
- **Control Mappers** — mapeiam evidência a controles regulatórios/internos, sem declarar conformidade.
- **Audit Package Generator** — monta o diretório do pacote (Seção 9).
- **Auditor CLI** — ferramenta que o auditor roda localmente (`foundlab-audit verify`).
- **Auditor Portal** — **[TODO]** interface web para auditores; fora do escopo do primeiro rascunho, registrado em roadmap (Phase 4+).

---

## 5. Architectural Model

### 5.1 Divergência deliberada do diagrama original — DECISÃO ARQUITETURAL

**[DEC-FL]** O diagrama de inspiração original colocava `rendering` **antes** do `machine-verifiable audit package`:

```text
... → cryptographic sealing → rendering → machine-verifiable audit package → ...   (ORIGINAL — REJEITADO)
```

Esta ordem foi **rejeitada** porque viola a tese central do sistema ("o renderer nunca é fonte da verdade"). Se a renderização ocorresse antes do empacotamento selado, o output renderizado (PDF/HTML) entraria na cadeia de confiança do pacote, tornando-se parte da evidência — exatamente o que o sistema se propõe a evitar.

A ordem adotada é:

```text
normalize → AEIR → validate → seal → package → render
```

**Invariante I-RENDER (MUST):** o renderer opera apenas sobre um pacote já selado. O dossiê humano é uma projeção derivada e descartável. A qualquer momento, descartar todos os dossiês e re-renderizá-los a partir do pacote MUST produzir conteúdo equivalente (módulo timestamps de renderização, que não fazem parte da evidência). A fonte da verdade é, sempre: **AEIR + manifest + hashes + assinaturas + Merkle proofs.**

### 5.2 Modelo em camadas

```text
[Rex]  [Veritas]  [Guardian AI]  [Burn Engine]
[Cloud Logging]  [OpenTelemetry]  [BigQuery]  [Pub/Sub]  [Cloud KMS]
        ↓
Evidence Collectors           ← adquirem raw, preservam fallback forense
        ↓
Event Normalizer              ← raw → Canonical Evidence Record
        ↓
AEIR Builder                  ← canonicaliza (JCS), computa payload_hash, encadeia
        ↓
Schema Validator              ← JSON Schema 2020-12; falha = AEIR_SCHEMA_INVALID
        ↓
Hash + Signature + Merkle Sealer   ← seal: root hash + manifest assinado + STH-equiv
        ↓
Audit Package Generator       ← monta /audit-package (fonte da verdade)
        ↓
Control Mapping Engine        ← mapeia evidência → controles (sem declarar conformidade)
        ↓
Renderer                      ← Markdown/HTML/PDF derivados; prova de derivação
        ↓
Verifier CLI / Auditor Portal ← recomputa tudo; VerificationResult determinístico
```

**Nota sobre o Control Mapping Engine:** ele consome o pacote já selado e produz `controls-mapping.json`, que é adicionado ao pacote e re-selado, ou mantido como artefato derivado assinado separadamente. **[TODO] confirm: control mapping entra no Merkle do pacote principal ou é um overlay assinado à parte?** Registrado em Open Questions (OQ-11).

---

## 6. Core Concepts

Cada definição é objetiva, operacional e testável.

- **Raw Evidence** — bytes originais coletados de um sistema-fonte, preservados sem interpretação. Invariante: imutável após coleta; referenciado por hash em `raw-evidence-index.json`. Teste: recomputar hash do raw bate com o índice. Erro: `RAW_EVIDENCE_UNRESOLVED`.
- **Canonical Evidence Record** — registro normalizado, campos previsíveis, ainda não selado. Invariante: todo campo obrigatório do schema presente. Teste positivo: schema valida. Teste negativo: campo ausente → `AEIR_REQUIRED_FIELD_MISSING`.
- **AEIR (Audit Evidence Intermediate Representation)** — a representação canônica intermediária; a fonte da verdade. Ver Seção 8.
- **Decision Evidence Envelope** — agrega uma decisão Veritas e seus bindings (input, policy, model, rationale) num objeto verificável com DecisionID recomputável. Ver Seção 14.
- **Policy Snapshot** — captura imutável do conteúdo de política ativo no momento da decisão, identificado por `policy_hash`. Invariante: `policy_hash` resolve para um snapshot arquivado. Erro: `POLICY_HASH_UNRESOLVED`.
- **Model Binding** — vínculo criptográfico entre uma decisão e o modelo usado (`model_hash`, `model_id`, versão). Erro: `MODEL_HASH_UNRESOLVED`.
- **Rationale Commitment** — commitment (hash) sobre o rationale da decisão, permitindo verificar que um rationale selado corresponde ao commitment sem necessariamente revelá-lo (sealed rationale). Ver Seção 17.
- **Merkle Audit Chain** — árvore de Merkle sobre os eventos AEIR, construída conforme RFC 9162-style (Seção 8.4). Permite inclusion proofs e consistency proofs.
- **Audit Package Manifest** — `manifest.json` assinado que enumera os artefatos do pacote, seus hashes e a Merkle root. Ver Seção 14.
- **Control Mapping** — associação entre evidência e um requisito de controle (interno ou regulatório). Invariante: todo controle mapeado tem evidência e teste. Erro: `CONTROL_WITHOUT_EVIDENCE`.
- **Verifier Profile** — conjunto de verificações que um perfil de auditor exige (mínimo, padrão, estrito). Define quais checagens são blocking.
- **Human-Readable Audit Dossier** — projeção humana (Markdown/HTML/PDF) derivada do pacote. Nunca fonte da verdade.
- **Machine-Verifiable Audit Package** — o diretório selado (Seção 9). A fonte da verdade.
- **Auditnits** — análogo ao `idnits` do IETF: checagens automáticas de prontidão do pacote para auditoria (campos obrigatórios, derivação consistente, ausência de PII fora de regra). Erro agregado por código.
- **Test Vector** — par (input, resultado esperado) usado para regressão determinística do verifier. Ver Seção 12.
- **Evidence Invariant** — propriedade que MUST valer para todo pacote válido (ex.: "todo evento crítico tem assinatura"). Cada invariante tem teste positivo e negativo.
- **Disclosure Profile** — define quais campos são revelados a qual audiência (selective disclosure). Ver Seção 14.
- **Redaction Policy** — regra determinística de redaction aplicada antes da renderização. Invariante: redaction é determinística e verificável. Erro: `REDACTION_POLICY_VIOLATED`.

---

## 7. System Responsibilities

Cada sistema-fonte produz evidências esperadas. **[DESIGN]** As listas abaixo são o contrato de evidência esperado; a aderência real de cada sistema deve ser verificada contra a implementação atual e o que faltar vira **[TODO]**/Open Question.

### 7.1 Rex

Evidências esperadas: execution event; route; tenant; actor; trace_id; span_id; latency; Cloud Run revision; region; policy invoked; decision requested; error/success status; request hash; response hash.

**[TODO] confirm: o REX Guard hoje emite `trace_id`/`span_id` no padrão OpenTelemetry (W3C Trace Context) em todos os gates?** Se não, normalização precisa derivar/sintetizar correlação — registrar em OQ.

### 7.2 Veritas

Evidências esperadas: DecisionID; input hash; policy hash; model hash; rationale hash; threshold; score; decision type; signature; Merkle position; reversal link; disclosure profile; verifier profile.

A fórmula de DecisionID é tratada como contrato com TODO na Seção 8.3 (alinhamento com a mecânica de produção).

### 7.3 Guardian AI

Evidências esperadas: model_id; model_hash; inference profile; drift status; feature commitments; confidence band; guardrail result; model version; evaluation metadata; model card reference.

### 7.4 Burn Engine

Evidências esperadas: ruleset_id; ruleset_hash; rule fired; rule skipped; exception; override; rollback; approval chain; signed rule execution log.

---

## 8. AEIR — Audit Evidence Intermediate Representation

### 8.1 Definição e propriedades

O AEIR é a representação canônica intermediária e a fonte da verdade. Propriedades (todas testáveis):

- **Fonte da verdade.** Relatórios são views derivadas. (Invariante I-RENDER, Seção 5.1.)
- **Determinístico.** Mesma entrada produz mesmo AEIR byte-a-byte após canonicalização. Teste: Seção 11.2.
- **Versionado.** Campo `schema_version` (ex.: `aeir.audit_evidence_record.v1`). Downgrade é detectado: `SCHEMA_DOWNGRADE_ATTEMPT`.
- **Validável por JSON Schema 2020-12.** Seção 14.
- **Suporta redaction** determinística (Seção 17).
- **Suporta selective disclosure** via Disclosure Profile.
- **Permite recomputação** de hashes e DecisionIDs.
- **Preserva lineage** entre raw evidence e audit dossier (`raw-evidence-index.json` + `report.derivation`).

### 8.2 Exemplo de Audit Evidence Record

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
  "subject": { "type": "opaque_ref", "hash": "sha256:..." },
  "jurisdiction": "BR",
  "payload_hash": "sha256:...",
  "previous_event_hash": "sha256:...",
  "signature": "base64url..."
}
```

### 8.3 DecisionID recompute — contrato alinhado a Veritas/REX Guard

**[DEC-FL]** A função de recomputação de DecisionID alinha-se à mecânica Veritas existente. Base inicial confirmada:

```text
DecisionID = ECDSA-P256-bound-hash(
    input_hash,
    policy_hash,
    model_hash,
    threshold,
    jurisdiction
)
```

**[TODO] confirm production formula.** A fórmula acima é a base mínima. A implementação de produção do Veritas pode incluir campos adicionais (ex.: `tenant`, `decision_type`, `ruleset_hash`, `occurred_at` truncado, nonce). O verifier (Seção 14, `src/decision-id.ts`) implementa esta base **como contrato com TODO explícito** e NÃO inventa campos para "parecer completo". Recomputação que diverge → `DECISION_ID_RECOMPUTE_FAILED`.

**[DESIGN]** Pré-canonicalização: todos os componentes do DecisionID são strings de hash já normalizadas, exceto `threshold` (número) e `jurisdiction` (string curta). A serialização para hashing usa JCS (RFC 8785) sobre um objeto `{input_hash, jurisdiction, model_hash, policy_hash, threshold}` com chaves ordenadas — ordenação garantida pela própria JCS. **[TODO] confirm: produção concatena campos com separador fixo OU canonicaliza objeto JSON?** Os dois caminhos são incompatíveis byte-a-byte; precisa bater com Veritas. (OQ-02.)

### 8.4 Merkle Audit Chain — construção RFC 9162-style

**[FATO-NORM]** A construção da Merkle Tree Hash (MTH) segue a RFC 9162 §2.1.1 ("Certificate Transparency Version 2.0", IETF Stream, **Experimental**, dezembro de 2021, obsoleta RFC 6962; `https://www.rfc-editor.org/rfc/rfc9162.html`):

```text
MTH({})            = HASH()                                   // hash de lista vazia
MTH({d[0]})        = HASH(0x00 || d[0])                       // leaf hash
MTH(D_n), n>1      = HASH(0x01 || MTH(D[0:k]) || MTH(D[k:n])) // internal node, k = maior potência de 2 < n
```

**[FATO-NORM]** A separação de domínio entre folha (prefixo `0x00`) e nó interno (prefixo `0x01`) é exigida pela própria RFC para resistência a segunda pré-imagem (texto verbatim da RFC 9162 §2.1.1: "this domain separation is required to give second preimage resistance").

**[FATO-NORM]** A RFC 9162 não fixa o algoritmo de hash; HASH é um parâmetro do log (§4.1) gerido por registro IANA (§10.2.1). **[DEC-FL]** A FoundLab fixa **SHA-256** como HASH inicial, citando §4.1/§10.2.1 como base de agilidade futura, e NÃO afirma que a RFC obriga SHA-256.

**[RISCO]** A RFC 9162 é **Experimental**, não Standards Track. A maioria do Web PKI ainda opera contra RFC 6962. Enquadramento auditor-defensável: "adotamos as construções de Merkle Tree Hash, inclusion proof (§2.1.3) e consistency proof (§2.1.4) da RFC 9162, que são a formalização canônica IETF da construção CT original (RFC 6962, 2013); as construções de Merkle são matematicamente idênticas entre 6962 e 9162." Registrado como R-09.

### 8.5 Sealing — assinatura e envelope

**[DEC-FL]** Perfil de assinatura inicial: **ECDSA P-256** (curva NIST P-256). **[DESIGN]** Pareado com FIPS 186-5 e determinismo de `k` via RFC 6979 onde a implementação permitir. **[TODO] confirm: REX Guard usa ECDSA determinístico (RFC 6979) ou aleatório?** (OQ-03.)

**[DEC-FL]** Envelope: **DSSE v1.0.0** quando aplicável (Signed Tree Head, manifest, attestations). **[FATO-NORM]** DSSE é uma **community specification** mantida pelo Secure Systems Lab (NYU) em `https://github.com/secure-systems-lab/dsse`, tag estável v1.0.0 — **não é um RFC IETF**. Estrutura do envelope:

```json
{
  "payload": "<base64(SERIALIZED_BODY)>",
  "payloadType": "application/vnd.foundlab.evidence-sth+json",
  "signatures": [{ "keyid": "<hint não-autenticado>", "sig": "<base64 sig sobre PAE>" }]
}
```

**[FATO-NORM]** A assinatura DSSE é computada sobre o Pre-Authentication Encoding (PAE), não sobre o payload base64 nem sobre o JSON do envelope (verbatim do `protocol.md` da spec):

```text
PAE(type, body) = "DSSEv1" SP LEN(type) SP type SP LEN(body) SP body
  SP       = ASCII space (0x20)
  "DSSEv1" = bytes ASCII [0x44,0x53,0x53,0x45,0x76,0x31]
  LEN(s)   = decimal ASCII do comprimento em bytes de s, sem zeros à esquerda
```

**[FATO-NORM]** Regra de verificação obrigatória da spec: a implementação MUST garantir que o mesmo SERIALIZED_BODY verificado é o mesmo entregue à camada de aplicação; MUST NOT re-parsear o envelope após a verificação para extrair o payload. (Falha aqui é vulnerabilidade conhecida.)

**[DEC-FL]** Onde houver JSON canonicalizado (DecisionID input, payload de evento antes do hash), usar **JCS — RFC 8785** ("JSON Canonicalization Scheme", Standards Track, junho de 2020; `https://www.rfc-editor.org/rfc/rfc8785`). Nota de coerência: DSSE deliberadamente **proíbe** canonicalização do que ele assina (assina raw bytes). Isso não é contradição: usamos JCS para produzir os `*_hash` determinísticos *dentro* do payload; o DSSE assina os bytes já-serializados desse payload. A canonicalização acontece antes e fora do PAE.

---

## 9. Audit Package Structure

```text
/audit-package
  manifest.json              ← enumera artefatos, hashes e Merkle root; assinado (DSSE)
  evidence.ndjson            ← AEIR records, um por linha (streaming-friendly)
  evidence.cbor              ← mesma evidência, serialização binária compacta (RFC 8949)
  report.md                  ← dossiê humano (DERIVADO; não fonte da verdade)
  report.html                ← idem
  report.pdf                 ← idem
  controls-mapping.json      ← evidência → controles (sem declarar conformidade)
  decision-samples/          ← Decision Evidence Envelopes selecionados
  merkle-proofs/             ← inclusion/consistency proofs por evento amostrado
  signatures/                ← envelopes DSSE das assinaturas (STH, manifest)
  schemas/                   ← cópia dos JSON Schemas usados (pin de versão)
  test-vectors/              ← vetores aplicáveis a este pacote
  verification-result.json   ← saída do verifier (pode ser regenerada)
  raw-evidence-index.json    ← hashes do raw evidence (fallback forense)
  provenance.json            ← in-toto/SLSA provenance do build do pacote
  README.md                  ← como verificar este pacote
```

Papel de cada arquivo:

- **manifest.json** — o âncora. Lista cada arquivo com seu hash e declara a Merkle root. É o que se assina. Verificação começa aqui.
- **evidence.ndjson / evidence.cbor** — a evidência AEIR. NDJSON para leitura streaming; CBOR (**[FATO-NORM]** RFC 8949) para compacidade. Ambos MUST produzir os mesmos `payload_hash`.
- **report.\*** — views derivadas. O verifier checa a *claim* de derivação (Seção 10), não o conteúdo visual.
- **controls-mapping.json** — mapeia evidência a controles; cada entrada referencia `event_id`/`decision_id` e o teste associado.
- **merkle-proofs/** — provas de inclusão recomputáveis contra a root do manifest.
- **signatures/** — envelopes DSSE; `keyid` é hint não-autenticado, a chave real vem do trust store do verifier.
- **provenance.json** — **[DEC-FL]** provenance no formato in-toto attestation, `predicateType: https://slsa.dev/provenance/v1`, em envelope DSSE. Objetivo de design: **SLSA Build L3** (Seção 18.4).
- **raw-evidence-index.json** — preserva o vínculo com o raw original para perícia; não contém o raw, só hashes e ponteiros.

---

## 10. Verification Model

O auditor executa:

```bash
foundlab-audit verify ./audit-package
```

Saída esperada (pass):

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

Cada verificação:

- **root_hash_verified** — recomputa a Merkle root a partir de `evidence.ndjson` e compara com `manifest.json`. Falha → `MERKLE_ROOT_MISMATCH`.
- **signatures_verified** — verifica cada envelope DSSE: reconstrói o PAE, verifica ECDSA P-256 contra a chave do trust store. Falha → `SIGNATURE_INVALID` ou `SIGNATURE_KEY_REVOKED`.
- **schema_valid** — valida cada record AEIR contra JSON Schema 2020-12. Falha → `AEIR_SCHEMA_INVALID` / `AEIR_REQUIRED_FIELD_MISSING`.
- **decision_ids_recomputed** — recomputa DecisionID (contrato Seção 8.3). Falha → `DECISION_ID_RECOMPUTE_FAILED`.
- **merkle_chain_valid** — valida cada inclusion proof em `merkle-proofs/` contra a root. Falha → `MERKLE_PROOF_INVALID`.
- **policy_hashes_resolved** — cada `policy_hash` referenciado resolve a um Policy Snapshot. Falha → `POLICY_HASH_UNRESOLVED`.
- **model_hashes_resolved** — idem para `model_hash`. Falha → `MODEL_HASH_UNRESOLVED`.
- **redaction_policy_valid** — confirma que a redaction aplicada é determinística e não vazou campo proibido. Falha → `REDACTION_POLICY_VIOLATED`.
- **report_derivation_valid** — verifica a **claim** de que os relatórios derivam do AEIR: recomputa o hash do AEIR de entrada declarado em `report.derivation` e compara. **[DESIGN]** No primeiro rascunho, isto valida a *afirmação* de derivação (o renderer registra qual AEIR-hash usou); não re-renderiza nem faz diff visual. Falha → `REPORT_DERIVATION_FAILED`. Ver Open Question OQ-12.

Saída esperada (fail):

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

**Invariante I-FAIL (MUST):** pacote inválido falha deterministicamente. Mesma entrada inválida → mesmo conjunto de exceptions, mesma ordem. Toda exceção é explicitamente reportada; o verifier nunca "passa por cima" silenciosamente. Alinha-se ao posture fail-closed do REX Guard.

---

## 11. Mandatory Test Strategy

Esta seção é obrigatória e não é resumida. Cada subseção define testes positivos e negativos.

### 11.1 Schema Tests
Campos obrigatórios presentes; tipos corretos; timestamps em RFC 3339/ISO 8601 UTC; hashes no formato `sha256:<hex>`; enums dentro do conjunto; `schema_version` presente e reconhecido; compatibilidade entre versões (v1 não aceita downgrade para v0). Negativo: campo ausente, tipo errado, enum inválido, versão desconhecida.

### 11.2 Hash Determinism Tests
Mesma entrada gera mesmo hash; mudança mínima (1 byte) altera hash; canonicalização JSON via JCS estável; ordenação de chaves irrelevante ao resultado (JCS ordena); timestamp normalizado; encoding estável (UTF-8). Negativo: dois objetos semanticamente iguais mas com ordem de chave diferente DEVEM produzir o mesmo hash após JCS; se produzirem hashes diferentes, a canonicalização está quebrada.

### 11.3 DecisionID Recompute Tests
Recomputação bate com o DecisionID arquivado; alteração de `input_hash`, `policy_hash`, `model_hash`, `threshold` ou `jurisdiction` altera o DecisionID. Negativo: DecisionID arquivado que não recomputa → `DECISION_ID_RECOMPUTE_FAILED`. **[TODO]**: enquanto a fórmula de produção não for confirmada (OQ-02), estes testes rodam contra o contrato-base e são marcados `pending-production-formula`.

### 11.4 Merkle Chain Tests
Inclusão de evento; ordem dos eventos preservada; prova de inclusão válida; evento removido detectado; evento alterado detectado; cadeia quebrada detectada; root divergente detectada. Negativo: proof que não reconstrói a root → `MERKLE_PROOF_INVALID`.

### 11.5 Signature Tests
Assinatura válida passa; assinatura inválida falha; chave revogada falha (`SIGNATURE_KEY_REVOKED`); key rotation respeitada (chave válida na época); assinatura sobre payload errado falha; alteração após assinatura falha. Negativo crítico: PAE reconstruído incorretamente NÃO deve passar — testa a regra "não re-parsear envelope após verificação".

### 11.6 Renderer Tests
Markdown/HTML renderizam a partir do AEIR; PDF deriva do AEIR; relatório não contém campos sensíveis indevidos; redactions aparecem; links internos funcionam; tabelas de controle batem com a evidência. Negativo: relatório que afirma derivar de um AEIR-hash que não bate → `REPORT_DERIVATION_FAILED`.

### 11.7 Control Mapping Tests
Cada controle tem evidência; evidência inexistente falha (`CONTROL_WITHOUT_EVIDENCE`); controle sem teste falha; controle com exceção aparece em seção própria; múltiplos frameworks podem mapear a mesma evidência. Negativo: controle declarado sem `event_id`/`decision_id` resolvível.

### 11.8 Privacy and Redaction Tests
PII não aparece em relatório público; hash de subject estável; payload sensível permanece selado; selective disclosure revela apenas o permitido; rationale selado verificável sem revelar conteúdo (commitment bate). Negativo: campo sob redaction que vaza em qualquer view → `REDACTION_POLICY_VIOLATED`.

### 11.9 Negative Tests
Evento sem assinatura; `policy_hash` ausente; `decision_id` inconsistente; timestamp fora do período de auditoria (`EVENT_OUT_OF_SCOPE`); evento duplicado (`DUPLICATE_EVENT`); evento órfão sem `previous_event_hash` resolvível (`ORPHAN_EVENT`); sistema desconhecido (`UNKNOWN_SYSTEM`); `schema_version` incompatível (`SCHEMA_DOWNGRADE_ATTEMPT`).

### 11.10 Auditor Acceptance Tests

Para cada pergunta, o campo/arquivo/teste que a responde:

| Pergunta do auditor | Onde se responde | Verificação |
|---|---|---|
| Qual decisão foi tomada? | `decision_type`, Decision Evidence Envelope | schema + decision_id recompute |
| Qual política estava ativa? | `policy_hash` → Policy Snapshot | policy_hashes_resolved |
| Qual modelo foi usado? | `model_hash`/`model_id` → Model Binding | model_hashes_resolved |
| O input foi alterado? | `input_hash` no DecisionID | decision_id recompute |
| Houve override? | OverrideEvent (Burn Engine) | schema + signature |
| Houve reversão? | ReversalEvent + `reversal link` | merkle_chain_valid + signature |
| Qual jurisdição se aplica? | `jurisdiction` | schema |
| A cadeia de evidência está íntegra? | Merkle root + proofs | root_hash_verified + merkle_chain_valid |
| O relatório deriva da evidência canônica? | `report.derivation` (AEIR-hash) | report_derivation_valid |

---

## 12. Test Vectors

Mínimo de 10 vetores. Formato:

```json
{ "test_vector_id": "tv_001", "description": "Minimal valid audit package.", "input": {}, "expected_result": "pass", "expected_error_code": null }
```

Obrigatórios (materializados em `/test-vectors/`):

1. `tv-001` — pacote válido mínimo → pass
2. `tv-002` — evento com hash inválido → fail / `HASH_MISMATCH`
3. `tv-003` — DecisionID inconsistente → fail / `DECISION_ID_RECOMPUTE_FAILED`
4. `tv-004` — cadeia Merkle quebrada → fail / `MERKLE_ROOT_MISMATCH`
5. `tv-005` — redaction correta → pass
6. `tv-006` — assinatura inválida → fail / `SIGNATURE_INVALID`
7. `tv-007` — PolicySnapshot ausente → fail / `POLICY_HASH_UNRESOLVED`
8. `tv-008` — ReversalEvent válido → pass
9. `tv-009` — OverrideEvent válido → pass
10. `tv-010` — evento fora do período de auditoria → fail / `EVENT_OUT_OF_SCOPE`

---

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

**Estado atual: DML-1**, transicionando para DML-2/DML-3 com a entrega deste pacote (schemas + test vectors + verifier minimalista já presentes).

Critérios objetivos para avançar:

- **→ DML-2:** os 10 test vectors definidos, com input e expected_result completos e o verifier executando contra todos.
- **→ DML-3:** verifier local valida schema, hashes, Merkle root, manifest e a claim de derivação; roda em todos os test vectors com resultado determinístico.
- **→ DML-4:** simulação de auditoria interna sobre Rex e Veritas com pacote real; auditor interno responde às 9 perguntas da Seção 11.10.
- **→ DML-5:** piloto com auditor/parceiro externo; feedback de control mapping coletado.
- **→ DML-6:** integração CI/CD, Cloud Logging/BigQuery/OTel/KMS, assinatura automatizada, geração periódica, provenance SLSA Build L3.

---

## 14. Output Contracts

Cada contrato: descrição; campos obrigatórios; campos opcionais; invariantes; exemplo JSON; erros possíveis; testes associados. Os JSON Schemas correspondentes estão em `/schemas/`.

### 14.1 AuditEvidenceRecord (`audit-evidence-record.schema.json`)
- **Obrigatórios:** `schema_version`, `event_id`, `event_type`, `system`, `occurred_at`, `payload_hash`.
- **Opcionais:** `trace_id`, `span_id`, `actor`, `subject`, `jurisdiction`, `previous_event_hash`, `signature`.
- **Invariantes:** `payload_hash` recomputável; `previous_event_hash` (se presente) resolve a um evento anterior; `system` ∈ {rex, veritas, guardian_ai, burn_engine}.
- **Erros:** `AEIR_SCHEMA_INVALID`, `AEIR_REQUIRED_FIELD_MISSING`, `HASH_MISMATCH`, `UNKNOWN_SYSTEM`, `ORPHAN_EVENT`.
- **Testes:** 11.1, 11.2, 11.9.

### 14.2 DecisionEvidenceEnvelope (`decision-evidence-envelope.schema.json`)
- **Obrigatórios:** `decision_id`, `input_hash`, `policy_hash`, `model_hash`, `threshold`, `jurisdiction`, `decision_type`, `signature`.
- **Opcionais:** `score`, `rationale_hash`, `merkle_position`, `reversal_link`, `disclosure_profile`, `verifier_profile`.
- **Invariantes:** `decision_id` recomputável a partir do contrato 8.3; `signature` válida sobre o envelope canonicalizado.
- **Erros:** `DECISION_ID_RECOMPUTE_FAILED`, `SIGNATURE_INVALID`, `POLICY_HASH_UNRESOLVED`, `MODEL_HASH_UNRESOLVED`.
- **Testes:** 11.3, 11.5.

### 14.3 PolicySnapshot (`policy-snapshot.schema.json`)
- **Obrigatórios:** `policy_hash`, `policy_id`, `captured_at`, `content_ref`.
- **Invariantes:** `policy_hash` = hash do conteúdo apontado por `content_ref`.
- **Erros:** `POLICY_HASH_UNRESOLVED`.
- **Testes:** 11.7, 11.9.

### 14.4 ModelBinding (`model-binding.schema.json`)
- **Obrigatórios:** `model_hash`, `model_id`, `model_version`.
- **Opcionais:** `inference_profile`, `drift_status`, `confidence_band`, `model_card_ref`.
- **Erros:** `MODEL_HASH_UNRESOLVED`.

### 14.5 ControlMapping (`control-mapping.schema.json`)
- **Obrigatórios:** `control_id`, `framework`, `evidence_refs[]`, `test_ref`.
- **Invariantes:** cada `evidence_ref` resolve; `test_ref` existe.
- **Erros:** `CONTROL_WITHOUT_EVIDENCE`.
- **Testes:** 11.7.

### 14.6 AuditPackageManifest (`audit-package-manifest.schema.json`)
- **Obrigatórios:** `manifest_version`, `package_id`, `created_at`, `merkle_root`, `hash_algorithm`, `artifacts[]` (cada um com `path` e `hash`), `signature`.
- **Invariantes:** todo artefato listado existe e bate o hash; `merkle_root` recomputável; `signature` válida.
- **Erros:** `MERKLE_ROOT_MISMATCH`, `HASH_MISMATCH`, `SIGNATURE_INVALID`.
- **Testes:** 11.4, 11.5.

### 14.7 VerificationResult (`verification-result.schema.json`)
- **Obrigatórios:** `status` (pass|fail), as flags booleanas da Seção 10, `exceptions[]`.
- **Invariantes:** `status=pass` ⟺ `exceptions` sem item `blocking`.
- **Testes:** todos.

### 14.8 RedactionPolicy (`redaction-policy.schema.json`)
- **Obrigatórios:** `policy_id`, `rules[]` (cada regra: `field_path`, `action` ∈ {hash, drop, mask}).
- **Invariantes:** determinística; aplicação dupla = idempotente.
- **Erros:** `REDACTION_POLICY_VIOLATED`.
- **Testes:** 11.8.

### 14.9 DisclosureProfile (`disclosure-profile.schema.json`)
- **Obrigatórios:** `profile_id`, `audience`, `disclosed_fields[]`.
- **Invariantes:** campo não listado não aparece em view daquela audiência.
- **Testes:** 11.8.

### 14.10 MerkleProof (`merkle-proof.schema.json`)
- **Obrigatórios:** `leaf_index`, `tree_size`, `leaf_hash`, `audit_path[]`, `root_hash`.
- **Invariantes:** reconstrução de `root_hash` a partir de `leaf_hash` + `audit_path` bate com o manifest. Construção RFC 9162-style (0x00/0x01 prefix).
- **Erros:** `MERKLE_PROOF_INVALID`, `MERKLE_ROOT_MISMATCH`.
- **Testes:** 11.4.

---

## 15. Error Codes

Taxonomia. Para cada código: causa provável; severidade; ação corretiva; se bloqueia o pacote; teste associado.

| Código | Causa provável | Severidade | Bloqueia? | Teste |
|---|---|---|---|---|
| `AEIR_SCHEMA_INVALID` | Record viola JSON Schema | blocking | sim | 11.1 |
| `AEIR_REQUIRED_FIELD_MISSING` | Campo obrigatório ausente | blocking | sim | 11.1 |
| `HASH_MISMATCH` | `payload_hash` não recomputa | blocking | sim | 11.2 |
| `SIGNATURE_INVALID` | Assinatura não verifica | blocking | sim | 11.5 |
| `SIGNATURE_KEY_REVOKED` | Chave revogada na época | blocking | sim | 11.5 |
| `MERKLE_ROOT_MISMATCH` | Root recomputada diverge | blocking | sim | 11.4 |
| `MERKLE_PROOF_INVALID` | Inclusion proof não reconstrói root | blocking | sim | 11.4 |
| `DECISION_ID_RECOMPUTE_FAILED` | DecisionID não recomputa | blocking | sim | 11.3 |
| `POLICY_HASH_UNRESOLVED` | `policy_hash` sem snapshot | blocking | sim | 11.7 |
| `MODEL_HASH_UNRESOLVED` | `model_hash` sem binding | blocking | sim | 11.7 |
| `CONTROL_WITHOUT_EVIDENCE` | Controle mapeado sem evidência | blocking | sim | 11.7 |
| `REDACTION_POLICY_VIOLATED` | Campo proibido vazou | blocking | sim | 11.8 |
| `UNKNOWN_SYSTEM` | `system` fora do conjunto | warning | configurável | 11.9 |
| `EVENT_OUT_OF_SCOPE` | Timestamp fora do período | warning | configurável | 11.9 |
| `DUPLICATE_EVENT` | `event_id` repetido | blocking | sim | 11.9 |
| `ORPHAN_EVENT` | `previous_event_hash` não resolve | blocking | sim | 11.9 |
| `REPORT_DERIVATION_FAILED` | Relatório não deriva do AEIR | blocking | sim | 11.6 |
| `SCHEMA_DOWNGRADE_ATTEMPT` | `schema_version` regrediu | blocking | sim | 11.9 |
| `RAW_EVIDENCE_UNRESOLVED` | Raw index não resolve | warning | configurável | 11.1 |

---

## 16. Security Considerations

Para cada risco: mitigação e teste.

- **Adulteração de logs** → Merkle chain + assinatura por evento; teste 11.4/11.5.
- **Replay de eventos** → `event_id` único + `DUPLICATE_EVENT`; teste 11.9.
- **Manipulação de timestamp** → timestamp dentro do payload assinado; `EVENT_OUT_OF_SCOPE`; teste 11.9. **[TODO] confirm:** timestamp confiável vem de TrueTime (Spanner) ou TSA (RFC 3161)? (OQ-04.)
- **Vazamento de dados sensíveis** → redaction determinística + selective disclosure; teste 11.8.
- **Assinatura com chave comprometida** → trust store com revogação + key rotation por época; `SIGNATURE_KEY_REVOKED`; teste 11.5.
- **Geração de relatório falso** → `report_derivation_valid`; teste 11.6.
- **Inconsistência entre relatório e evidência** → derivation claim verificável; teste 11.6.
- **Ataque por downgrade de schema** → `SCHEMA_DOWNGRADE_ATTEMPT`; teste 11.9.
- **Colisão ou uso incorreto de hash** → SHA-256 + domain separation Merkle (0x00/0x01) por RFC 9162; teste 11.4.
- **Comprometimento do pipeline de build** → provenance SLSA Build L3 (Seção 18.4); **[RISCO]** R-04.
- **Dependência excessiva do cloud provider** → raw evidence preservada, formatos abertos (NDJSON/CBOR/JSON), verifier roda offline; **[RISCO]** R-05.
- **Exfiltração via relatório renderizado** → renderer só lê AEIR pós-redaction; teste 11.8.

**[FATO-NORM]** A escolha do PAE (DSSE) sobre JWS é deliberada: o PAE vincula um `payloadType` explícito ao input assinado, prevenindo reinterpretação cross-application dos mesmos bytes de payload (type confusion). Fonte: `https://github.com/secure-systems-lab/dsse` (`background.md`, `protocol.md`, tag v1.0.0).

---

## 17. Privacy Considerations

- **Minimização de dados** — só o necessário entra no AEIR; o resto fica no raw selado e referenciado por hash.
- **Pseudonimização** — `subject` como `opaque_ref` + hash, nunca identificador direto.
- **Hashing de subject** — estável e salgado por época; teste 11.8.
- **Selective disclosure** — Disclosure Profile por audiência.
- **Sealed rationale** — Rationale Commitment permite provar correspondência sem revelar o rationale.
- **Segregação por jurisdição** — campo `jurisdiction`; **[TODO] confirm** política de residência de dados BR. (OQ-05.)
- **Política de retenção** — **[RISCO]** tensão entre retenção bancária (BCB) e direito ao apagamento (LGPD) — o "retention paradox". Mitigação de design: crypto-shredding (apagar a chave torna o payload selado irrecuperável, preservando o hash na cadeia). **[TODO] confirm** alinhamento com a mecânica de shred_key do REX Guard. (OQ-06.)
- **Redaction determinística** — Seção 14.8.
- **Logs com dados pessoais** — nunca em report público; teste 11.8.
- **Risco de reidentificação** — **[RISCO]** R-03; hash de subject pode ser alvo de ataque de dicionário se o espaço de subjects for pequeno; mitigação: salt por época + opaque_ref.
- **Separação entre raw evidence e audit dossier** — raw nunca entra no dossiê; só hashes.

---

## 18. Compliance and Audit Considerations

Sem prometer conformidade automática.

```text
The system provides verifiable evidence.
It does not replace legal, regulatory, or audit judgment.
```

### 18.1 Diferenciação de camadas
- **Evidência técnica** — o que o sistema produz e verifica.
- **Conclusão de auditoria** — julgamento do auditor humano sobre a evidência.
- **Controle interno** — mecanismo organizacional; o sistema mapeia, não implementa.
- **Requisito regulatório** — externo; o sistema referencia, não declara cumprido.
- **Prova criptográfica** — o que o verifier estabelece (integridade, autenticidade, derivação).
- **Julgamento humano do auditor** — insubstituível; explicitamente fora do escopo.

### 18.2 O que o sistema NÃO faz
Não declara conformidade regulatória; não promete aceitação por regulador; não emite conclusão jurídica; não substitui o auditor.

### 18.3 Anti-overclaim
Toda afirmação de controle no `controls-mapping.json` referencia evidência verificável (`event_id`/`decision_id` + teste). Sem evidência resolvível, o mapeamento falha (`CONTROL_WITHOUT_EVIDENCE`). Não há "conformidade por asserção".

### 18.4 SLSA — provenance do próprio compilador
**[FATO-NORM]** SLSA v1.2 (Approved Specification, 24 de novembro de 2025; `https://slsa.dev/blog/2025/11/announce-slsa-v1.2`) define o Build Track com níveis nomeados **Build L0 / L1 / L2 / L3** (`https://slsa.dev/spec/v1.2/build-track-basics`). **[DEC-FL]** O objetivo de design para o pipeline que gera os pacotes é **Build L3** (plataforma de build endurecida, isolamento entre execuções, chaves de assinatura de provenance inacessíveis a passos definidos pelo usuário). **[FATO-NORM]** Não existe "SLSA Level 4" no Build Track v1.x — foi deferido; o documento não o reivindica. **[FATO-NORM]** Provenance é uma attestation que descreve como os outputs foram produzidos (`https://slsa.dev/spec/v1.2/terminology`), emitida como in-toto attestation `predicateType: https://slsa.dev/provenance/v1` em envelope DSSE.

---

## 19. Implementation Roadmap

- **Phase 0 — Concept Draft:** escrever documentação; definir AEIR; listar evidências existentes; mapear gaps. *(Concluída com este documento.)*
- **Phase 1 — Schema and Test Vectors:** criar schemas; exemplos válidos/inválidos; test vectors; error codes. *(Entregue neste pacote — `/schemas`, `/test-vectors`.)*
- **Phase 2 — Local CLI Prototype:** validar pacote local; recomputar hashes; validar assinaturas; gerar relatório Markdown. *(Esqueleto entregue — `/cli`, `/src`.)*
- **Phase 3 — Internal Audit Simulation:** simular auditoria de Rex e Veritas; gerar primeiro audit package real; testar perguntas de auditor.
- **Phase 4 — External Pilot:** entregar pacote a auditor/parceiro; coletar feedback; ajustar control mappings.
- **Phase 5 — Production Profile:** integrar CI/CD; Cloud Logging, BigQuery, OpenTelemetry, KMS; assinar pacotes; automatizar geração periódica; provenance SLSA Build L3.

---

## 20. Open Questions

- **OQ-01** — Canonicalização: JSON, NDJSON, CBOR ou todos como saída? (Decisão atual: NDJSON + CBOR para evidência, JSON para manifest; confirmar custo/benefício do CBOR no primeiro piloto.)
- **OQ-02** — DecisionID: produção concatena campos com separador fixo OU canonicaliza objeto JSON (JCS)? Os caminhos são incompatíveis byte-a-byte. **Bloqueia** testes 11.3 saírem de `pending`.
- **OQ-03** — ECDSA: determinístico (RFC 6979) ou aleatório no REX Guard atual?
- **OQ-04** — Timestamp confiável: TrueTime (Spanner) ou TSA (RFC 3161)? Afeta defesa contra manipulação de timestamp.
- **OQ-05** — Residência de dados por jurisdição (BR): como o pacote segrega evidência multi-jurisdição?
- **OQ-06** — Retention paradox: crypto-shredding alinhado ao `shred_key` do REX Guard? Apagar chave vs. preservar hash na cadeia.
- **OQ-07** — Envelope: DSSE para tudo, ou JWS (RFC 7515) como fallback IETF onde o auditor exigir âncora de standards-track?
- **OQ-08** — Granularidade da Merkle tree: uma árvore por pacote, por período, ou contínua com consistency proofs entre pacotes?
- **OQ-09** — Como preservar raw evidence: dentro do pacote (custo) ou referenciado externamente com hash (dependência de disponibilidade)?
- **OQ-10** — Quanto revelar no rationale por padrão? Sealed por default, disclosure por exceção?
- **OQ-11** — Control mapping entra no Merkle do pacote principal ou é overlay assinado à parte?
- **OQ-12** — Como provar que o renderer não alterou conteúdo *além* da claim de derivação? (Re-render determinístico + diff canônico do AEIR projetado?)
- **OQ-13** — Eventos retroativos e correções de evidência: como representar sem alterar logs (append-only + correction event)?
- **OQ-14** — Logs parcialmente indisponíveis: pacote degrada para "parcial" com exceção explícita, ou falha?
- **OQ-15** — Versionamento de schemas: política de compatibilidade e deprecação.
- **OQ-16** — Perfil mínimo do verifier para auditor externo (quais checagens são obrigatórias no perfil "mínimo").

---

## 21. Risks and Mitigations (Risk Register)

| ID | Risco | Impacto | Probabilidade | Mitigação | Teste |
|---|---|---|---|---|---|
| R-01 | Complexidade excessiva afasta adoção | Alto | Média | Perfil mínimo de verifier; CLI simples; command-spec agnóstico | 11.10 |
| R-02 | Auditor não aceita o formato | Alto | Média | Piloto externo cedo (Phase 4); âncoras em RFCs reconhecidas | 11.10 |
| R-03 | Vazamento/reidentificação de dados | Crítico | Baixa | Redaction determinística; opaque_ref; salt por época | 11.8 |
| R-04 | Comprometimento do pipeline de build | Crítico | Baixa | SLSA Build L3; provenance assinada | — (provenance) |
| R-05 | Dependência de fornecedor cloud | Médio | Média | Formatos abertos; verifier offline; raw preservado | 11.1 |
| R-06 | Falso senso de conformidade | Alto | Média | Anti-overclaim (18.3); "evidence ≠ compliance" explícito | 11.7 |
| R-07 | Inconsistência entre sistemas-fonte | Médio | Alta | Normalização única; `UNKNOWN_SYSTEM`; contrato por sistema (Seção 7) | 11.9 |
| R-08 | Falta de test vectors | Médio | Baixa | 10 vetores obrigatórios entregues (Seção 12) | 12 |
| R-09 | RFC 9162 é Experimental | Médio | Certa | Enquadramento "construções idênticas a 6962"; caveat explícito | 11.4 |
| R-10 | Renderer tratado como fonte da verdade | Crítico | Média | Invariante I-RENDER; ordem seal→package→render | 11.6 |
| R-11 | Schema imaturo | Médio | Alta | DML explícito; versionamento; OQ-15 | 11.1 |
| R-12 | Logs incompletos | Médio | Alta | Degradação "parcial" com exceção (OQ-14); `RAW_EVIDENCE_UNRESOLVED` | 11.1 |
| R-13 | Canonicalização instável | Alto | Baixa | JCS (RFC 8785); teste de ordem-de-chave | 11.2 |
| R-14 | Falha na rotação de chaves | Alto | Baixa | Chave por época; `SIGNATURE_KEY_REVOKED` | 11.5 |
| R-15 | Raw evidence indisponível | Médio | Média | Index com hash; fallback forense; OQ-09 | 11.1 |
| R-16 | Relatório humano divergente do AEIR | Crítico | Média | `report_derivation_valid`; I-RENDER | 11.6 |
| R-17 | DSSE não é IETF standard | Baixo | Certa | Caveat "community spec"; JWS como fallback (OQ-07) | 11.5 |
| R-18 | Fórmula DecisionID não confirmada | Alto | Certa | Contrato com TODO; testes `pending`; OQ-02 | 11.3 |

---

## 22. Success Criteria

- 100% dos eventos críticos possuem `event_id`, `trace_id`, `payload_hash` e assinatura.
- 100% das decisões Veritas possuem DecisionID recomputável (após resolução de OQ-02).
- 100% dos pacotes possuem manifest assinado.
- 100% dos relatórios humanos são derivados do AEIR (claim verificável).
- 0 campos sensíveis aparecem fora das regras de disclosure.
- Auditor consegue responder as 9 perguntas básicas (Seção 11.10) usando pacote + verifier.
- Pacote inválido falha deterministicamente (I-FAIL).
- Test vectors cobrem casos positivos e negativos.
- Renderer nunca é fonte da verdade (I-RENDER).
- Toda exceção é explicitamente reportada.

---

## 23. First Draft Deliverables

Estrutura inicial entregue neste pacote:

```text
/docs
  concept.md              ← este documento
  (architecture.md, verification-model.md, test-strategy.md,
   threat-model.md, privacy-model.md, references.md — derivados deste,
   marcados como [TODO] split na Phase 1+)
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
  command-spec.md           ← agnóstico, para reimplementação por auditor externo
/src
  (verifier TypeScript / Node 22 — esqueleto executável)
/references
  references.md             ← todas as âncoras normativas verificadas, com URLs
```

---

## Apêndice A — Referências normativas verificadas

Todas verificadas contra fonte primária em 2026-05-23. Categorias: **[FATO-NORM]** confirmado; status indicado quando relevante.

- **RFC 8785** — JSON Canonicalization Scheme (JCS). Standards Track, jun/2020. `https://www.rfc-editor.org/rfc/rfc8785`
- **RFC 9162** — Certificate Transparency Version 2.0. **Experimental**, dez/2021, obsoleta RFC 6962. `https://www.rfc-editor.org/rfc/rfc9162.html`
- **RFC 8949** — Concise Binary Object Representation (CBOR). `https://www.rfc-editor.org/rfc/rfc8949.html`
- **RFC 7515** — JSON Web Signature (JWS) — referência de fallback. `https://www.rfc-editor.org/rfc/rfc7515.html`
- **RFC 7991** — The "xml2rfc" Version 3 Vocabulary (RFCXML). IAB, dez/2016. `https://www.rfc-editor.org/rfc/rfc7991` (superseded na prática por `https://authors.ietf.org/rfcxml-vocabulary`)
- **RFC 9720** — RFC Formats and Versions. Editorial, jan/2025. Renomeia "xml2rfc v3" → "RFCXML". `https://datatracker.ietf.org/doc/rfc9720/`
- **RFC 9920** — RFC Editor Model (Version 3). Editorial, fev/2026. Modelo institucional; NÃO é schema técnico. `https://datatracker.ietf.org/doc/rfc9920/`
- **DSSE** — Dead Simple Signing Envelope. Community spec (Secure Systems Lab, NYU), tag v1.0.0. NÃO é RFC IETF. `https://github.com/secure-systems-lab/dsse`
- **SLSA v1.2** — Supply-chain Levels for Software Artifacts. Approved Specification, 24/nov/2025. Build Track L0–L3. `https://slsa.dev/spec/v1.2/build-track-basics`
- **JSON Schema 2020-12** — `https://json-schema.org/draft/2020-12`
- **OpenTelemetry** (trace_id/span_id, W3C Trace Context) — `https://opentelemetry.io/`
- **Google Cloud:** Audit Logs, Cloud KMS / Key Rotation, Cloud Logging, BigQuery — referências de coleta de raw evidence (não fonte canônica final).

Pareamentos de design não-verificados normativamente, marcados **[DESIGN]**: ECDSA P-256 + FIPS 186-5 + RFC 6979 (determinístico-k). Confirmar contra implementação REX Guard (OQ-03).
