# Referências normativas verificadas

Todas verificadas contra fonte primária em 2026-05-23. Marcação:
**[FATO-NORM]** confirmado contra fonte; status indicado quando relevante.
Onde o uso na FoundLab é uma decisão de design (não obrigação da fonte), está
marcado **[DESIGN]** / **[DEC-FL]**.

## Canonicalização e serialização

- **[FATO-NORM] RFC 8785** — JSON Canonicalization Scheme (JCS). Standards Track,
  jun/2020. Define serialização canônica determinística de JSON.
  https://www.rfc-editor.org/rfc/rfc8785
  - Caveat de implementação: a referência (`src/canonicalize.ts`) ainda não cobre
    a serialização numérica completa (RISCO R-13).
- **[FATO-NORM] RFC 8949** — Concise Binary Object Representation (CBOR).
  Serialização binária usada em `evidence.cbor`.
  https://www.rfc-editor.org/rfc/rfc8949.html

## Merkle / transparência

- **[FATO-NORM] RFC 9162** — Certificate Transparency Version 2.0. **Experimental**,
  dez/2021; obsoleta RFC 6962. Fonte das construções Merkle Tree Hash (2.1.1),
  inclusion proof (2.1.3) e consistency proof (2.1.4), com domain separation
  0x00 (folha) / 0x01 (nó) exigida para resistência a segunda pré-imagem.
  https://www.rfc-editor.org/rfc/rfc9162.html
  - **[RISCO R-09]** Status Experimental. As construções Merkle são idênticas às
    da RFC 6962 (Standards-adjacent, amplamente implantada). Caveat de enquadramento
    documentado em `docs/concept.md` 8.4.

## Assinatura e envelope

- **[FATO-NORM] DSSE — Dead Simple Signing Envelope**, v1.0.0. Community spec do
  Secure Systems Lab (NYU). **NÃO é um RFC IETF.** Define o envelope e o PAE.
  https://github.com/secure-systems-lab/dsse
- **[FATO-NORM] RFC 7515** — JSON Web Signature (JWS). Referência de fallback caso
  um auditor exija âncora Standards-Track (OQ-07).
  https://www.rfc-editor.org/rfc/rfc7515.html
- **[DESIGN] ECDSA P-256** (NIST P-256 / secp256r1) + **FIPS 186-5** + **RFC 6979**
  (determinismo de k). Pareamento de design; confirmar contra implementação REX
  Guard (OQ-03). FIPS 186-5: https://csrc.nist.gov/pubs/fips/186-5/final ·
  RFC 6979: https://www.rfc-editor.org/rfc/rfc6979

## Provenance / supply chain

- **[FATO-NORM] SLSA v1.2** — Supply-chain Levels for Software Artifacts. Approved
  Specification, 24/nov/2025. Build Track com níveis L0/L1/L2/L3 (não há "L4" em
  v1.x). Objetivo de design do pipeline: Build L3.
  https://slsa.dev/spec/v1.2/build-track-basics
  Anúncio: https://slsa.dev/blog/2025/11/announce-slsa-v1.2
  - Provenance como in-toto attestation, `predicateType: https://slsa.dev/provenance/v1`,
    em envelope DSSE. Terminologia: https://slsa.dev/spec/v1.2/terminology

## Schema e identificadores

- **[FATO-NORM] JSON Schema 2020-12** — dialeto usado por todos os schemas em
  `/schemas`. https://json-schema.org/draft/2020-12
- **[FATO-NORM] RFC 3339** — timestamps (`occurred_at`, `created_at`).
  https://www.rfc-editor.org/rfc/rfc3339
- **[FATO-NORM] RFC 6901** — JSON Pointer (usado em RedactionPolicy / DisclosureProfile).
  https://www.rfc-editor.org/rfc/rfc6901

## Inspiração de processo (NÃO usadas como schema técnico)

- **[FATO-NORM] IETF Author Tools** — inspiração do fluxo source→validation→render→verify.
  https://authors.ietf.org/ · https://authors.ietf.org/author-tools-web-service
- **[FATO-NORM] RFC 7991** — "xml2rfc" Version 3 Vocabulary (RFCXML). IAB, dez/2016.
  Superseded na prática por https://authors.ietf.org/rfcxml-vocabulary . Citada
  apenas para esclarecer o que NÃO é adotado como schema.
  https://www.rfc-editor.org/rfc/rfc7991
- **[FATO-NORM] RFC 9720** — RFC Formats and Versions. Editorial, jan/2025.
  Renomeia "xml2rfc v3" → "RFCXML". Não define schema de evidência.
  https://datatracker.ietf.org/doc/rfc9720/
- **[FATO-NORM] RFC 9920** — RFC Editor Model (Version 3). Editorial, fev/2026.
  Modelo institucional/governança (RSWG, RSAB, RPC, RSCE). NÃO é schema técnico.
  Citada para deixar explícito que a FoundLab não confunde 9920 com RFCXML.
  https://datatracker.ietf.org/doc/rfc9920/

## Coleta de raw evidence (fontes operacionais, não fonte canônica final)

- **[FATO-NORM] OpenTelemetry** — `trace_id`/`span_id`, W3C Trace Context.
  https://opentelemetry.io/ · https://www.w3.org/TR/trace-context/
- **[DESIGN] Google Cloud** — Cloud Audit Logs, Cloud KMS / key rotation,
  Cloud Logging, BigQuery. Referências de coleta; o pacote selado é a fonte
  canônica, não os logs do provider.
