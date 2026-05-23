# Verification of IETF RFCs and Supply-Chain Specifications for the FoundLab Evidence Artifact Compiler

## TL;DR

- **Three of your five hypotheses are correct as stated; two need careful reframing.** RFC 9720 is correctly identified as “RFC Formats and Versions” and *does* normatively update RFCXML terminology; RFC 9920 is correctly the “RFC Editor Model (Version 3)” and is purely an editorial/institutional process document — but neither of these RFCs defines the RFCXML vocabulary itself; that vocabulary is defined normatively in **RFC 7991** (“The ‘xml2rfc’ Version 3 Vocabulary”, IAB, December 2016), with the `authors.ietf.org/rfcxml-vocabulary` page treated as the living superseding documentation.
- **DSSE is a community specification, not an IETF RFC**, maintained at `github.com/secure-systems-lab/dsse` (current stable Git tag v1.0.0); its envelope is `{payload, payloadType, signatures:[{keyid, sig}]}` and its Pre-Authentication Encoding (PAE) is the exact byte string `"DSSEv1" SP LEN(type) SP type SP LEN(body) SP body`. Its differentiation from JWS (RFC 7515) is deliberate: it signs raw bytes (not base64), forbids canonicalization, and binds an explicit `payloadType` into the signed input to prevent type/algorithm confusion.
- **SLSA v1.2 (released 24 November 2025, per slsa.dev/blog/2025/11/announce-slsa-v1.2) is the current Approved Specification** — not v1.0 and not v1.1. The Build Track is explicitly four named levels (Build L0 / L1 / L2 / L3), and a new Source Track was added in v1.2. RFC 9162 (Certificate Transparency v2.0, IETF Experimental, December 2021, obsoletes RFC 6962) gives you the exact Merkle constructs you need — 0x00 leaf-prefix / 0x01 internal-node prefix domain separation (explicitly justified by the RFC text “this domain separation is required to give second preimage resistance”),  inclusion proofs, consistency proofs, and Signed Tree Heads (STH / `signed_tree_head_v2`).

-----

## Key Findings

|Spec                                    |Confirmed title                             |Status / stream                                                                                                           |Anchors what you can claim                                                                                                                                                 |
|----------------------------------------|--------------------------------------------|--------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|**RFC 9720**                            |*RFC Formats and Versions*                  |Informational, Editorial Stream, January 2025; obsoletes RFC 7990; updates RFC 9280                                       |Defines “definitive format = RFCXML” and the terminology shift from “xml2rfc v3” to “RFCXML”;  does NOT define the XML schema itself                                       |
|**RFC 9920**                            |*RFC Editor Model (Version 3)*              |Informational, Editorial Stream, February 2026; obsoletes RFC 9280; updates RFCs 7841, 7991, 7992–7997, 8729, 8730, 9720  |Institutional/process model (RSWG, RSAB, RPC, RSCE, IETF LLC) — purely organizational, NOT a technical schema                                                              |
|**RFC 7991** (the actual XML vocabulary)|*The “xml2rfc” Version 3 Vocabulary*        |Informational, IAB Stream, December 2016; obsoletes RFC 7749                                                              |This — not 9720 or 9920 — is where RFCXML element/attribute grammar is normatively defined. `authors.ietf.org/rfcxml-vocabulary` is presented as superseding documentation |
|**DSSE**                                |*Dead Simple Signing Envelope*              |Community spec at `secure-systems-lab/dsse` (NOT an IETF RFC); SemVer-tagged, current stable tag **v1.0.0**               |Envelope JSON fields and PAE byte construction; built explicitly to replace JWS for in-toto/TUF                                                                            |
|**SLSA v1.2**                           |*Supply-chain Levels for Software Artifacts*|OpenSSF community spec at slsa.dev; v1.2 is Approved Specification (released 24 Nov 2025) — backwards-compatible with v1.1|Build Track L0/L1/L2/L3 explicitly named; provenance = signed attestation of how outputs were produced                                                                     |
|**RFC 9162**                            |*Certificate Transparency Version 2.0*      |Experimental, IETF Stream, December 2021; obsoletes RFC 6962                                                              |MTH with 0x00 leaf / 0x01 internal-node domain separation; inclusion proofs; consistency proofs; `signed_tree_head_v2`                                                     |

