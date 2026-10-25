/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateInvestmentOrchestration,
  InvestmentOrchestratorEvaluators,
  InvestmentOrchestratorInput,
} from './investmentOrchestrator';
import { DecisionEvaluationInput, DecisionEvaluationResult } from './decisionEngine';
import { ProfitRealizationEngineInput, ProfitRealizationEngineResult } from './profitRealizationEngine';

const asDecisionResult = (outcome: DecisionEvaluationResult['outcome']): DecisionEvaluationResult => ({
  outcome,
  primaryRationale: `Synthetic ${outcome} fixture`,
  appliedRules: [],
  violationsPrevented: [],
  recommendedAction: outcome,
  isSimulatedDraft: true,
});

const asProfitResult = (
  assessment: ProfitRealizationEngineResult['realizationAssessment'] = 'NO_ACTION',
  legacyDecision: ProfitRealizationEngineResult['complianceContext']['coreEngineDecisionComparison']['coreEngineDecision'] = 'HOLD',
): ProfitRealizationEngineResult => ({
  realizationAssessment: assessment,
  realizationRationale: 'Synthetic orchestration fixture',
  suggestedAmount: {
    amountType: 'NO_SALE',
    suggestedProportionOfHolding: 0,
    suggestedGrossCapitalValue: 0,
    currency: 'USD',
    frictionBreakdown: null,
    calculationFormula: 'fixture',
    derivationSteps: [],
    limitations: [],
  },
  reinvestmentAssessment: {
    action: 'HOLD_AS_CASH',
    selectedCandidateId: null,
    selectedCandidateName: null,
    allocatedNetProceedsCurrency: 0,
    unallocatedNetProceedsToCash: 0,
    currency: 'USD',
    rationale: 'fixture',
    candidateEvaluations: [],
  },
  unallocatedCapitalOpportunities: [],
  complianceContext: {
    isHardLimitBreached: false,
    governingHardCeiling: null,
    governingLimitType: 'none',
    isHoldingInProfit: true,
    unrealizedGainCurrency: 100,
    coreEngineDecisionComparison: {
      coreEngineDecision: legacyDecision,
      profitEngineAssessment: assessment,
      isAligned: legacyDecision === assessment,
      boundaryNote: 'Legacy fixture comparison',
      automatedTradeExecutionBlocked: true,
    },
  },
  appliedDecisionRules: [],
  violationsPrevented: [],
  frictionAnalysisDisclosures: [],
  isSimulatedDraft: true,
});

const baseInput = (): InvestmentOrchestratorInput => ({
  evaluationId: 'SYN-ORCH-001',
  asOfDate: '2026-10-22',
  decisionInput: {
    holdingName: 'Synthetic Holding',
    executionMode: 'synthetic_simulation',
    thesisStatus: 'intact',
    evidenceQuality: 'verified_fresh',
    priceDrawdownPercent: -5,
    allocationDriftPercent: 1,
    asOfDate: '2026-10-22',
  } as DecisionEvaluationInput,
  profitRealizationInput: {
    executionMode: 'synthetic_simulation',
    holdingId: 'SYN-1',
    holdingName: 'Synthetic Holding',
    assetCategory: 'equity',
    currentMarketValue: 1000,
    costBasisTotal: 800,
    portfolioTotalValue: 10000,
    currentAllocationPercent: 10,
    limitHierarchy: {
      strategicTarget: 8,
      toleranceCeiling: 10,
      userHardCeiling: 12,
      userHardCeilingStatus: 'configured',
      externalCeilingStatus: 'not_applicable',
      effectiveHardCeiling: 12,
      measurementBasis: 'percent_of_nav',
    },
    thesisStatus: 'intact',
    evidenceQuality: 'verified_fresh',
    asOfDate: '2026-10-22',
  } as ProfitRealizationEngineInput,
});

const evaluatorsFor = (
  coreOutcome: DecisionEvaluationResult['outcome'],
  profitAssessment: ProfitRealizationEngineResult['realizationAssessment'] = 'NO_ACTION',
  legacyDecision: ProfitRealizationEngineResult['complianceContext']['coreEngineDecisionComparison']['coreEngineDecision'] = 'HOLD',
): InvestmentOrchestratorEvaluators => ({
  evaluateCore: () => asDecisionResult(coreOutcome),
  evaluateProfit: () => asProfitResult(profitAssessment, legacyDecision),
});

