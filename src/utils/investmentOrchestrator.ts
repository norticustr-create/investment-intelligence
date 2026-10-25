/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Read-only orchestration boundary for the core decision and profit-realization
 * engines. This module does not execute trades or mutate portfolio data.
 */
import {
  DecisionEvaluationInput,
  DecisionEvaluationResult,
  evaluateDecisionRules,
} from './decisionEngine';
import {
  ProfitRealizationEngineInput,
  ProfitRealizationEngineResult,
  evaluateProfitRealization,
} from './profitRealizationEngine';
import { DecisionOutcome } from '../types/investment';

export interface InvestmentOrchestratorInput {
  evaluationId: string;
  /** Shared evaluation-date anchor, formatted as YYYY-MM-DD. */
  asOfDate: string;
  decisionInput: DecisionEvaluationInput;
  profitRealizationInput: ProfitRealizationEngineInput;
}

export interface ActualDecisionComparison {
  coreEngineDecision: DecisionOutcome;
  profitEngineAssessment: ProfitRealizationEngineResult['realizationAssessment'] | null;
  /** Null when the two result domains do not support a meaningful binary comparison. */
  isAligned: boolean | null;
  relationship: 'CORE_SELL_PREVAILS' | 'CORE_REDUCE_PREVAILS' | 'ADVISORY_ONLY' | 'CORE_EVIDENCE_INSUFFICIENT' | 'CORE_RESULT_UNAVAILABLE';
  /** Always true: this layer is advisory and cannot execute trades. */
  automatedTradeExecutionBlocked: true;
}

export interface InvestmentOrchestratorResult {
  evaluationId: string;
  asOfDate: string;
  /** Original core-engine result, unchanged. Null only if that evaluator threw or validation blocked evaluation. */
  coreDecision: DecisionEvaluationResult | null;
  /** Original profit-engine result, unchanged. Null only if that evaluator threw or validation blocked evaluation. */
  profitRealization: ProfitRealizationEngineResult | null;
  coordination: {
    primaryOutcome: DecisionOutcome | null;
    precedenceApplied: boolean;
    profitRealizationIsAdvisory: true;
    decisionComparison: ActualDecisionComparison | null;
    warnings: string[];
    errors: { engine: 'core' | 'profit' | 'orchestrator'; message: string }[];
    reviewRequired: boolean;
  };
}

export interface InvestmentOrchestratorEvaluators {
  evaluateCore: (input: DecisionEvaluationInput) => DecisionEvaluationResult;
  evaluateProfit: (input: ProfitRealizationEngineInput) => ProfitRealizationEngineResult;
}

const defaultEvaluators: InvestmentOrchestratorEvaluators = {
  evaluateCore: evaluateDecisionRules,
  evaluateProfit: evaluateProfitRealization,
};

const VALID_OUTCOMES = new Set<DecisionOutcome>([
  'HOLD', 'INCREASE', 'REDUCE', 'SELL', 'INSUFFICIENT_EVIDENCE',
]);