-----

## Details

### 1. RFC 9720 — Hypothesis CORRECT (with one nuance)

**Verified facts (rfc-editor.org / datatracker.ietf.org/doc/rfc9720/):**

- Title: **“RFC Formats and Versions”**.
- Authors: P. Hoffman (ICANN), H. Flanagan (Spherical Cow Consulting). 
- Published: **January 2025**. DOI 10.17487/RFC9720. 
- Stream: Editorial. Category: Informational. ISSN 2070-1721. 
- **Obsoletes:** RFC 7990 (“RFC Format Framework”, December 2016). **Updates:** RFC 9280 (stability policy). 

**Canonical abstract (verbatim from datatracker.ietf.org/doc/rfc9720/):**

> “In order to improve the readability of RFCs while supporting their archivability, the definitive version of the RFC Series transitioned from plain-text ASCII to XML using the RFCXML vocabulary; different publication versions are rendered from that base document. This document describes how RFCs are published.” 

**What 9720 actually does normatively (Section 1.1):**

- Defines four terms that replace “canonical”: *definitive format* (= RFCXML), *definitive version*, *publication format*, *publication version*. 
- **“It changes the phrase ‘xml2rfc version 3’ to ‘RFCXML’.”**  (verbatim, Section 1.1) — this is the *terminological* update referenced in your hypothesis.
- **“It changes the name of the body that publishes RFCs from ‘RFC Editor’ to ‘RFC Production Center’ (RPC).”** 
- Sets policies for when definitive and publication versions may be updated and how older versions are archived. 

**Verdict:** Your hypothesis — “updates terminology for RFCXML / concerns RFC Formats and Versions” — is **correct**. RFC 9720 governs how RFCs are *published* and renames “xml2rfc v3” to “RFCXML”; it does *not* itself define the XML vocabulary’s elements/attributes.

### 2. RFC 9920 — Hypothesis CORRECT; also disambiguated from RFCXML

**Verified facts (datatracker.ietf.org/doc/rfc9920/):**

- Title: **“RFC Editor Model (Version 3)”**.
- Authors: P. Hoffman (ICANN), A. Rossi (RFC Series Consulting Editor). 
- Published: **February 2026**. ISSN 2070-1721. Category: Informational. Stream: Editorial. 
- **Obsoletes:** RFC 9280. **Updates:** RFCs 7841, 7991, 7992, 7993, 7994, 7995, 7996, 7997, 8729, 8730, and 9720. 

**Canonical abstract (verbatim):**

> “This document specifies version 3 of the RFC Editor Model. The model defines two high-level tasks related to the RFC Series. First, policy definition is the joint responsibility of the RFC Series Working Group (RSWG), which produces policy proposals, and the RFC Series Approval Board (RSAB), which approves such proposals. Second, policy implementation is primarily the responsibility of the RFC Production Center (RPC) as contractually overseen by the IETF Administration Limited Liability Company (IETF LLC). In addition, various responsibilities of the RFC Editor function are now performed alone or in combination by the RSWG, RSAB, RPC, RFC Series Consulting Editor (RSCE), and IETF LLC. Finally, this document specifies the Editorial Stream for publication of future policy definition documents produced through the processes defined herein.” 

**Verdict:** Your hypothesis — “RFC Editor Model (Version 3) — an editorial/institutional model, NOT a technical schema for logs” — is **correct**. RFC 9920 is purely an *organizational governance* document about the bodies that manage the RFC series. It contains no technical schema, no data format, and nothing that would be normative for an evidence-log spec.