describe('Investment Orchestrator — synthetic acceptance tests', () => {
  test('INT-01: core SELL remains primary when profit engine says NO_ACTION', () => {
    const result = evaluateInvestmentOrchestration(baseInput(), evaluatorsFor('SELL', 'NO_ACTION', 'HOLD'));
    assert.equal(result.coordination.primaryOutcome, 'SELL');
    assert.equal(result.coordination.precedenceApplied, true);
    assert.equal(result.coreDecision?.outcome, 'SELL');
    assert.equal(result.profitRealization?.realizationAssessment, 'NO_ACTION');
    assert.equal(result.coordination.decisionComparison?.coreEngineDecision, 'SELL');
    assert.ok(result.coordination.warnings.some(w => w.includes('Legacy coreEngineDecisionComparison')));
  });

  test('INT-02: core REDUCE is preserved; suggested realization is not merged into its amount', () => {
    const result = evaluateInvestmentOrchestration(baseInput(), evaluatorsFor('REDUCE', 'CONSIDER_PARTIAL_REALIZATION'));
    assert.equal(result.coordination.primaryOutcome, 'REDUCE');
    assert.equal(result.coordination.precedenceApplied, true);
    assert.equal(result.profitRealization?.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION');
  });

  test('INT-03: HOLD and optional realization are reported separately', () => {
    const result = evaluateInvestmentOrchestration(baseInput(), evaluatorsFor('HOLD', 'CONSIDER_PARTIAL_REALIZATION'));
    assert.equal(result.coordination.primaryOutcome, 'HOLD');
    assert.equal(result.coordination.precedenceApplied, false);
    assert.equal(result.coordination.decisionComparison?.isAligned, false);
    assert.equal(result.coordination.decisionComparison?.relationship, 'ADVISORY_ONLY');
  });

  test('INT-04: core INCREASE is not overridden by profit NO_ACTION', () => {
    const result = evaluateInvestmentOrchestration(baseInput(), evaluatorsFor('INCREASE', 'NO_ACTION'));
    assert.equal(result.coordination.primaryOutcome, 'INCREASE');
    assert.equal(result.coreDecision?.outcome, 'INCREASE');
  });

  test('INT-05: core INSUFFICIENT_EVIDENCE stays primary and requires review', () => {
    const result = evaluateInvestmentOrchestration(baseInput(), evaluatorsFor('INSUFFICIENT_EVIDENCE', 'CONSIDER_PARTIAL_REALIZATION'));
    assert.equal(result.coordination.primaryOutcome, 'INSUFFICIENT_EVIDENCE');
    assert.equal(result.coordination.reviewRequired, true);
    assert.ok(result.coordination.warnings.some(w => w.includes('cannot substitute')));
  });

  test('INT-06: profit evaluator failure does not erase core result', () => {
    const evaluators = evaluatorsFor('SELL');
    evaluators.evaluateProfit = () => { throw new Error('synthetic profit failure'); };
    const result = evaluateInvestmentOrchestration(baseInput(), evaluators);
    assert.equal(result.coreDecision?.outcome, 'SELL');
    assert.equal(result.profitRealization, null);
    assert.equal(result.coordination.errors[0]?.engine, 'profit');
    assert.equal(result.coordination.reviewRequired, true);
  });

  test('INT-07: core evaluator failure preserves profit result but marks combined result incomplete', () => {
    const evaluators = evaluatorsFor('HOLD');
    evaluators.evaluateCore = () => { throw new Error('synthetic core failure'); };
    const result = evaluateInvestmentOrchestration(baseInput(), evaluators);
    assert.equal(result.coreDecision, null);
    assert.ok(result.profitRealization);
    assert.equal(result.coordination.primaryOutcome, null);
    assert.equal(result.coordination.reviewRequired, true);
  });

  test('INT-08: input date mismatch is disclosed and a shared anchor is applied', () => {
    const input = baseInput();
    input.decisionInput.asOfDate = '2026-10-20';
    let receivedCoreDate = '';
    let receivedProfitDate = '';
    const evaluators = evaluatorsFor('HOLD');
    evaluators.evaluateCore = (value) => { receivedCoreDate = value.asOfDate ?? ''; return asDecisionResult('HOLD'); };
    evaluators.evaluateProfit = (value) => { receivedProfitDate = value.asOfDate ?? ''; return asProfitResult(); };
    const result = evaluateInvestmentOrchestration(input, evaluators);
    assert.equal(receivedCoreDate, '2026-10-22');
    assert.equal(receivedProfitDate, '2026-10-22');
    assert.equal(result.coordination.reviewRequired, true);
    assert.ok(result.coordination.warnings.some(w => w.includes('Core input asOfDate')));
  });

  test('INT-09: execution-mode mismatch is disclosed and requires review', () => {
    const input = baseInput();
    input.profitRealizationInput.executionMode = 'real_decision';
    const result = evaluateInvestmentOrchestration(input, evaluatorsFor('HOLD'));
    assert.equal(result.coordination.reviewRequired, true);
    assert.ok(result.coordination.warnings.some(w => w.includes('Execution modes differ')));
  });

  test('INT-10: actual core result comparison is authoritative; legacy comparison is preserved verbatim', () => {
    const result = evaluateInvestmentOrchestration(baseInput(), evaluatorsFor('REDUCE', 'NO_ACTION', 'HOLD'));
    assert.equal(result.profitRealization?.complianceContext.coreEngineDecisionComparison.coreEngineDecision, 'HOLD');
    assert.equal(result.coordination.decisionComparison?.coreEngineDecision, 'REDUCE');
    assert.equal(result.coordination.decisionComparison?.automatedTradeExecutionBlocked, true);
  });

  test('invalid date anchor blocks both engines before evaluation', () => {
    const input = baseInput();
    input.asOfDate = '2026-02-30';
    let calls = 0;
    const evaluators: InvestmentOrchestratorEvaluators = {
      evaluateCore: () => { calls++; return asDecisionResult('HOLD'); },
      evaluateProfit: () => { calls++; return asProfitResult(); },
    };
    const result = evaluateInvestmentOrchestration(input, evaluators);
    assert.equal(calls, 0);
    assert.equal(result.coreDecision, null);
    assert.equal(result.profitRealization, null);
    assert.equal(result.coordination.errors[0]?.engine, 'orchestrator');
  });

  test('empty evaluation id blocks both engines before evaluation', () => {
    const input = baseInput();
    input.evaluationId = '  ';
    let calls = 0;
    const evaluators: InvestmentOrchestratorEvaluators = {
      evaluateCore: () => { calls++; return asDecisionResult('HOLD'); },
      evaluateProfit: () => { calls++; return asProfitResult(); },
    };
    const result = evaluateInvestmentOrchestration(input, evaluators);
    assert.equal(calls, 0);
    assert.equal(result.coordination.reviewRequired, true);
  });
});
