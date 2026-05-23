/**
 * dsse.ts — DSSE (Dead Simple Signing Envelope) v1.0.0.
 *
 * [FATO-NORM] Community spec, Secure Systems Lab (NYU), tag v1.0.0.
 * NAO e um RFC IETF. https://github.com/secure-systems-lab/dsse
 *
 * Envelope:
 *   { payload: base64(SERIALIZED_BODY), payloadType: string,
 *     signatures: [{ keyid?: string, sig: base64 }] }
 *
 * [FATO-NORM] PAE (Pre-Authentication Encoding), verbatim do protocol.md:
 *   PAE(type, body) = "DSSEv1" SP LEN(type) SP type SP LEN(body) SP body
 *   SP = ASCII space (0x20); LEN(s) = decimal ASCII do len em bytes, sem zeros a esquerda.
 *   A assinatura cobre PAE(UTF8(payloadType), SERIALIZED_BODY), NAO o base64 nem o JSON.
 *
 * [FATO-NORM] Regra obrigatoria de verificacao: o mesmo SERIALIZED_BODY verificado
 * MUST ser o entregue a aplicacao; MUST NOT re-parsear o envelope apos verificar
 * para extrair o payload. Esta implementacao retorna o body verificado e o chamador
 * deve usar ESSE body.
 */
import { createPublicKey, verify as cryptoVerify, type KeyObject } from "node:crypto";

export interface DsseEnvelope {
  payload: string; // base64(SERIALIZED_BODY)
  payloadType: string;
  signatures: { keyid?: string; sig: string }[];
}

/** Constroi o PAE conforme DSSE v1.0.0. */
export function pae(payloadType: string, serializedBody: Buffer): Buffer {
  const typeBytes = Buffer.from(payloadType, "utf8");
  const parts = [
    Buffer.from("DSSEv1", "ascii"),
    Buffer.from(" ", "ascii"),
    Buffer.from(String(typeBytes.length), "ascii"),
    Buffer.from(" ", "ascii"),
    typeBytes,
    Buffer.from(" ", "ascii"),
    Buffer.from(String(serializedBody.length), "ascii"),
    Buffer.from(" ", "ascii"),
    serializedBody,
  ];
  return Buffer.concat(parts);
}

export interface TrustStoreEntry {
  keyid: string;
  /** PEM SPKI da chave publica EC P-256. */
  publicKeyPem: string;
  /** epocas em que a chave e valida; se revogada antes de occurred_at, falha. */
  revoked?: boolean;
}

export interface DsseVerifyResult {
  verified: boolean;
  /** SERIALIZED_BODY verificado — o chamador DEVE usar este, nao re-parsear o envelope. */
  body: Buffer | null;
  reason?: string;
}

/**
 * Verifica um envelope DSSE contra um trust store.
 *
 * [DEC-FL] Assinatura ECDSA P-256 sobre SHA-256 do PAE. dsaEncoding ieee-p1363
 * (r||s cru, 64 bytes) — formato comum de KMS/HSM. Se a producao usar DER,
 * trocar dsaEncoding. Ver OQ-03 / [TODO] confirm.
 */
export function verifyDsse(env: DsseEnvelope, trust: TrustStoreEntry[]): DsseVerifyResult {
  let body: Buffer;
  try {
    body = Buffer.from(env.payload, "base64");
  } catch {
    return { verified: false, body: null, reason: "payload base64 invalido" };
  }
  const signedData = pae(env.payloadType, body);

  for (const sigEntry of env.signatures) {
    const entry = trust.find((t) => t.keyid === sigEntry.keyid);
    if (!entry) continue;
    if (entry.revoked) {
      return { verified: false, body: null, reason: "SIGNATURE_KEY_REVOKED" };
    }
    let key: KeyObject;
    try {
      key = createPublicKey(entry.publicKeyPem);
    } catch {
      return { verified: false, body: null, reason: "chave publica invalida" };
    }
    let sig: Buffer;
    try {
      sig = Buffer.from(sigEntry.sig, "base64");
    } catch {
      return { verified: false, body: null, reason: "sig base64 invalida" };
    }
    const ok = cryptoVerify(
      "sha256",
      signedData,
      { key, dsaEncoding: "ieee-p1363" },
      sig,
    );
    if (ok) {
      // Retorna o body verificado. O chamador NAO deve re-parsear o envelope.
      return { verified: true, body };
    }
  }
  return { verified: false, body: null, reason: "SIGNATURE_INVALID" };
}