**Critical disambiguation (this is the misconception you wanted to avoid):**

- **RFCXML / xml2rfc v3 vocabulary is defined in RFC 7991** (“The ‘xml2rfc’ Version 3 Vocabulary”, P. Hoffman, IAB stream, Informational, December 2016, obsoletes RFC 7749). Authoritative source: rfc-editor.org/rfc/rfc7991. Verbatim abstract: *“This document defines the ‘xml2rfc’ version 3 vocabulary: an XML-based language used for writing RFCs and Internet-Drafts.”* 
- The IETF Authors site (`authors.ietf.org/rfcxml-vocabulary`) explicitly states the living grammar **supersedes** RFC 7991: *“The current version of the RFCXML vocabulary is v3 and this page is currently the authoritative documentation for v3, superseding RFC 7991 as multiple changes have been made since the publication of RFC 7991.”*  For a normative anchor, cite **RFC 7991 + `authors.ietf.org/rfcxml-vocabulary`**, not 9720 or 9920.
- For your spec: do NOT cite RFC 9920 for anything about XML, JSON, log schemas, or technical formats. It is irrelevant to the Evidence Artifact Compiler’s technical claims.

### 3. DSSE — Community spec (not an IETF RFC)

**Authoritative source:** `github.com/secure-systems-lab/dsse` (Secure Systems Lab at NYU). Specification follows SemVer with Git tags;  **current stable tag is v1.0.0** (see `github.com/secure-systems-lab/dsse/blob/v1.0.0/protocol.md`). Reference Python implementation in-repo; per the repo README, *“There’s a DSSE library for Go in go-securesystemslib”*   (`github.com/secure-systems-lab/go-securesystemslib`, package docs at `pkg.go.dev/github.com/secure-systems-lab/go-securesystemslib/dsse`).  **DSSE is not on the IETF standards track** and has no RFC number; it is a community specification used by in-toto, TUF, Sigstore, and SLSA.

**Envelope structure** (from `envelope.md` / `envelope.proto`, verbatim from github.com/secure-systems-lab/dsse):

```json
{
  "payload": "<base64(SERIALIZED_BODY)>",
  "payloadType": "<application-specific media type>",
  "signatures": [
    { "keyid": "<optional unauthenticated hint>",
      "sig": "<base64 signature over PAE(payloadType, payload)>" }
  ]
}
```

The protobuf form (`envelope.proto`):

- `bytes payload = 1;` (REQUIRED) 
- `string payloadType = 2;` (REQUIRED) 
- `repeated Signature signatures = 3;` (REQUIRED, length ≥ 1) 
- `Signature { bytes sig = 1; string keyid = 2; }` (`sig` REQUIRED; `keyid` OPTIONAL and explicitly *unauthenticated*) 

**Pre-Authentication Encoding (PAE) — verbatim from `protocol.md`:**