function isValidDateAnchor(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Evaluates both engines independently and coordinates their results without
 * rewriting either engine's result or converting recommendations into orders.
 *
 * A shared asOfDate is injected as the evaluation anchor. If either input
 * supplied a different anchor, the mismatch is disclosed and human review is
 * required. The legacy comparison embedded in the profit-engine result is
 * preserved verbatim; coordination.decisionComparison is the authoritative
 * comparison against the actual core-engine result.
 */
export function evaluateInvestmentOrchestration(
  input: InvestmentOrchestratorInput,
  evaluators: InvestmentOrchestratorEvaluators = defaultEvaluators,
): InvestmentOrchestratorResult {
  const warnings: string[] = [];
  const errors: InvestmentOrchestratorResult['coordination']['errors'] = [];
  let coreDecision: DecisionEvaluationResult | null = null;
  let profitRealization: ProfitRealizationEngineResult | null = null;

  if (!input.evaluationId.trim()) {
    return blockedResult(input, 'evaluationId must be a non-empty string.');
  }
  if (!isValidDateAnchor(input.asOfDate)) {
    return blockedResult(input, 'asOfDate must be a valid calendar date in YYYY-MM-DD format.');
  }

  const coreInputDate = input.decisionInput.asOfDate;
  const profitInputDate = input.profitRealizationInput.asOfDate;
  if (coreInputDate && coreInputDate !== input.asOfDate) {
    warnings.push(`Core input asOfDate (${coreInputDate}) differs from orchestration anchor (${input.asOfDate}); the shared anchor was applied.`);
  }
  if (profitInputDate && profitInputDate !== input.asOfDate) {
    warnings.push(`Profit input asOfDate (${profitInputDate}) differs from orchestration anchor (${input.asOfDate}); the shared anchor was applied.`);
  }

  if (input.decisionInput.executionMode && input.decisionInput.executionMode !== input.profitRealizationInput.executionMode) {
    warnings.push('Execution modes differ between engines; the combined assessment requires review and must not be treated as a fully comparable decision.');
  }

  // Independent calls intentionally prevent one engine's failure from erasing
  // the other engine's result.
  try {
    coreDecision = evaluators.evaluateCore({ ...input.decisionInput, asOfDate: input.asOfDate });
    if (!coreDecision || !VALID_OUTCOMES.has(coreDecision.outcome)) {
      throw new Error('Core evaluator returned an invalid or missing outcome.');
    }
  } catch (error) {
    errors.push({ engine: 'core', message: errorMessage(error) });
  }

  try {
    profitRealization = evaluators.evaluateProfit({ ...input.profitRealizationInput, asOfDate: input.asOfDate });
    if (!profitRealization) {
      throw new Error('Profit-realization evaluator returned no result.');
    }
  } catch (error) {
    errors.push({ engine: 'profit', message: errorMessage(error) });
  }

  if (coreDecision && profitRealization) {
    const legacyComparison = profitRealization.complianceContext.coreEngineDecisionComparison;
    if (legacyComparison.coreEngineDecision !== coreDecision.outcome) {
      warnings.push(
        `Legacy coreEngineDecisionComparison reports ${legacyComparison.coreEngineDecision}, but the actual core engine returned ${coreDecision.outcome}. The actual comparison in coordination.decisionComparison is authoritative.`,
      );
    }
  }

  const decisionComparison: ActualDecisionComparison | null = coreDecision
    ? {
        coreEngineDecision: coreDecision.outcome,
        profitEngineAssessment: profitRealization?.realizationAssessment ?? null,
        isAligned: getMeaningfulAlignment(coreDecision.outcome, profitRealization?.realizationAssessment),
        relationship: getDecisionRelationship(coreDecision.outcome, profitRealization?.realizationAssessment),
        automatedTradeExecutionBlocked: true,
      }
    : null;

  const primaryOutcome = coreDecision?.outcome ?? null;
  const precedenceApplied = primaryOutcome === 'SELL' || primaryOutcome === 'REDUCE';
  if (primaryOutcome === 'INSUFFICIENT_EVIDENCE') {
    warnings.push('Core engine returned INSUFFICIENT_EVIDENCE; the profit-realization result remains advisory and cannot substitute for missing core evidence.');
  }
  if (errors.length > 0) {
    warnings.push('At least one engine failed. The combined assessment is incomplete and requires review.');
  }
  if (!coreDecision || !profitRealization) {
    warnings.push('No complete combined assessment is available; no trade action is authorized.');
  }

  return {
    evaluationId: input.evaluationId,
    asOfDate: input.asOfDate,
    coreDecision,
    profitRealization,
    coordination: {
      primaryOutcome,
      precedenceApplied,
      profitRealizationIsAdvisory: true,
      decisionComparison,
      warnings,
      errors,
      reviewRequired: warnings.length > 0 || errors.length > 0 || !coreDecision || !profitRealization,
    },
  };
}


function getMeaningfulAlignment(
  core: DecisionOutcome,
  profit: ProfitRealizationEngineResult['realizationAssessment'] | undefined,
): boolean | null {
  if (!profit || core === 'SELL' || core === 'INSUFFICIENT_EVIDENCE' || profit === 'INSUFFICIENT_EVIDENCE') return null;
  if (core === 'REDUCE') return profit === 'YIELD_TO_RISK_REDUCTION';
  if (core === 'HOLD' || core === 'INCREASE') return profit === 'NO_ACTION';
  return null;
}

function getDecisionRelationship(
  core: DecisionOutcome,
  profit: ProfitRealizationEngineResult['realizationAssessment'] | undefined,
): ActualDecisionComparison['relationship'] {
  if (core === 'SELL') return 'CORE_SELL_PREVAILS';
  if (core === 'REDUCE') return 'CORE_REDUCE_PREVAILS';
  if (core === 'INSUFFICIENT_EVIDENCE' || profit === 'INSUFFICIENT_EVIDENCE') return 'CORE_EVIDENCE_INSUFFICIENT';
  return 'ADVISORY_ONLY';
}

function blockedResult(input: InvestmentOrchestratorInput, message: string): InvestmentOrchestratorResult {
  return {
    evaluationId: input.evaluationId,
    asOfDate: input.asOfDate,
    coreDecision: null,
    profitRealization: null,
    coordination: {
      primaryOutcome: null,
      precedenceApplied: false,
      profitRealizationIsAdvisory: true,
      decisionComparison: null,
      warnings: [message, 'Evaluation was blocked before either engine ran; no trade action is authorized.'],
      errors: [{ engine: 'orchestrator', message }],
      reviewRequired: true,
    },
  };
}
