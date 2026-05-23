/**
 * merkle.ts — Merkle Tree Hash conforme RFC 9162 Secao 2.1.1.
 *
 * [FATO-NORM] https://www.rfc-editor.org/rfc/rfc9162.html
 *   MTH({})       = HASH()
 *   MTH({d[0]})   = HASH(0x00 || d[0])                       (leaf)
 *   MTH(D_n) n>1  = HASH(0x01 || MTH(D[0:k]) || MTH(D[k:n]))  (node), k = maior potencia de 2 < n
 *
 * [FATO-NORM] A separacao de dominio (0x00 folha / 0x01 no) e exigida pela
 * propria RFC para resistencia a segunda pre-imagem.
 *
 * [RISCO R-09] RFC 9162 e Experimental. As construcoes de Merkle sao
 * matematicamente identicas a RFC 6962. Caveat documentado em concept.md 8.4.
 */
import { sha256Raw } from "./hash.ts";

const LEAF_PREFIX = Buffer.from([0x00]);
const NODE_PREFIX = Buffer.from([0x01]);

/** Leaf hash: HASH(0x00 || data). */
export function leafHash(data: Buffer): Buffer {
  return sha256Raw(Buffer.concat([LEAF_PREFIX, data]));
}

/** Node hash: HASH(0x01 || left || right). */
export function nodeHash(left: Buffer, right: Buffer): Buffer {
  return sha256Raw(Buffer.concat([NODE_PREFIX, left, right]));
}

/** Maior potencia de 2 estritamente menor que n. */
function largestPowerOfTwoLessThan(n: number): number {
  if (n < 2) throw new Error("k indefinido para n < 2");
  let k = 1;
  while (k * 2 < n) k *= 2;
  return k;
}

/**
 * Merkle Tree Hash sobre uma lista de leaves ja-hasheadas (folhas = leafHash(record_bytes)).
 * Recebe os digests crus das folhas. Lista vazia => HASH() = sha256 de string vazia.
 */
export function merkleTreeHash(leaves: Buffer[]): Buffer {
  const n = leaves.length;
  if (n === 0) return sha256Raw(Buffer.alloc(0)); // MTH({}) = HASH()
  if (n === 1) return leaves[0]!; // ja e leaf hash
  const k = largestPowerOfTwoLessThan(n);
  const left = merkleTreeHash(leaves.slice(0, k));
  const right = merkleTreeHash(leaves.slice(k, n));
  return nodeHash(left, right);
}

/**
 * Verifica uma inclusion proof RFC 9162-style.
 *
 * leafHashBuf: HASH(0x00 || record_bytes) ja computado.
 * auditPath: nos irmaos, da folha em direcao a raiz.
 * Reconstroi a root e compara com expectedRoot.
 *
 * NOTA [DESIGN]: a reconstrucao a partir de (leaf_index, tree_size, audit_path)
 * segue o algoritmo da RFC 9162 Secao 2.1.3.2. Esta implementacao cobre o caso
 * canonico; vetores de borda (arvores nao-balanceadas extremas) devem ser
 * cobertos por test vectors antes de DML-3. Ver OQ-08.
 */
export function verifyInclusionProof(
  leafHashBuf: Buffer,
  leafIndex: number,
  treeSize: number,
  auditPath: Buffer[],
  expectedRoot: Buffer,
): boolean {
  if (leafIndex >= treeSize || leafIndex < 0) return false;

  // Algoritmo de reconstrucao (RFC 9162 2.1.3.2, adaptado).
  let fn = leafIndex;
  let sn = treeSize - 1;
  let r = leafHashBuf;
  for (const sibling of auditPath) {
    if (sn === 0) return false; // path longo demais
    if (fn % 2 === 1 || fn === sn) {
      r = nodeHash(sibling, r);
      if (fn % 2 === 0) {
        // sobe ate o proximo bit setado
        while (fn % 2 === 0 && sn !== 0) {
          fn >>= 1;
          sn >>= 1;
        }
      }
    } else {
      r = nodeHash(r, sibling);
    }
    fn >>= 1;
    sn >>= 1;
  }
  return sn === 0 && r.equals(expectedRoot);
}