```
PAE(type, body) = "DSSEv1" + SP + LEN(type) + SP + type + SP + LEN(body) + SP + body
  +        = concatenation
  SP       = ASCII space [0x20]
  "DSSEv1" = ASCII [0x44, 0x53, 0x53, 0x45, 0x76, 0x31]
  LEN(s)   = ASCII decimal encoding of the byte length of s, with no leading zeros [![](claude-citation:/icon.png?validation=80E670AC-6A29-411A-8E59-671CB96CAEB2&citation=eyJlbmRJbmRleCI6OTk1OCwibWV0YWRhdGEiOnsiaWNvblVybCI6Imh0dHBzOlwvXC93d3cuZ29vZ2xlLmNvbVwvczJcL2Zhdmljb25zP3N6PTY0JmRvbWFpbj1naXRodWIuY29tIiwicHJldmlld1RpdGxlIjoiZHNzZVwvcHJvdG9jb2wubWQgYXQgdjEuMC4wIMK3IHNlY3VyZS1zeXN0ZW1zLWxhYlwvZHNzZSIsInNvdXJjZSI6IkdpdEh1YiIsInR5cGUiOiJnZW5lcmljX21ldGFkYXRhIn0sInNvdXJjZXMiOlt7Imljb25VcmwiOiJodHRwczpcL1wvd3d3Lmdvb2dsZS5jb21cL3MyXC9mYXZpY29ucz9zej02NCZkb21haW49Z2l0aHViLmNvbSIsInNvdXJjZSI6IkdpdEh1YiIsInRpdGxlIjoiZHNzZVwvcHJvdG9jb2wubWQgYXQgdjEuMC4wIMK3IHNlY3VyZS1zeXN0ZW1zLWxhYlwvZHNzZSIsInVybCI6Imh0dHBzOlwvXC9naXRodWIuY29tXC9zZWN1cmUtc3lzdGVtcy1sYWJcL2Rzc2VcL2Jsb2JcL3YxLjAuMFwvcHJvdG9jb2wubWQifV0sInN0YXJ0SW5kZXgiOjk2NzYsInRpdGxlIjoiR2l0SHViIiwidXJsIjoiaHR0cHM6XC9cL2dpdGh1Yi5jb21cL3NlY3VyZS1zeXN0ZW1zLWxhYlwvZHNzZVwvYmxvYlwvdjEuMC4wXC9wcm90b2NvbC5tZCIsInV1aWQiOiJlMjFiNjQ2NC03MTAzLTQ1MWQtYTYwNi1hNDQ5ODA5NThmYmEifQ%3D%3D "GitHub")](https://github.com/secure-systems-lab/dsse/blob/v1.0.0/protocol.md)
```

The signature is computed over `PAE(UTF8(PAYLOAD_TYPE), SERIALIZED_BODY)`,   NOT over the payload or the JSON envelope.

**How DSSE differs from JWS (RFC 7515):**

- **Sign raw bytes, not base64.** From `background.md`: *“Why sign raw bytes rather than base64 encoded bytes (as per JWS)? Because it’s simpler. Base64 is only needed for putting binary data in a text field, such as JSON. In other formats, such as protobuf or CBOR, base64 isn’t needed at all.”* 
- **Eliminate algorithm/header confusion.** The README states bluntly: *“Why not JWS? Too many insecure implementations and features.”*  JWS’s history of `alg: none` and algorithm-confusion bugs is the cited motivating problem.
- **Forbid canonicalization.** DSSE was designed to replace the legacy in-toto/TUF Canonical-JSON-based signing scheme: *“It requires the payload to be JSON or convertible to JSON. … Two semantically different payloads could have the same canonical encoding. … It is safer to avoid canonicalization altogether.”* 
- **PAE binds payloadType to payload.** The single signed string includes both the type and the body with length-prefixed framing borrowed from PASETO PAE and ed25519ctx.  This is what defeats *type confusion*: a verifier cannot be tricked into accepting bytes that were signed under a different `payloadType`.

**Recommended verification rule (from `protocol.md`) — important for auditor defensibility:**

> “Implementations MUST ensure that the same SERIALIZED_BODY that is verified is the same sent to the application layer. In particular, implementations MUST NOT re-parse the envelope after verification to pull out the payload. Failure to adhere to this requirement can lead to security vulnerabilities.” 

### 4. SLSA — Current version is v1.2 (released 24 Nov 2025), not v1.0

This is a correction to your prompt’s assumption. The lineage is:

