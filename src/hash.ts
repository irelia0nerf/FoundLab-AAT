/**
 * hash.ts — primitivos de hashing.
 *
 * [DEC-FL] SHA-256 fixo como HASH inicial (concept.md Secao 8.4).
 * RFC 9162 trata HASH como parametro do log; aqui fixamos SHA-256
 * e NAO afirmamos que a RFC obriga SHA-256.
 */
import { createHash } from "node:crypto";

/** Prefixo canonico usado em todo o pacote. */
export const HASH_PREFIX = "sha256:";

/** Computa SHA-256 sobre bytes e retorna no formato canonico "sha256:<hex>". */
export function sha256(data: Buffer | Uint8Array): string {
  const h = createHash("sha256").update(data).digest("hex");
  return HASH_PREFIX + h;
}

/** Computa SHA-256 e retorna o digest cru (Buffer), util para Merkle. */
export function sha256Raw(data: Buffer | Uint8Array): Buffer {
  return createHash("sha256").update(data).digest();
}

/** Converte "sha256:<hex>" em Buffer de 32 bytes. Lanca se malformado. */
export function hashHexToBuffer(h: string): Buffer {
  if (!h.startsWith(HASH_PREFIX)) {
    throw new Error(`hash sem prefixo ${HASH_PREFIX}: ${h}`);
  }
  const hex = h.slice(HASH_PREFIX.length);
  if (!/^[0-9a-f]{64}$/.test(hex)) {
    throw new Error(`hash hex invalido: ${h}`);
  }
  return Buffer.from(hex, "hex");
}

/** Buffer (32 bytes) -> "sha256:<hex>". */
export function bufferToHashHex(b: Buffer): string {
  return HASH_PREFIX + b.toString("hex");
}
