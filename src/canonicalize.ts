/**
 * canonicalize.ts — canonicalizacao JSON.
 *
 * [DEC-FL] Onde houver JSON canonicalizado (input do DecisionID, payload de
 * evento antes do hash), usar JCS — RFC 8785.
 * https://www.rfc-editor.org/rfc/rfc8785
 *
 * [TODO][RISCO R-13] ATENCAO: esta implementacao faz apenas ordenacao
 * lexicografica recursiva de chaves de objeto. NAO implementa a serializacao
 * numerica completa do RFC 8785 (que segue ECMAScript Number-to-String /
 * IEEE 754, com regras especificas para notacao exponencial, -0, etc.).
 *
 * Para PRODUCAO, substituir por uma biblioteca auditada de JCS (p.ex. o pacote
 * npm "canonicalize" ou implementacao equivalente verificada contra os test
 * vectors do proprio RFC 8785). Numeros nao-inteiros e numeros grandes PODEM
 * divergir entre esta versao e uma implementacao JCS-compliant — o que
 * quebraria determinismo de hash. Ver concept.md Secao 11.2 e OQ-02.
 *
 * Enquanto o gap nao for fechado, evite canonicalizar payloads com floats;
 * prefira hashes (strings) e inteiros.
 */

export function canonicalizeJson(value: unknown): string {
  return serialize(value);
}

function serialize(v: unknown): string {
  if (v === null) return "null";
  const t = typeof v;
  if (t === "boolean") return v ? "true" : "false";
  if (t === "number") {
    if (!Number.isFinite(v as number)) {
      throw new Error("JCS: numeros NaN/Infinity nao sao serializaveis");
    }
    // [TODO] NAO e JCS-compliant para floats. Ver aviso no topo do arquivo.
    if (Number.isInteger(v as number)) return String(v);
    return String(v); // placeholder; lib auditada exigida para floats
  }
  if (t === "string") return JSON.stringify(v); // escaping minimo via JSON.stringify
  if (Array.isArray(v)) {
    return "[" + v.map(serialize).join(",") + "]";
  }
  if (t === "object") {
    const obj = v as Record<string, unknown>;
    const keys = Object.keys(obj).sort(); // ordenacao lexicografica de chaves
    const parts = keys.map((k) => JSON.stringify(k) + ":" + serialize(obj[k]));
    return "{" + parts.join(",") + "}";
  }
  throw new Error(`JCS: tipo nao serializavel: ${t}`);
}