- **v0.1** (June 2021): four levels (SLSA 1–4) spanning source + build + provenance + common requirements bundled together.
- **v1.0** (19 April 2023, per the OpenSSF press release at openssf.org/press-release/2023/04/19): *“SAN FRANCISCO, CA, April 19, 2023 – The Open Source Security Foundation (OpenSSF) is proud to announce the release of version 1.0 of Supply-chain Levels for Software Artifacts (SLSA).”* This release restructured the spec into *tracks*. Only the Build Track was specified, with Build L1–L3. Level 4 and source/common requirements were deferred. From slsa.dev/spec/v1.0/whats-new: *“SLSA v1.0 is more stable and better defined than v0.1, but less ambitious. It corresponds roughly to the build and provenance requirements of the prior version’s SLSA Levels 1 through 3, deferring SLSA Level 4 and the source and common requirements to a future version.”* 
- **v1.1** (21 April 2025, per slsa.dev/blog/2025/04/slsa-v1.1): *“Today we’re releasing SLSA Version 1.1 as the latest Approved Specification of SLSA, effectively replacing Version 1.0.”*  Clarifications, VSA verification procedure, verifier metadata; backwards-compatible with v1.0.
- **v1.2** (24 November 2025, per slsa.dev/blog/2025/11/announce-slsa-v1.2 — the current Approved Specification): *“Today we’re pleased to announce the release of SLSA Version 1.2, the latest version of the SLSA specification. With the introduction of the Source Track, SLSA v1.2 represents a major milestone in the development of SLSA. … SLSA v1.2 is backwards compatible with SLSA v1.1.”* 

**Build Track levels (verbatim from slsa.dev/spec/v1.2/build-track-basics):**

|Level       |Summary                                                                                                                                                                                                                    |Tampering mitigated                                                                            |
|------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------|
|**Build L0**|“No requirements — L0 represents the lack of SLSA.” Intended for dev/test builds.                                                                                                                                          |None                                                                                           |
|**Build L1**|“Package has provenance showing how it was built. Can be used to prevent mistakes but is trivial to bypass or forge.”                                                                                                      |Mistakes; documentation                                                                        |
|**Build L2**|“Forging the provenance or evading verification requires an explicit ‘attack’, though this may be easy to perform. … builds run on a hosted platform that generates and signs the provenance.”                             |Tampering *after* the build (via digital signatures)                                           |
|**Build L3**|“Forging the provenance or evading verification requires exploiting a vulnerability that is beyond the capabilities of most adversaries. … builds run on a hardened build platform that offers strong tamper protection.”  |Tampering *during* the build (insider threats, compromised credentials, cross-tenant influence)|

Build L0 IS explicitly a named level in v1.2 (not implicit). Build L3 requires both isolation between runs and protection of provenance-signing key material from user-defined build steps. 

**Provenance (definition):** From slsa.dev/spec/v1.2/terminology — *“Attestation (metadata) describing how the outputs were produced, including identification of the platform and external parameters.”*  The SLSA provenance schema follows the in-toto attestation framework, and the typical wire format is a DSSE envelope wrapping a `predicateType: https://slsa.dev/provenance/v1` payload.

**Relevance to your Evidence Artifact Compiler:**

- Pipeline tamper-resistance and signed evidence map directly to **Build L2** (hosted, signed provenance) and **Build L3** (isolation + signer-key protection from user code).
- The “evidence-generation pipeline integrity” claim is the **Build L3 isolation requirement**: prevent runs from influencing one another, and prevent secret material used to sign provenance from being accessible to user-defined build steps.  
- Note: SLSA explicitly says Build L3 does **not** cover compromise of the build platform itself by malicious insiders  — verifiers must independently establish a root of trust in the platform.

### 5. RFC 9162 — Certificate Transparency Version 2.0

**Verified facts (rfc-editor.org/rfc/rfc9162):**

- Title: **“Certificate Transparency Version 2.0”**.
- Authors: B. Laurie (Google), E. Messeri (Google), R. Stradling (Sectigo). 
- Published: **December 2021**. Category: **Experimental**. Stream: IETF. ISSN 2070-1721. **Obsoletes RFC 6962**  (June 2013, B. Laurie, A. Langley, E. Kasper, Experimental).
- Important caveat for an auditor: it is **Experimental**, not Standards Track. Per MDN Web Docs (developer.mozilla.org/en-US/docs/Web/Security/Certificate_Transparency, last modified 9 Jan 2026): *“Firefox desktop, starting from version 135, and Firefox for Android, starting from version 145, require CT log inclusion for all certificates issued by certificate authorities in Mozilla’s Root CA Program. Browser implementations are based on the obsoleted specification RFC 6962: Certificate Transparency.”*   RFC 9162 is the current canonical IETF specification, but production Web PKI deployments still operate against RFC 6962 logs.

