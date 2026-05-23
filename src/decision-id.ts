/**
 * decision-id.ts — recomputacao do DecisionID (CONTRATO COM TODO).
 *
 * [DEC-FL] Alinhado a mecanica Veritas/REX Guard existente.
 * Base inicial CONFIRMADA: input_hash + policy_hash + model_hash + threshold + jurisdiction.
 *
 * [TODO] confirm production formula.
 *   A formula de producao do Veritas PODE incluir campos adicionais
 *   (tenant, decision_type, ruleset_hash, occurred_at truncado, nonce).
 *   NAO inventamos campos para "parecer completo". Esta funcao implementa
 *   APENAS a base confirmada e sinaliza pendencia.
 *
 * [TODO][OQ-02] Producao concatena campos com separador fixo OU canonicaliza
 *   objeto JSON (JCS)? Os dois caminhos sao incompativeis byte-a-byte.
 *   Enquanto OQ-02 estiver aberta, esta funcao retorna PENDING e o verifier
 *   marca decision_ids_recomputed como nao-conclusivo (warning, nao blocking),
 *   para nao gerar falso-negativo contra a producao real.
 */
import { sha256 } from "./hash.ts";
import { canonicalizeJson } from "./canonicalize.ts";

export interface DecisionIdInput {
  input_hash: string;
  policy_hash: string;
  model_hash: string;
  threshold: number;
  jurisdiction: string;
}

export type DecisionIdStatus = "match" | "mismatch" | "pending-production-formula";

export interface DecisionIdResult {
  status: DecisionIdStatus;
  computed: string | null;
  note: string;
}

/**
 * Flag global: enquanto a formula de producao nao for confirmada (OQ-02),
 * a recomputacao roda mas o resultado e tratado como nao-conclusivo.
 * Mudar para true SOMENTE apos confirmar a formula exata com Veritas.
 */
export const PRODUCTION_FORMULA_CONFIRMED = false;

/**
 * Recomputa o DecisionID a partir da base confirmada.
 *
 * Caminho A (atual, [DESIGN]): canonicaliza objeto via JCS e hasheia.
 *   DecisionID = sha256( JCS({input_hash, jurisdiction, model_hash, policy_hash, threshold}) )
 *
 * [TODO] Se a producao usar concatenacao com separador, implementar Caminho B
 *   e selecionar via PRODUCTION_FORMULA_CONFIRMED + parametro de perfil.
 */
export function recomputeDecisionId(input: DecisionIdInput): string {
  const canonical = canonicalizeJson({
    input_hash: input.input_hash,
    jurisdiction: input.jurisdiction,
    model_hash: input.model_hash,
    policy_hash: input.policy_hash,
    threshold: input.threshold,
  });
  return sha256(Buffer.from(canonical, "utf8"));
}

/** Compara o DecisionID arquivado com a recomputacao, respeitando o estado de OQ-02. */
export function checkDecisionId(archived: string, input: DecisionIdInput): DecisionIdResult {
  const computed = recomputeDecisionId(input);
  if (!PRODUCTION_FORMULA_CONFIRMED) {
    return {
      status: "pending-production-formula",
      computed,
      note:
        "OQ-02 aberta: formula de producao nao confirmada. Resultado nao-conclusivo " +
        "(warning, nao blocking). Confirmar separador-fixo vs JCS com Veritas.",
    };
  }
  return {
    status: computed === archived ? "match" : "mismatch",
    computed,
    note: computed === archived ? "ok" : "DECISION_ID_RECOMPUTE_FAILED",
  };
}