**Abstract (verbatim):** *“This document describes version 2.0 of the Certificate Transparency (CT) protocol for publicly logging the existence of Transport Layer Security (TLS) server certificates as they are issued or observed, in a manner that allows anyone to audit certification authority (CA) activity and notice the issuance of suspect certificates as well as to audit the certificate logs themselves. … This document obsoletes RFC 6962. It also specifies a new TLS extension that is used to send various CT log artifacts.”*  

**Merkle Tree Hash (MTH) — exact construction from Section 2.1.1, verbatim:**

> “The hash algorithm used is one of the log’s parameters (see Section 4.1). This document establishes a registry of acceptable hash algorithms (see Section 10.2.1). Throughout this document, the hash algorithm in use is referred to as HASH and the size of its output in bytes is referred to as HASH_SIZE.”  

> “The hash of an empty list is the hash of an empty string: **MTH({}) = HASH().**” 
> 
> “The hash of a list with one entry (also known as a leaf hash) is: **MTH({d[0]}) = HASH(0x00 || d[0]).**” 
> 
> “For n > 1, let k be the largest power of two smaller than n (i.e., k < n ≤ 2k). The Merkle Tree Hash of an n-element list D_n is then defined recursively as: **MTH(D_n) = HASH(0x01 || MTH(D[0:k]) || MTH(D[k:n])),**” 
> 
> “Note that the hash calculations for leaves and nodes differ; **this domain separation is required to give second preimage resistance.**” 

That last sentence is the citation you want for justifying the 0x00 / 0x01 prefix in your spec — RFC 9162 itself states the rationale.

**HASH is not fixed by the RFC.** RFC 9162 makes the hash algorithm a *log parameter* (Section 4.1), with allowed values managed by an IANA registry (Section 10.2.1). RFC 6962 hardcoded SHA-256; 9162 added “hash and signature algorithm agility.”  For your spec, you should *choose* SHA-256 explicitly and cite Section 4.1 / Section 10.2.1 — don’t claim RFC 9162 mandates SHA-256.

**Inclusion proofs (Section 2.1.3):** *“A Merkle inclusion proof for a leaf in a Merkle Tree is the shortest list of additional nodes in the Merkle Tree required to compute the Merkle Tree Hash for that tree.”*   Encoded on the wire as `TransItem` of type `inclusion_proof_v2`, with `InclusionProofDataV2 { LogID log_id; uint64 tree_size; uint64 leaf_index; NodeHash inclusion_path<0..2^16-1>; }`. 

**Consistency proofs (Section 2.1.4):** Prove that one tree head is a prefix of a later tree head; encoded as `TransItem` of type `consistency_proof_v2`. From the RFC: *“The append-only property of each log is achieved using Merkle Trees, which can be used to efficiently prove that any particular instance of the log is a superset of any particular previous instance.”* 

**Signed Tree Head (STH) — Sections 4.9–4.10:** v2’s STH is encoded as `TransItem` of type `signed_tree_head_v2`. Replaces the v1 plain “STH” terminology. Signed by the log under its log key; covers `tree_size`, `timestamp`, root hash, and extensions.

**Mapping CT v2 to a general verifiable audit log (this is what your Evidence Artifact Compiler is doing):**

- Each evidence record → a leaf computed as `HASH(0x00 || record_bytes)`.
- Internal nodes → `HASH(0x01 || left || right)`.
- Compiler periodically publishes an STH-equivalent: `Sign_ECDSA-P256(tree_size || timestamp || root_hash)`.
- For any record, the compiler can produce a Merkle audit / inclusion proof, log-size-bounded at O(log n).
- For any two STHs, a consistency proof demonstrates append-only behavior.
- All structures embedded in a DSSE envelope with `payloadType = application/vnd.foundlab.evidence-sth+json` (or similar application-specific media type) and canonical JSON serialization per RFC 8785.

This composition — RFC 9162-style Merkle tree + RFC 8785 JCS-canonicalized record bytes + DSSE-enveloped STH signed with ECDSA P-256 (FIPS 186-5 / RFC 6979 deterministic-k) — is well-defended for a financial-sector auditor because every primitive is anchored in either an IETF RFC or a widely-used community spec with implementations across Sigstore, in-toto, and SLSA.

-----

## Recommendations

**Use these exact citations in the FoundLab Evidence Artifact Compiler specification:**

1. **For RFC document publication/format vocabulary terminology** (you almost certainly do *not* need to cite either 9720 or 9920 in a technical evidence-log spec — but if you do):
- Cite **RFC 7991** for the RFCXML / xml2rfc v3 grammar itself.
- Cite **RFC 9720** only for the renaming “xml2rfc v3 → RFCXML” or for RFC publication-version policy.
- Cite **RFC 9920** only if discussing the institutional model of the RFC editorial process.
- **Remove any claim that RFC 9920 defines a schema, log format, or technical structure.** It does not.
1. **For the envelope:** Cite `github.com/secure-systems-lab/dsse` at tag **v1.0.0**, specifically `protocol.md` (PAE + signing/verification algorithm) and `envelope.md` (JSON structure). Pin the commit hash in your spec for reproducibility. Do NOT call DSSE “an IETF standard”; call it “a community specification maintained by Secure Systems Lab at NYU, used by in-toto, TUF, Sigstore, and SLSA.” If you also support JWS, cite RFC 7515 alongside.
1. **For canonical JSON before signing:** Cite **RFC 8785 (JSON Canonicalization Scheme — JCS, June 2020, Standards Track)**. This is correctly named in your prompt and is independent of any of the specs above.
1. **For the verifiable log:** Cite **RFC 9162 Section 2.1.1** (MTH definition with 0x00/0x01 prefix + the verbatim sentence “this domain separation is required to give second preimage resistance”), **Section 2.1.3** (inclusion proof), **Section 2.1.4** (consistency proof), **Section 4.10** (signed_tree_head_v2). Flag explicitly that RFC 9162 is Experimental (not Standards Track) but is the current canonical version of CT and obsoletes RFC 6962.
1. **For supply-chain tier claims about the compiler’s own pipeline:** Cite **SLSA v1.2 Build Track** (slsa.dev/spec/v1.2/build-track-basics), targeting **Build L3** as the design objective (hardened build platform, isolation between runs, signer keys inaccessible to user-defined steps). Avoid claiming “SLSA Level 4” — Level 4 is explicitly deferred and is not part of any v1.x Build Track. Provenance should be emitted as in-toto attestation `predicateType: https://slsa.dev/provenance/v1` in a DSSE envelope.
1. **For ECDSA P-256 signatures:** Pair the algorithm choice with **FIPS 186-5** and **RFC 6979** (deterministic-k). DSSE explicitly uses ECDSA over NIST P-256 and SHA-256 with deterministic-rfc6979  in its reference test vectors (`github.com/secure-systems-lab/dsse/blob/master/protocol.md`), so this is a well-trodden pairing.

**Staged adoption plan:**

- *Phase 1 (now):* Lock the citation list above into the FoundLab spec; pin DSSE to tag v1.0.0 commit hash; pin SLSA to v1.2 release branch.
- *Phase 2 (before audit):* Produce a conformance matrix showing each spec’s Section number → FoundLab spec section using the construct → test vector. RFC 9162 ships test vectors in its Section 2.1.5 (“Example”); DSSE ships test vectors in its `implementation/` directory. Use these as regression-test gold standards.
- *Phase 3 (when threats change):* If quantum resistance becomes a requirement, switch to RFC 9162’s hash-agility hook (Section 10.2.1 IANA registry) and revisit ECDSA P-256.

**Benchmarks that would change these recommendations:**

- If SLSA v1.3 / v2.0 redefines tracks or merges Build L4 back in → re-pin.
- If RFC 9162 advances from Experimental to Standards Track, or if a “tlog” or successor RFC supersedes it → update the citation but the Merkle constructs themselves are stable.
- If DSSE v2 introduces a breaking change to PAE → either pin v1.0.0 indefinitely or migrate; do not assume forward compatibility.
- If RFC 9920 (Feb 2026) generates downstream errata that reach into RFC 7991 → re-check the RFCXML reference page on `authors.ietf.org`.

-----

## Caveats

- **RFC 9162 is Experimental, not Standards Track.** This is uncommon for a security-critical anchor. Most production CT deployments still target RFC 6962 because Web PKI clients haven’t migrated to v2.0 (MDN confirms Firefox 135/Android 145 enforcement is built against RFC 6962). For a financial-sector auditor, you should explicitly note this status and document that you adopt RFC 9162’s Merkle constructs *as constructs* — the Merkle Tree Hash, inclusion proof, and consistency proof are mathematically identical between 6962 and 9162; the differences (TransItem encoding, IANA registries, CMS-based precertificates, transparency_info TLS extension) are largely irrelevant to a general append-only evidence log. The auditor-defensible framing is: “We use the Merkle Tree Hash, inclusion-proof, and consistency-proof constructions specified in RFC 9162 Sections 2.1.1–2.1.4, which are the canonical IETF formalization of the original Laurie–Langley–Kasper CT construction (RFC 6962, June 2013).”
- **RFC 9920 was published only in February 2026.** Datatracker is the authoritative source; if you need stable archival citations, also cite the RFC Editor info page `https://www.rfc-editor.org/info/rfc9920`. Be aware that 9920 updates RFC 9720 itself, so any 9720-quoted policy text should be cross-checked against 9920’s updates.
- **DSSE is a community specification.** It has no formal standards body, no ISO or NIST imprimatur, and no IETF working group. Its defensibility for a financial auditor rests on its adoption: Sigstore, in-toto, TUF, SLSA, and the broader OpenSSF ecosystem. If your auditor demands an IETF anchor, JWS (RFC 7515) + JCS (RFC 8785) is the fallback pair — but you lose PAE’s anti-type-confusion property and inherit JWS’s algorithm-confusion footguns.
- **SLSA v1.2 was published on 24 November 2025.** It is backwards-compatible with v1.1,  so existing v1.1 attestations remain valid. The Source Track is new in v1.2 and is mostly irrelevant to a build-side evidence compiler; you can cite Build Track only.
- **The “RFCXML schema” confusion.** Several aggregator / wiki pages conflate RFC 9720 with the RFCXML grammar itself. They are different documents. If your spec must reference RFCXML schema elements normatively, cite **RFC 7991** plus the living `authors.ietf.org/rfcxml-vocabulary` page. RFC 9720 is policy/terminology only.
- **“Algorithm/type confusion” framing.** Your prompt asked whether PAE solves “algorithm/type confusion.” DSSE’s own documents frame the problem primarily as **type confusion** (two applications interpreting the same bytes differently because they share a payload encoding like JSON)  and **canonicalization weakness**, not as JWS-style algorithm confusion per se. JWS algorithm confusion is mentioned only obliquely in the README (“Why not JWS? Too many insecure implementations and features.”). Use precise framing: “PAE binds an explicit, application-specific `payloadType` into the signed string, preventing cross-application reinterpretation of the same payload bytes.”
