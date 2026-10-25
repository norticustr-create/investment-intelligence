/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  evaluateProfitRealization,
  resolveEffectiveHardCeiling,
  calculateFrictionBreakdown,
  calculateGrossTrimAmount,
  computeDaysElapsed,
  validateDateFreshness,
  evaluateReinvestmentProceeds,
  ProfitRealizationEngineInput,
  ReinvestmentCandidateEvaluation
} from './profitRealizationEngine';
import { EvidenceFinding } from '../types/investment';

describe('Profit Realization & Reinvestment Engine — Test Suite', () => {

  /* =========================================================================
     1. All Eight Allocation-Limit Examples (Section 2.5)
     ========================================================================= */

  describe('Section 2.5: Allocation-Limit Hierarchy Examples', () => {
    test('Example 1: Discretionary Rebalance Within User Policy (Fair valuation produces NO_ACTION)', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'HOLD-EX-01',
        holdingName: 'Example Holding 1',
        assetCategory: 'equity',
        currentMarketValue: 90000,
        costBasisTotal: 50000,
        portfolioTotalValue: 1000000,
        currentAllocationPercent: 9.0,
        limitHierarchy: {
          strategicTarget: 6.0,
          toleranceCeiling: 8.0,
          userHardCeiling: 10.0,
          userHardCeilingStatus: 'configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: 10.0,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        valuationFavorable: null, // Fair/neutral valuation
        valuationAssessmentTimestamp: '2026-09-15',
        asOfDate: '2026-10-22'
      };

      const result = evaluateProfitRealization(input);
      assert.strictEqual(result.realizationAssessment, 'NO_ACTION');
      assert.strictEqual(result.suggestedAmount.amountType, 'NO_SALE');
      assert.strictEqual(result.suggestedAmount.suggestedGrossCapitalValue, 0);
    });

    test('Example 1B: Discretionary Rebalance Within User Policy (Extended valuation triggers trim to tolerance ceiling)', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'HOLD-EX-01B',
        holdingName: 'Example Holding 1B',
        assetCategory: 'equity',
        currentMarketValue: 90000,
        costBasisTotal: 50000,
        portfolioTotalValue: 1000000,
        currentAllocationPercent: 9.0,
        limitHierarchy: {
          strategicTarget: 6.0,
          toleranceCeiling: 8.0,
          userHardCeiling: 10.0,
          userHardCeilingStatus: 'configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: 10.0,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        valuationFavorable: false, // Extended valuation multiples
        valuationAssessmentTimestamp: '2026-09-15',
        asOfDate: '2026-10-22'
      };

      const result = evaluateProfitRealization(input);
      assert.strictEqual(result.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION');
      assert.strictEqual(result.suggestedAmount.amountType, 'TRIM_TO_UPPER_TOLERANCE_BAND');
      // Excess over tolerance ceiling: 9.0% - 8.0% = 1.0% of $1,000,000 = $10,000
      assert.strictEqual(result.suggestedAmount.suggestedGrossCapitalValue, 10000);
      assert.ok(result.suggestedAmount.frictionBreakdown !== null);
      assert.strictEqual(result.complianceContext.isHardLimitBreached, false);
    });

    test('Example 2: Verified External Ceiling Supersedes User Policy & Tolerance', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'HOLD-EX-02',
        holdingName: 'Example Holding 2',
        assetCategory: 'equity',
        currentMarketValue: 70000,
        costBasisTotal: 40000,
        portfolioTotalValue: 1000000,
        currentAllocationPercent: 7.0,
        limitHierarchy: {
          strategicTarget: 6.0,
          toleranceCeiling: 8.0,
          userHardCeiling: 10.0,
          userHardCeilingStatus: 'configured',
          verifiedExternalCeiling: {
            ceilingPercent: 5.0,
            sourceAuthority: 'UCITS Directive Art. 52',
            jurisdiction: 'EU / ESMA',
            scope: 'Single-issuer equity cap',
            verificationStatus: 'verified_primary',
            measurementBasis: 'percent_of_nav',
            isApplicabilityEstablished: true
          },
          externalCeilingStatus: 'verified_applicable',
          effectiveHardCeiling: 5.0,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        asOfDate: '2026-10-22'
      };

      const result = evaluateProfitRealization(input);
      assert.strictEqual(result.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION');
      assert.strictEqual(result.suggestedAmount.amountType, 'TRIM_TO_EFFECTIVE_HARD_CEILING');
      // Trim to effectiveHardCeiling (5.0%): 7.0% - 5.0% = 2.0% of $1,000,000 = $20,000
      assert.strictEqual(result.suggestedAmount.suggestedGrossCapitalValue, 20000);
      assert.strictEqual(result.complianceContext.governingHardCeiling, 5.0);
      assert.strictEqual(result.complianceContext.governingLimitType, 'statutory_regulatory');
    });

    test('Example 3: Alleged External Ceiling with Unverified Applicability', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'HOLD-EX-03',
        holdingName: 'Example Holding 3',
        assetCategory: 'equity',
        currentMarketValue: 70000,
        costBasisTotal: 50000,
        portfolioTotalValue: 1000000,
        currentAllocationPercent: 7.0,
        limitHierarchy: {
          strategicTarget: 6.0,
          toleranceCeiling: 8.0,
          userHardCeiling: 10.0,
          userHardCeilingStatus: 'configured',
          verifiedExternalCeiling: {
            ceilingPercent: 5.0,
            sourceAuthority: 'Unverified blog rumor',
            jurisdiction: 'Unknown',
            scope: 'Alleged cap',
            verificationStatus: 'unverified_third_party',
            measurementBasis: 'percent_of_nav',
            isApplicabilityEstablished: false
          },
          externalCeilingStatus: 'unverified',
          effectiveHardCeiling: null,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        asOfDate: '2026-10-22'
      };

      const result = evaluateProfitRealization(input);
      // Because current allocation 7% exceeds the alleged 5% cap, uncertainty is material -> INSUFFICIENT_EVIDENCE
      assert.strictEqual(result.realizationAssessment, 'INSUFFICIENT_EVIDENCE');
      assert.strictEqual(result.suggestedAmount.amountType, 'INSUFFICIENT_EVIDENCE');
    });

    test('Example 4: Multiple Verified External Hard Ceilings on Same Basis', () => {
      const res = resolveEffectiveHardCeiling({
        strategicTarget: 4.0,
        userHardCeiling: 10.0,
        userHardCeilingStatus: 'configured',
        verifiedExternalCeiling: {
          ceilingPercent: 5.0,
          sourceAuthority: 'National Regulatory Ceiling',
          jurisdiction: 'National Authority',
          scope: 'Fund ceiling',
          verificationStatus: 'verified_primary',
          measurementBasis: 'percent_of_nav',
          isApplicabilityEstablished: true
        },
        externalCeilingStatus: 'verified_applicable',
        effectiveHardCeiling: null,
        measurementBasis: 'percent_of_nav'
      });

      assert.strictEqual(res.effectiveHardCeiling, 5.0);
      assert.strictEqual(res.isMateriallyUncertain, false);
      assert.strictEqual(res.governingLimitType, 'statutory_regulatory');
    });

    test('Example 5: Incomparable or Conflicting Constraints Fail Conservatively', () => {
      const res = resolveEffectiveHardCeiling({
        strategicTarget: 4.0,
        userHardCeiling: 10.0,
        userHardCeilingStatus: 'configured',
        verifiedExternalCeiling: {
          ceilingPercent: 15.0,
          sourceAuthority: 'Float Cap Directive',
          jurisdiction: 'External',
          scope: 'Float limit',
          verificationStatus: 'verified_primary',
          measurementBasis: 'percent_of_free_float_excluding_restricted', // Incomparable basis!
          isApplicabilityEstablished: true
        },
        externalCeilingStatus: 'verified_applicable',
        effectiveHardCeiling: null,
        measurementBasis: 'percent_of_nav'
      });

      assert.strictEqual(res.effectiveHardCeiling, null);
      assert.strictEqual(res.isIncomparable, true);
      assert.strictEqual(res.isMateriallyUncertain, true);
    });

    test('Example 6: Verified Hard Breach with Zero Unrealized Profit (Risk Reduction vs Profit Realization)', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'HOLD-EX-06',
        holdingName: 'Speculative Tech Notes (STN)',
        assetCategory: 'equity',
        currentMarketValue: 130000,
        costBasisTotal: 150000, // Unrealized loss: -$20,000
        portfolioTotalValue: 1000000,
        currentAllocationPercent: 13.0,
        limitHierarchy: {
          strategicTarget: 5.0,
          toleranceCeiling: 7.0,
          userHardCeiling: 10.0,
          userHardCeilingStatus: 'configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: 10.0,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        asOfDate: '2026-10-22'
      };

      const result = evaluateProfitRealization(input);
      // Must NOT be labeled as profit taking; yields to core engine REDUCE
      assert.strictEqual(result.realizationAssessment, 'YIELD_TO_RISK_REDUCTION');
      assert.strictEqual(result.suggestedAmount.amountType, 'NO_SALE');
      assert.strictEqual(result.suggestedAmount.suggestedGrossCapitalValue, 0);
      assert.strictEqual(result.complianceContext.isHoldingInProfit, false);
      assert.strictEqual(result.complianceContext.coreEngineDecisionComparison.coreEngineDecision, 'REDUCE');
      assert.strictEqual(result.complianceContext.coreEngineDecisionComparison.profitEngineAssessment, 'YIELD_TO_RISK_REDUCTION');
    });

    test('Example 7: Absent Limits in Discretionary Rebalance (Clean Pass Without INSUFFICIENT_EVIDENCE)', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'HOLD-EX-07',
        holdingName: 'US Blue Chip Tech (BCT)',
        assetCategory: 'equity',
        currentMarketValue: 135000,
        costBasisTotal: 60000, // +$75,000 profit
        portfolioTotalValue: 1000000,
        currentAllocationPercent: 13.5,
        limitHierarchy: {
          strategicTarget: 8.0,
          toleranceCeiling: 10.5,
          userHardCeilingStatus: 'not_configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: null, // Validly absent
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        valuationFavorable: false, // Extended multiples
        valuationAssessmentTimestamp: '2026-09-15',
        asOfDate: '2026-10-22'
      };

      const result = evaluateProfitRealization(input);
      // Validly absent hard limit does NOT trigger INSUFFICIENT_EVIDENCE
      assert.strictEqual(result.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION');
      assert.strictEqual(result.suggestedAmount.amountType, 'TRIM_TO_UPPER_TOLERANCE_BAND');
      // Trim to tolerance ceiling (10.5%): 13.5% - 10.5% = 3.0% of $1,000,000 = $30,000
      assert.strictEqual(result.suggestedAmount.suggestedGrossCapitalValue, 30000);
      assert.strictEqual(result.complianceContext.governingHardCeiling, null);
    });

    test('Example 8: Materially Uncertain / Conflicting External Limit Fails Closed', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'HOLD-EX-08',
        holdingName: 'Emerging Market Infrastructure (EMI)',
        assetCategory: 'equity',
        currentMarketValue: 75000,
        costBasisTotal: 40000,
        portfolioTotalValue: 1000000,
        currentAllocationPercent: 7.5,
        limitHierarchy: {
          strategicTarget: 5.0,
          toleranceCeiling: 8.0,
          userHardCeilingStatus: 'not_configured',
          verifiedExternalCeiling: {
            ceilingPercent: 6.0,
            sourceAuthority: 'Unverified newsletter claim',
            jurisdiction: 'Foreign',
            scope: 'Statutory cap',
            verificationStatus: 'unverified_third_party',
            measurementBasis: 'percent_of_nav',
            isApplicabilityEstablished: false
          },
          externalCeilingStatus: 'unverified',
          effectiveHardCeiling: null,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        asOfDate: '2026-10-22'
      };

      const result = evaluateProfitRealization(input);
      // Holding is 7.5%, which breaches alleged 6.0% limit -> Material uncertainty -> INSUFFICIENT_EVIDENCE
      assert.strictEqual(result.realizationAssessment, 'INSUFFICIENT_EVIDENCE');
      assert.strictEqual(result.suggestedAmount.amountType, 'INSUFFICIENT_EVIDENCE');
    });
  });

  /* =========================================================================
     2. All 16 Synthetic Scenarios from Section 8
     ========================================================================= */

  describe('Section 8: 16-Scenario Matrix Audit', () => {
    test('Scenario 1: Large Unrealized Profit, Allocation at Target (AAPL) -> NO_ACTION', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'PR-SCEN-01',
        holdingName: 'Apple Inc. (AAPL)',
        assetCategory: 'equity',
        currentMarketValue: 120000,
        costBasisTotal: 50000,
        portfolioTotalValue: 1200000,
        currentAllocationPercent: 10.0,
        limitHierarchy: {
          strategicTarget: 10.0,
          toleranceCeiling: 12.5,
          userHardCeilingStatus: 'not_configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: null,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        valuationFavorable: true,
        valuationAssessmentTimestamp: '2026-08-20',
        asOfDate: '2026-10-22'
      };

      const res = evaluateProfitRealization(input);
      assert.strictEqual(res.realizationAssessment, 'NO_ACTION');
      assert.strictEqual(res.suggestedAmount.amountType, 'NO_SALE');
      assert.strictEqual(res.reinvestmentAssessment.action, 'HOLD_AS_CASH');
    });

    test('Scenario 2: Small Unrealized Profit, Overweight ETF (VOO) -> NO_ACTION', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'PR-SCEN-02',
        holdingName: 'Vanguard S&P 500 ETF (VOO)',
        assetCategory: 'etf',
        currentMarketValue: 103200,
        costBasisTotal: 100000,
        portfolioTotalValue: 500000,
        currentAllocationPercent: 20.64,
        limitHierarchy: {
          strategicTarget: 12.0,
          toleranceCeiling: 14.0,
          userHardCeilingStatus: 'not_configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: null,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        valuationFavorable: null, // Neutral valuation
        valuationAssessmentTimestamp: '2026-09-15',
        asOfDate: '2026-10-22'
      };

      const res = evaluateProfitRealization(input);
      assert.strictEqual(res.realizationAssessment, 'NO_ACTION');
      assert.strictEqual(res.suggestedAmount.amountType, 'NO_SALE');
    });

    test('Scenario 3: Large Profit and Overweight, Missing Valuation Evidence (NVDA) -> INSUFFICIENT_EVIDENCE', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'PR-SCEN-03',
        holdingName: 'Nvidia Corporation (NVDA)',
        assetCategory: 'equity',
        currentMarketValue: 210000,
        costBasisTotal: 50000,
        portfolioTotalValue: 1000000,
        currentAllocationPercent: 21.0,
        limitHierarchy: {
          strategicTarget: 10.0,
          toleranceCeiling: 12.5,
          userHardCeilingStatus: 'not_configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: null,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        valuationFavorable: undefined, // Missing valuation
        asOfDate: '2026-10-22'
      };

      const res = evaluateProfitRealization(input);
      assert.strictEqual(res.realizationAssessment, 'INSUFFICIENT_EVIDENCE');
      assert.strictEqual(res.suggestedAmount.amountType, 'INSUFFICIENT_EVIDENCE');
    });

    test('Scenario 4: Large Profit, Overweight, Fresh Extended Valuation (MSFT) -> CONSIDER_PARTIAL_REALIZATION', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'PR-SCEN-04',
        holdingName: 'Microsoft Corporation (MSFT)',
        assetCategory: 'equity',
        currentMarketValue: 140000,
        costBasisTotal: 50000,
        portfolioTotalValue: 1000000,
        currentAllocationPercent: 14.0,
        limitHierarchy: {
          strategicTarget: 8.0,
          toleranceCeiling: 10.5,
          userHardCeilingStatus: 'not_configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: null,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        valuationFavorable: false,
        valuationAssessmentTimestamp: '2026-08-20',
        costModel: {
          capitalGainsTaxRateEstimate: 0.20,
          transactionFeeEstimateRate: 0.0010,
          estimatedSpreadRate: 0.0015,
          currency: 'USD',
          maxAllowableFrictionDragRatio: 0.35
        },
        asOfDate: '2026-10-22'
      };

      const res = evaluateProfitRealization(input);
      assert.strictEqual(res.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION');
      assert.strictEqual(res.suggestedAmount.amountType, 'TRIM_TO_UPPER_TOLERANCE_BAND');
      assert.strictEqual(res.suggestedAmount.suggestedGrossCapitalValue, 35000);
      assert.strictEqual(res.suggestedAmount.frictionBreakdown?.grossRealizedCapitalGain, 22500);
      assert.strictEqual(res.suggestedAmount.frictionBreakdown?.estimatedCapitalGainsTax, 4500);
      assert.strictEqual(res.suggestedAmount.frictionBreakdown?.estimatedNetProceeds, 30412.50);
      assert.strictEqual(res.reinvestmentAssessment.action, 'HOLD_AS_CASH');
    });

    test('Scenario 5: Overweight with Materially Invalidated Thesis (SEDG) -> Yields to Core Rule 5 SELL', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'PR-SCEN-05',
        holdingName: 'SolarEdge Technologies (SEDG)',
        assetCategory: 'equity',
        currentMarketValue: 57500,
        costBasisTotal: 50000,
        portfolioTotalValue: 500000,
        currentAllocationPercent: 11.5,
        limitHierarchy: {
          strategicTarget: 6.0,
          toleranceCeiling: 8.5,
          userHardCeilingStatus: 'not_configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: null,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'materially_invalidated',
        evidenceQuality: 'verified_fresh',
        asOfDate: '2026-10-22'
      };

      const res = evaluateProfitRealization(input);
      assert.strictEqual(res.realizationAssessment, 'INSUFFICIENT_EVIDENCE');
      assert.strictEqual(res.suggestedAmount.amountType, 'NO_SALE');
      assert.strictEqual(res.complianceContext.coreEngineDecisionComparison.coreEngineDecision, 'SELL');
    });

    test('Scenario 6: Profitable with User-Configured Hard Policy Breach (BTC) -> TRIM_TO_EFFECTIVE_HARD_CEILING', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'PR-SCEN-06',
        holdingName: 'Bitcoin (BTC)',
        assetCategory: 'bitcoin',
        currentMarketValue: 155000,
        costBasisTotal: 50000,
        portfolioTotalValue: 1000000,
        currentAllocationPercent: 15.5,
        limitHierarchy: {
          strategicTarget: 5.0,
          toleranceCeiling: 9.0,
          userHardCeiling: 10.0,
          userHardCeilingStatus: 'configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: 10.0,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        costModel: {
          capitalGainsTaxRateEstimate: 0.20,
          transactionFeeEstimateRate: 0.0010,
          estimatedSpreadRate: 0.0020,
          currency: 'USD'
        },
        asOfDate: '2026-10-22'
      };

      const res = evaluateProfitRealization(input);
      assert.strictEqual(res.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION');
      assert.strictEqual(res.suggestedAmount.amountType, 'TRIM_TO_EFFECTIVE_HARD_CEILING');
      // Trim excess over 10.0%: 15.5% - 10.0% = 5.5% of $1,000,000 = $55,000
      assert.strictEqual(res.suggestedAmount.suggestedGrossCapitalValue, 55000);
      assert.strictEqual(res.complianceContext.isHardLimitBreached, true);
      assert.strictEqual(res.complianceContext.governingLimitType, 'user_portfolio_policy');
    });

    test('Scenario 7: Profitable with Conflicting Evidence (TGH.IS) -> INSUFFICIENT_EVIDENCE', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'PR-SCEN-07',
        holdingName: 'Turkish Growth Holding (TGH.IS)',
        assetCategory: 'turkish_equity',
        currentMarketValue: 110000,
        costBasisTotal: 60000,
        portfolioTotalValue: 1000000,
        currentAllocationPercent: 11.0,
        limitHierarchy: {
          strategicTarget: 6.0,
          toleranceCeiling: 9.0,
          userHardCeilingStatus: 'not_configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: null,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'conflicting',
        asOfDate: '2026-10-22'
      };

      const res = evaluateProfitRealization(input);
      assert.strictEqual(res.realizationAssessment, 'INSUFFICIENT_EVIDENCE');
    });

    test('Scenario 8: Profitable but Underweight Position (GOOGL) -> NO_ACTION', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'PR-SCEN-08',
        holdingName: 'Alphabet Inc. (GOOGL)',
        assetCategory: 'equity',
        currentMarketValue: 78000,
        costBasisTotal: 40000,
        portfolioTotalValue: 1200000,
        currentAllocationPercent: 6.5,
        limitHierarchy: {
          strategicTarget: 8.0,
          toleranceCeiling: 10.5,
          userHardCeilingStatus: 'not_configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: null,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        valuationFavorable: true,
        asOfDate: '2026-10-22'
      };

      const res = evaluateProfitRealization(input);
      assert.strictEqual(res.realizationAssessment, 'NO_ACTION');
      assert.strictEqual(res.suggestedAmount.amountType, 'NO_SALE');
    });

    test('Scenario 9: Friction Hurdle Rejection (MIC, 60.33% drag > 35%) -> NO_ACTION', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'PR-SCEN-09',
        holdingName: 'Mid-Cap Industrial Corp (MIC)',
        assetCategory: 'equity',
        currentMarketValue: 22400,
        costBasisTotal: 20000,
        portfolioTotalValue: 200000,
        currentAllocationPercent: 11.2,
        limitHierarchy: {
          strategicTarget: 8.0,
          toleranceCeiling: 10.0,
          userHardCeilingStatus: 'not_configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: null,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        valuationFavorable: false,
        valuationAssessmentTimestamp: '2026-08-20',
        costModel: {
          capitalGainsTaxRateEstimate: 0.37,
          transactionFeeEstimateRate: 0.010,
          estimatedSpreadRate: 0.015, // Combined 2.5% transaction cost
          maxAllowableFrictionDragRatio: 0.35,
          currency: 'USD'
        },
        asOfDate: '2026-10-22'
      };

      const res = evaluateProfitRealization(input);
      assert.strictEqual(res.realizationAssessment, 'NO_ACTION');
      assert.strictEqual(res.suggestedAmount.amountType, 'NO_SALE');
      assert.ok(res.realizationRationale.includes('Friction Gate Rejected'));
    });

    test('Scenario 10: Strong Reinvestment Candidate but Target Holding at Balance (JNJ / ASML)', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'PR-SCEN-10',
        holdingName: 'Johnson & Johnson (JNJ)',
        assetCategory: 'equity',
        currentMarketValue: 70000,
        costBasisTotal: 50000,
        portfolioTotalValue: 1000000,
        currentAllocationPercent: 7.0,
        limitHierarchy: {
          strategicTarget: 7.0,
          toleranceCeiling: 9.0,
          userHardCeilingStatus: 'not_configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: null,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        valuationFavorable: null, // Fair
        reinvestmentCandidates: [{
          candidateId: 'CAND-ASML',
          holdingName: 'ASML Holding (ASML)',
          assetCategory: 'equity',
          currentAllocationPercent: 2.0,
          targetAllocationPercent: 6.0,
          thesisStatus: 'intact',
          valuationFavorable: true,
          valuationAssessmentTimestamp: '2026-08-20',
          valuationMetricsCount: 3,
          evidenceQuality: 'verified_fresh'
        }],
        asOfDate: '2026-10-22'
      };

      const res = evaluateProfitRealization(input);
      assert.strictEqual(res.realizationAssessment, 'NO_ACTION');
      assert.strictEqual(res.suggestedAmount.amountType, 'NO_SALE');
      assert.strictEqual(res.reinvestmentAssessment.allocatedNetProceedsCurrency, 0);
      // Independent opportunity identified for new cash:
      assert.strictEqual(res.unallocatedCapitalOpportunities.length, 1);
      assert.strictEqual(res.unallocatedCapitalOpportunities[0].candidateId, 'CAND-ASML');
      assert.strictEqual(res.unallocatedCapitalOpportunities[0].allocationDeficitCurrency, 40000);
    });

    test('Scenario 11: Justified Realization but All Candidates Disqualified (MSC) -> HOLD_AS_CASH', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'PR-SCEN-11',
        holdingName: 'Mega Semiconductor Corp (MSC)',
        assetCategory: 'equity',
        currentMarketValue: 175000,
        costBasisTotal: 50000,
        portfolioTotalValue: 1000000,
        currentAllocationPercent: 17.5,
        limitHierarchy: {
          strategicTarget: 8.0,
          toleranceCeiling: 10.5,
          userHardCeilingStatus: 'not_configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: null,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        valuationFavorable: false,
        valuationAssessmentTimestamp: '2026-08-15',
        costModel: {
          capitalGainsTaxRateEstimate: 0.20,
          transactionFeeEstimateRate: 0.0010,
          estimatedSpreadRate: 0.0015,
          currency: 'USD'
        },
        reinvestmentCandidates: [
          {
            candidateId: 'CAND-SCI',
            holdingName: 'SCI Corp',
            assetCategory: 'equity',
            currentAllocationPercent: 2.0,
            targetAllocationPercent: 5.0,
            thesisStatus: 'questionable', // Disqualified
            valuationFavorable: true,
            valuationMetricsCount: 2,
            evidenceQuality: 'verified_fresh'
          },
          {
            candidateId: 'CAND-XLE',
            holdingName: 'Energy ETF (XLE)',
            assetCategory: 'etf',
            currentAllocationPercent: 3.0,
            targetAllocationPercent: 6.0,
            thesisStatus: 'intact',
            valuationFavorable: false, // Disqualified (not favorable)
            valuationMetricsCount: 2,
            evidenceQuality: 'verified_fresh'
          }
        ],
        asOfDate: '2026-10-22'
      };

      const res = evaluateProfitRealization(input);
      assert.strictEqual(res.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION');
      assert.strictEqual(res.reinvestmentAssessment.action, 'HOLD_AS_CASH');
      assert.strictEqual(res.reinvestmentAssessment.allocatedNetProceedsCurrency, 0);
      assert.strictEqual(res.reinvestmentAssessment.unallocatedNetProceedsToCash, 59825.00);
    });

    test('Scenario 12: Competing Candidates with Fresh Evidence (OTG / BIMAS / VT)', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'PR-SCEN-12',
        holdingName: 'Overweight Tech Giant (OTG)',
        assetCategory: 'equity',
        currentMarketValue: 160000,
        costBasisTotal: 60000,
        portfolioTotalValue: 1000000,
        currentAllocationPercent: 16.0,
        limitHierarchy: {
          strategicTarget: 8.0,
          toleranceCeiling: 10.5,
          userHardCeilingStatus: 'not_configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: null,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        valuationFavorable: false,
        valuationAssessmentTimestamp: '2026-08-20',
        costModel: {
          capitalGainsTaxRateEstimate: 0.20,
          transactionFeeEstimateRate: 0.0010,
          estimatedSpreadRate: 0.0015,
          currency: 'USD'
        },
        reinvestmentCandidates: [
          {
            candidateId: 'CAND-BIMAS',
            holdingName: 'BİM Birleşik Mağazalar (BIMAS.IS)',
            assetCategory: 'turkish_equity',
            currentAllocationPercent: 6.5,
            targetAllocationPercent: 10.0, // Deficit $35,000
            thesisStatus: 'intact',
            valuationFavorable: true,
            valuationAssessmentTimestamp: '2026-09-25', // 27 days old, well within 90-day threshold
            valuationMetricsCount: 3,
            evidenceQuality: 'verified_fresh',
            verificationStatus: 'verified_primary',
            traceableEvidenceIds: ['EVID-BIMAS-KAP-2026Q3']
          },
          {
            candidateId: 'CAND-VT',
            holdingName: 'Vanguard Total World ETF (VT)',
            assetCategory: 'etf',
            currentAllocationPercent: 38.0,
            targetAllocationPercent: 40.0,
            thesisStatus: 'intact',
            valuationFavorable: null, // Neutral -> disqualified
            valuationAssessmentTimestamp: '2026-09-15',
            valuationMetricsCount: 2,
            evidenceQuality: 'verified_fresh',
            verificationStatus: 'verified_primary',
            traceableEvidenceIds: ['EVID-VT-SEC-2026Q3']
          }
        ],
        asOfDate: '2026-10-22'
      };

      const res = evaluateProfitRealization(input);
      assert.strictEqual(res.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION');
      assert.strictEqual(res.reinvestmentAssessment.action, 'REINVEST_NET_PROCEEDS');
      assert.strictEqual(res.reinvestmentAssessment.selectedCandidateId, 'CAND-BIMAS');
      assert.strictEqual(res.reinvestmentAssessment.allocatedNetProceedsCurrency, 35000);
      assert.strictEqual(res.reinvestmentAssessment.unallocatedNetProceedsToCash, 12987.50);
    });

    test('Scenario 13: Apparent Concentration Breach Is Negated (TMF) -> NO_ACTION', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'PR-SCEN-13',
        holdingName: 'Compliance Total Market ETF (TMF)',
        assetCategory: 'etf',
        currentMarketValue: 145000,
        costBasisTotal: 90000,
        portfolioTotalValue: 1000000,
        currentAllocationPercent: 14.5,
        limitHierarchy: {
          strategicTarget: 10.0,
          toleranceCeiling: 12.0,
          userHardCeiling: 15.0,
          userHardCeilingStatus: 'configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: 15.0,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        valuationFavorable: null, // Neutral
        valuationAssessmentTimestamp: '2026-09-15',
        asOfDate: '2026-10-22'
      };

      const res = evaluateProfitRealization(input);
      assert.strictEqual(res.realizationAssessment, 'NO_ACTION');
      assert.strictEqual(res.suggestedAmount.amountType, 'NO_SALE');
    });

    test('Scenario 14: Multi-Asset Rebalance (BTC Trim with Proceeds to BIMAS.IS and Cash)', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'PR-SCEN-14-BTC',
        holdingName: 'Bitcoin (BTC)',
        assetCategory: 'bitcoin',
        currentMarketValue: 240000,
        costBasisTotal: 50000,
        portfolioTotalValue: 1000000,
        currentAllocationPercent: 24.0,
        limitHierarchy: {
          strategicTarget: 5.0,
          toleranceCeiling: 9.0,
          userHardCeiling: 10.0,
          userHardCeilingStatus: 'configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: 10.0,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        costModel: {
          capitalGainsTaxRateEstimate: 0.20,
          transactionFeeEstimateRate: 0.0010,
          estimatedSpreadRate: 0.0020,
          currency: 'USD'
        },
        reinvestmentCandidates: [
          {
            candidateId: 'CAND-BIMAS',
            holdingName: 'BİM Birleşik Mağazalar (BIMAS.IS)',
            assetCategory: 'turkish_equity',
            currentAllocationPercent: 6.0,
            targetAllocationPercent: 10.0, // Deficit $40,000
            thesisStatus: 'intact',
            valuationFavorable: true,
            valuationAssessmentTimestamp: '2026-09-25',
            valuationMetricsCount: 3,
            evidenceQuality: 'verified_fresh',
            verificationStatus: 'verified_primary',
            traceableEvidenceIds: ['EVID-BIMAS-KAP-2026Q3']
          }
        ],
        asOfDate: '2026-10-22'
      };

      const res = evaluateProfitRealization(input);
      assert.strictEqual(res.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION');
      assert.strictEqual(res.suggestedAmount.suggestedGrossCapitalValue, 140000);
      assert.strictEqual(res.reinvestmentAssessment.action, 'REINVEST_NET_PROCEEDS');
      assert.strictEqual(res.reinvestmentAssessment.allocatedNetProceedsCurrency, 40000);
      // Net proceeds $117,413.33 - $40,000 = $77,413.33 in cash
      assert.strictEqual(res.reinvestmentAssessment.unallocatedNetProceedsToCash, 77413.33);
    });

    test('Scenario 15: Missing Baseline Financial Parameters (IDH) -> INSUFFICIENT_EVIDENCE', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'PR-SCEN-15',
        holdingName: 'Incomplete Data Holding (IDH)',
        assetCategory: 'equity',
        currentMarketValue: 50000,
        costBasisTotal: undefined, // Missing
        portfolioTotalValue: undefined, // Missing
        limitHierarchy: {
          strategicTarget: undefined as any,
          userHardCeilingStatus: 'not_configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: null,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        asOfDate: '2026-10-22'
      };

      const res = evaluateProfitRealization(input);
      assert.strictEqual(res.realizationAssessment, 'INSUFFICIENT_EVIDENCE');
      assert.ok(res.missingDataReasons!.length >= 3);
    });

    test('Scenario 16: High-Multiple Compounder at Target Weight (HMC) -> NO_ACTION', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'PR-SCEN-16',
        holdingName: 'High-Multiple Compounder (HMC)',
        assetCategory: 'equity',
        currentMarketValue: 105000,
        costBasisTotal: 50000,
        portfolioTotalValue: 1050000,
        currentAllocationPercent: 10.0,
        limitHierarchy: {
          strategicTarget: 10.0,
          toleranceCeiling: 12.5,
          userHardCeilingStatus: 'not_configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: null,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        valuationFavorable: false, // Expensive valuation at target does NOT sell
        valuationAssessmentTimestamp: '2026-08-20',
        asOfDate: '2026-10-22'
      };

      const res = evaluateProfitRealization(input);
      assert.strictEqual(res.realizationAssessment, 'NO_ACTION');
      assert.strictEqual(res.suggestedAmount.amountType, 'NO_SALE');
    });
  });

  /* =========================================================================
     3. Safety Boundaries & Core Invariant Tests
     ========================================================================= */

  describe('Safety Boundaries & Invariant Tests', () => {
    test('Invariant: Profit alone does not trigger realization', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'INV-01',
        holdingName: 'Massive Winner at Target',
        assetCategory: 'equity',
        currentMarketValue: 100000,
        costBasisTotal: 10000, // +900% gain!
        portfolioTotalValue: 1000000,
        currentAllocationPercent: 10.0,
        limitHierarchy: {
          strategicTarget: 10.0,
          toleranceCeiling: 12.5,
          userHardCeilingStatus: 'not_configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: null,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        valuationFavorable: true,
        asOfDate: '2026-10-22'
      };

      const res = evaluateProfitRealization(input);
      assert.strictEqual(res.realizationAssessment, 'NO_ACTION');
      assert.strictEqual(res.suggestedAmount.suggestedGrossCapitalValue, 0);
    });

    test('Invariant: Allocation drift alone does not trigger realization without extended valuation', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'INV-02',
        holdingName: 'Overweight Fair Winner',
        assetCategory: 'equity',
        currentMarketValue: 140000,
        costBasisTotal: 70000,
        portfolioTotalValue: 1000000,
        currentAllocationPercent: 14.0,
        limitHierarchy: {
          strategicTarget: 8.0,
          toleranceCeiling: 10.5,
          userHardCeilingStatus: 'not_configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: null,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        valuationFavorable: true, // Favorable valuation prevents realization!
        valuationAssessmentTimestamp: '2026-08-20',
        asOfDate: '2026-10-22'
      };

      const res = evaluateProfitRealization(input);
      assert.strictEqual(res.realizationAssessment, 'NO_ACTION');
    });

    test('Invariant: Tax and fees are calculated on realized tranche only', () => {
      const friction = calculateFrictionBreakdown({
        grossTransactionAmount: 20000,
        totalMarketValue: 100000,
        costBasisTotal: 50000,
        costModel: {
          capitalGainsTaxRateEstimate: 0.20,
          transactionFeeEstimateRate: 0.001,
          estimatedSpreadRate: 0.0015,
          currency: 'USD'
        }
      });

      // 20% of position realized (f = 0.20)
      assert.strictEqual(friction.fractionOfPositionRealized, 0.20);
      // Basis allocated = 0.20 * 50,000 = 10,000
      assert.strictEqual(friction.allocatedCostBasis, 10000);
      // Realized gain = 20,000 - 10,000 = 10,000
      assert.strictEqual(friction.grossRealizedCapitalGain, 10000);
      // Tax on tranche = 10,000 * 0.20 = 2,000 (NOT 20% of 50,000 total gain!)
      assert.strictEqual(friction.estimatedCapitalGainsTax, 2000);
      // Transaction fees = 20,000 * 0.0025 = 50
      assert.strictEqual(friction.estimatedCommissionCosts + friction.estimatedSpreadCosts, 50);
      assert.strictEqual(friction.estimatedNetProceeds, 17950);
    });

    test('Invariant: Sale sizing is clamped strictly between 0 and holding market value', () => {
      const trimNormal = calculateGrossTrimAmount({
        currentAllocationPercent: 15.0,
        thresholdPercent: 10.0,
        portfolioTotalValue: 1000000,
        holdingMarketValue: 150000
      });
      assert.strictEqual(trimNormal.grossTrimAmount, 50000);

      // Oversized threshold scenario (excess > holding)
      const trimCapped = calculateGrossTrimAmount({
        currentAllocationPercent: 50.0,
        thresholdPercent: 0.0,
        portfolioTotalValue: 1000000,
        holdingMarketValue: 120000
      });
      assert.strictEqual(trimCapped.grossTrimAmount, 120000); // Clamped to holding value
      assert.strictEqual(trimCapped.suggestedProportion, 1.0);

      // Negative excess
      const trimNegative = calculateGrossTrimAmount({
        currentAllocationPercent: 5.0,
        thresholdPercent: 10.0,
        portfolioTotalValue: 1000000,
        holdingMarketValue: 50000
      });
      assert.strictEqual(trimNegative.grossTrimAmount, 0);
      assert.strictEqual(trimNegative.suggestedProportion, 0);
    });

    test('Invariant: Discrete share rounding floors units to prevent over-trimming', () => {
      const trimDiscrete = calculateGrossTrimAmount({
        currentAllocationPercent: 12.0,
        thresholdPercent: 10.0,
        portfolioTotalValue: 1000000,
        holdingMarketValue: 120000,
        currentPrice: 150, // $20,000 / 150 = 133.333 shares
        isFractionalSupported: false
      });

      assert.strictEqual(trimDiscrete.discreteUnits, 133);
      assert.strictEqual(trimDiscrete.grossTrimAmount, 133 * 150); // $19,950
    });

    test('Invariant: Synthetic evidence cannot authorize real investment recommendation', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'real_decision', // Real mode!
        holdingId: 'REAL-01',
        holdingName: 'Real Holding Under Review',
        assetCategory: 'equity',
        currentMarketValue: 140000,
        costBasisTotal: 50000,
        portfolioTotalValue: 1000000,
        currentAllocationPercent: 14.0,
        limitHierarchy: {
          strategicTarget: 8.0,
          toleranceCeiling: 10.5,
          userHardCeilingStatus: 'not_configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: null,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        valuationFavorable: false,
        evidenceRecords: [{
          id: 'EV-SYNTH-01',
          holdingId: 'REAL-01',
          sourceDocId: 'DOC-01',
          claim: 'Valuation multiple extended',
          excerpt: 'P/E 38x',
          type: 'model_interpretation',
          verificationStatus: 'simulated_demonstration', // Synthetic evidence!
          freshnessStatus: 'fresh',
          evidenceQuality: 'moderate_analytical',
          confidenceNotes: 'Demo fixture',
          lastVerifiedDate: '2026-08-20',
          isSyntheticDemonstration: true
        }],
        asOfDate: '2026-10-22'
      };

      const res = evaluateProfitRealization(input);
      assert.strictEqual(res.realizationAssessment, 'INSUFFICIENT_EVIDENCE');
      assert.ok(res.realizationRationale.includes('Real decision mode security failure'));
    });

    test('Invariant: Stale valuation metrics fail closed with INSUFFICIENT_EVIDENCE', () => {
      const days = computeDaysElapsed('2026-02-10', '2026-10-22');
      assert.strictEqual(days, 254);

      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'STALE-01',
        holdingName: 'Holding with Stale Valuation',
        assetCategory: 'equity', // 180-day threshold
        currentMarketValue: 140000,
        costBasisTotal: 50000,
        portfolioTotalValue: 1000000,
        currentAllocationPercent: 14.0,
        limitHierarchy: {
          strategicTarget: 8.0,
          toleranceCeiling: 10.5,
          userHardCeilingStatus: 'not_configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: null,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        valuationFavorable: false,
        valuationAssessmentTimestamp: '2026-02-10', // 254 days old vs 180-day limit
        asOfDate: '2026-10-22'
      };

      const res = evaluateProfitRealization(input);
      assert.strictEqual(res.realizationAssessment, 'INSUFFICIENT_EVIDENCE');
      assert.ok(res.realizationRationale.includes('stale'));
    });
  });

  /* =========================================================================
     4. Targeted Unit Tests: Fix 1 - Valuation Freshness & Hard Limit Isolation
     ========================================================================= */

  describe('Targeted Unit Tests: Fix 1 - Valuation Freshness & Hard Limit Isolation', () => {
    test('validateDateFreshness: boundary checks (missing, malformed, future, exact threshold, stale)', () => {
      // Missing
      const missing = validateDateFreshness(undefined, 180, '2026-10-22');
      assert.strictEqual(missing.isValid, false);
      assert.ok(missing.reason?.includes('missing'));

      // Malformed
      const malformed = validateDateFreshness('not-a-valid-date', 180, '2026-10-22');
      assert.strictEqual(malformed.isValid, false);
      assert.ok(malformed.reason?.includes('malformed'));

      // Future date
      const future = validateDateFreshness('2026-11-01', 180, '2026-10-22');
      assert.strictEqual(future.isValid, false);
      assert.ok(future.reason?.includes('future'));

      // Exactly at threshold (180 days)
      const exact = validateDateFreshness('2026-04-25', 180, '2026-10-22');
      assert.strictEqual(exact.isValid, true);
      assert.strictEqual(exact.isFresh, true);
      assert.strictEqual(exact.daysElapsed, 180);

      // 1 day beyond threshold (181 days)
      const stale = validateDateFreshness('2026-04-24', 180, '2026-10-22');
      assert.strictEqual(stale.isValid, true);
      assert.strictEqual(stale.isFresh, false);
      assert.strictEqual(stale.daysElapsed, 181);
    });

    test('Discretionary rebalance with missing valuation date fails closed to INSUFFICIENT_EVIDENCE', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'DISC-NO-DATE',
        holdingName: 'Overweight Without Date',
        assetCategory: 'equity',
        currentMarketValue: 140000,
        costBasisTotal: 50000,
        portfolioTotalValue: 1000000,
        currentAllocationPercent: 14.0,
        limitHierarchy: {
          strategicTarget: 8.0,
          toleranceCeiling: 10.5,
          userHardCeilingStatus: 'not_configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: null,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        valuationFavorable: false, // Extended, but date is omitted!
        asOfDate: '2026-10-22'
      };

      const res = evaluateProfitRealization(input);
      assert.strictEqual(res.realizationAssessment, 'INSUFFICIENT_EVIDENCE');
      assert.strictEqual(res.suggestedAmount.amountType, 'INSUFFICIENT_EVIDENCE');
      assert.ok(res.realizationRationale.includes('missing'));
    });

    test('Discretionary rebalance with malformed date fails closed to INSUFFICIENT_EVIDENCE', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'DISC-MALFORMED',
        holdingName: 'Overweight Malformed Date',
        assetCategory: 'equity',
        currentMarketValue: 140000,
        costBasisTotal: 50000,
        portfolioTotalValue: 1000000,
        currentAllocationPercent: 14.0,
        limitHierarchy: {
          strategicTarget: 8.0,
          toleranceCeiling: 10.5,
          userHardCeilingStatus: 'not_configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: null,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        valuationFavorable: false,
        valuationAssessmentTimestamp: 'invalid-timestamp-format',
        asOfDate: '2026-10-22'
      };

      const res = evaluateProfitRealization(input);
      assert.strictEqual(res.realizationAssessment, 'INSUFFICIENT_EVIDENCE');
      assert.ok(res.realizationRationale.includes('malformed'));
    });

    test('Discretionary rebalance with future date fails closed to INSUFFICIENT_EVIDENCE', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'DISC-FUTURE',
        holdingName: 'Overweight Future Date',
        assetCategory: 'equity',
        currentMarketValue: 140000,
        costBasisTotal: 50000,
        portfolioTotalValue: 1000000,
        currentAllocationPercent: 14.0,
        limitHierarchy: {
          strategicTarget: 8.0,
          toleranceCeiling: 10.5,
          userHardCeilingStatus: 'not_configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: null,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        valuationFavorable: false,
        valuationAssessmentTimestamp: '2026-12-01', // Future relative to 2026-10-22
        asOfDate: '2026-10-22'
      };

      const res = evaluateProfitRealization(input);
      assert.strictEqual(res.realizationAssessment, 'INSUFFICIENT_EVIDENCE');
      assert.ok(res.realizationRationale.includes('future'));
    });

    test('Discretionary rebalance with date exactly at threshold (180 days) succeeds', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'DISC-EXACT',
        holdingName: 'Overweight Exact Threshold',
        assetCategory: 'equity', // 180-day threshold
        currentMarketValue: 140000,
        costBasisTotal: 50000,
        portfolioTotalValue: 1000000,
        currentAllocationPercent: 14.0,
        limitHierarchy: {
          strategicTarget: 8.0,
          toleranceCeiling: 10.5,
          userHardCeilingStatus: 'not_configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: null,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        valuationFavorable: false,
        valuationAssessmentTimestamp: '2026-04-25', // Exactly 180 days before 2026-10-22
        asOfDate: '2026-10-22'
      };

      const res = evaluateProfitRealization(input);
      assert.strictEqual(res.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION');
      assert.strictEqual(res.suggestedAmount.amountType, 'TRIM_TO_UPPER_TOLERANCE_BAND');
      assert.strictEqual(res.suggestedAmount.suggestedGrossCapitalValue, 35000);
    });

    test('Discretionary rebalance with date 1 day beyond threshold (181 days) fails closed', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'DISC-STALE-1D',
        holdingName: 'Overweight Stale by 1 Day',
        assetCategory: 'equity', // 180-day threshold
        currentMarketValue: 140000,
        costBasisTotal: 50000,
        portfolioTotalValue: 1000000,
        currentAllocationPercent: 14.0,
        limitHierarchy: {
          strategicTarget: 8.0,
          toleranceCeiling: 10.5,
          userHardCeilingStatus: 'not_configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: null,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        valuationFavorable: false,
        valuationAssessmentTimestamp: '2026-04-24', // 181 days before 2026-10-22
        asOfDate: '2026-10-22'
      };

      const res = evaluateProfitRealization(input);
      assert.strictEqual(res.realizationAssessment, 'INSUFFICIENT_EVIDENCE');
      assert.ok(res.realizationRationale.includes('stale'));
    });

    test('Hard ceiling breach evaluation is NOT suppressed by missing discretionary valuation date', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'HARD-NO-VAL-DATE',
        holdingName: 'Hard Breach Asset Without Valuation Date',
        assetCategory: 'equity',
        currentMarketValue: 150000,
        costBasisTotal: 50000,
        portfolioTotalValue: 1000000,
        currentAllocationPercent: 15.0,
        limitHierarchy: {
          strategicTarget: 6.0,
          toleranceCeiling: 8.0,
          userHardCeiling: 10.0,
          userHardCeilingStatus: 'configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: 10.0,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        // Valuation date intentionally omitted!
        valuationAssessmentTimestamp: undefined,
        valuationFavorable: undefined,
        asOfDate: '2026-10-22'
      };

      const res = evaluateProfitRealization(input);
      // Hard ceiling breach must remain fully actionable!
      assert.strictEqual(res.complianceContext.isHardLimitBreached, true);
      assert.strictEqual(res.complianceContext.governingHardCeiling, 10.0);
      assert.strictEqual(res.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION');
      assert.strictEqual(res.suggestedAmount.amountType, 'TRIM_TO_EFFECTIVE_HARD_CEILING');
      // Trim 15% - 10% = 5% of $1,000,000 = $50,000
      assert.strictEqual(res.suggestedAmount.suggestedGrossCapitalValue, 50000);
      assert.strictEqual(res.suggestedAmount.resultingAllocationPercent, 10.0);
      assert.strictEqual(res.suggestedAmount.isComplianceRestored, true);
    });
  });

  /* =========================================================================
     5. Targeted Unit Tests: Fix 2 - Candidate Evidence Metadata & Independent Evaluation
     ========================================================================= */

  describe('Targeted Unit Tests: Fix 2 - Candidate Evidence Metadata & Independent Evaluation', () => {
    test('Candidate with verified_fresh plus traceable IDs only does NOT promote to verified_primary', () => {
      const result = evaluateReinvestmentProceeds({
        netProceeds: 30000,
        portfolioTotalValue: 1000000,
        currency: 'USD',
        asOfDate: '2026-10-22',
        candidates: [{
          candidateId: 'CAND-TRACE-ONLY',
          holdingName: 'Candidate With Traceable IDs Only',
          assetCategory: 'equity',
          currentAllocationPercent: 5.0,
          targetAllocationPercent: 10.0,
          thesisStatus: 'intact',
          valuationFavorable: true,
          valuationAssessmentTimestamp: '2026-09-25',
          valuationMetricsCount: 2,
          evidenceQuality: 'verified_fresh',
          traceableEvidenceIds: ['EVID-CLAIM-01', 'EVID-CLAIM-02']
          // verificationStatus is NOT provided!
          // evidenceRecords is NOT provided!
        }]
      });

      assert.strictEqual(result.action, 'HOLD_AS_CASH');
      assert.strictEqual(result.candidateEvaluations.length, 1);
      const evalItem = result.candidateEvaluations[0];
      // Traceable IDs must NOT promote candidate to verified_primary
      assert.strictEqual(evalItem.evidenceVerification, 'unverified_third_party');
      assert.strictEqual(evalItem.evidenceFreshness, 'fresh');
      assert.strictEqual(evalItem.qualifiesForCapital, false);
      assert.ok(evalItem.disqualificationReasons.some(r => r.includes('lacks primary statutory verification')));
    });

    test('Candidate with explicit verified_primary status assigns verified_primary and qualifies', () => {
      const result = evaluateReinvestmentProceeds({
        netProceeds: 30000,
        portfolioTotalValue: 1000000,
        currency: 'USD',
        asOfDate: '2026-10-22',
        candidates: [{
          candidateId: 'CAND-EXPLICIT-PRIMARY',
          holdingName: 'Candidate With Explicit Verification',
          assetCategory: 'equity',
          currentAllocationPercent: 5.0,
          targetAllocationPercent: 10.0,
          thesisStatus: 'intact',
          valuationFavorable: true,
          valuationAssessmentTimestamp: '2026-09-25',
          valuationMetricsCount: 2,
          evidenceQuality: 'verified_fresh',
          verificationStatus: 'verified_primary',
          traceableEvidenceIds: ['EVID-AUDITED-01']
        }]
      });

      assert.strictEqual(result.action, 'REINVEST_NET_PROCEEDS');
      const evalItem = result.candidateEvaluations[0];
      assert.strictEqual(evalItem.evidenceVerification, 'verified_primary');
      assert.strictEqual(evalItem.evidenceFreshness, 'fresh');
      assert.strictEqual(evalItem.qualifiesForCapital, true);
    });

    test('Candidate evidence records with mixed verification statuses fail to unverified_third_party', () => {
      const mixedRecords: EvidenceFinding[] = [
        {
          id: 'REC-PRIMARY',
          holdingId: 'CAND-MIXED',
          sourceDocId: 'DOC-SEC-01',
          claim: 'Operating margins expanding',
          excerpt: 'Audited 10-K filing',
          type: 'verified_fact',
          verificationStatus: 'verified_primary',
          freshnessStatus: 'fresh',
          evidenceQuality: 'high_statutory',
          confidenceNotes: 'Audited filing',
          lastVerifiedDate: '2026-09-25',
          isSyntheticDemonstration: false
        },
        {
          id: 'REC-UNVERIFIED',
          holdingId: 'CAND-MIXED',
          sourceDocId: 'DOC-BLOG-02',
          claim: 'Projected revenue growth exceeds 50%',
          excerpt: 'Unverified blog post',
          type: 'model_interpretation',
          verificationStatus: 'unverified_third_party',
          freshnessStatus: 'fresh',
          evidenceQuality: 'insufficient',
          confidenceNotes: 'Unverified source',
          lastVerifiedDate: '2026-09-25',
          isSyntheticDemonstration: false
        }
      ];

      const result = evaluateReinvestmentProceeds({
        netProceeds: 30000,
        portfolioTotalValue: 1000000,
        currency: 'USD',
        asOfDate: '2026-10-22',
        candidates: [{
          candidateId: 'CAND-MIXED',
          holdingName: 'Candidate With Mixed Evidence Records',
          assetCategory: 'equity',
          currentAllocationPercent: 5.0,
          targetAllocationPercent: 10.0,
          thesisStatus: 'intact',
          valuationFavorable: true,
          valuationAssessmentTimestamp: '2026-09-25',
          valuationMetricsCount: 2,
          evidenceQuality: 'verified_fresh',
          evidenceRecords: mixedRecords
        }]
      });

      assert.strictEqual(result.action, 'HOLD_AS_CASH');
      const evalItem = result.candidateEvaluations[0];
      assert.strictEqual(evalItem.evidenceVerification, 'unverified_third_party');
      assert.strictEqual(evalItem.qualifiesForCapital, false);
      assert.ok(evalItem.disqualificationReasons.some(r => r.includes('lacks primary statutory verification')));
    });

    test('Candidate evidence records where all records are verified_primary establishes verified_primary', () => {
      const allPrimaryRecords: EvidenceFinding[] = [
        {
          id: 'REC-PRIMARY-1',
          holdingId: 'CAND-ALL-PRIMARY',
          sourceDocId: 'DOC-SEC-01',
          claim: 'Operating margins expanding',
          excerpt: 'Audited 10-K filing',
          type: 'verified_fact',
          verificationStatus: 'verified_primary',
          freshnessStatus: 'fresh',
          evidenceQuality: 'high_statutory',
          confidenceNotes: 'Audited filing',
          lastVerifiedDate: '2026-09-25',
          isSyntheticDemonstration: false
        },
        {
          id: 'REC-PRIMARY-2',
          holdingId: 'CAND-ALL-PRIMARY',
          sourceDocId: 'DOC-SEC-02',
          claim: 'Free cash flow conversion > 90%',
          excerpt: 'Audited statement of cash flows',
          type: 'verified_fact',
          verificationStatus: 'verified_primary',
          freshnessStatus: 'fresh',
          evidenceQuality: 'high_statutory',
          confidenceNotes: 'Audited 10-K',
          lastVerifiedDate: '2026-09-25',
          isSyntheticDemonstration: false
        }
      ];

      const result = evaluateReinvestmentProceeds({
        netProceeds: 30000,
        portfolioTotalValue: 1000000,
        currency: 'USD',
        asOfDate: '2026-10-22',
        candidates: [{
          candidateId: 'CAND-ALL-PRIMARY',
          holdingName: 'Candidate With All Primary Records',
          assetCategory: 'equity',
          currentAllocationPercent: 5.0,
          targetAllocationPercent: 10.0,
          thesisStatus: 'intact',
          valuationFavorable: true,
          valuationAssessmentTimestamp: '2026-09-25',
          valuationMetricsCount: 2,
          evidenceQuality: 'verified_fresh',
          evidenceRecords: allPrimaryRecords
        }]
      });

      assert.strictEqual(result.action, 'REINVEST_NET_PROCEEDS');
      const evalItem = result.candidateEvaluations[0];
      assert.strictEqual(evalItem.evidenceVerification, 'verified_primary');
      assert.strictEqual(evalItem.qualifiesForCapital, true);
    });

    test('Candidate with missing evidence reports unverified_third_party and is disqualified', () => {
      const result = evaluateReinvestmentProceeds({
        netProceeds: 30000,
        portfolioTotalValue: 1000000,
        currency: 'USD',
        asOfDate: '2026-10-22',
        candidates: [{
          candidateId: 'CAND-MISSING-EVID',
          holdingName: 'Candidate With Missing Evidence',
          assetCategory: 'equity',
          currentAllocationPercent: 5.0,
          targetAllocationPercent: 10.0,
          thesisStatus: 'intact',
          valuationFavorable: true,
          valuationAssessmentTimestamp: '2026-09-25',
          valuationMetricsCount: 2,
          evidenceQuality: 'adequate'
          // No verificationStatus, no evidenceRecords, no traceableEvidenceIds
        }]
      });

      assert.strictEqual(result.action, 'HOLD_AS_CASH');
      const evalItem = result.candidateEvaluations[0];
      assert.strictEqual(evalItem.evidenceVerification, 'unverified_third_party');
      assert.strictEqual(evalItem.qualifiesForCapital, false);
      assert.ok(evalItem.disqualificationReasons.some(r => r.includes('lacks primary statutory verification')));
    });

    test('Candidate with simulated demonstration evidence fails qualification in real_decision mode (explicit and records)', () => {
      // Subtest A: Explicit simulated_demonstration status
      const resultExplicit = evaluateReinvestmentProceeds({
        netProceeds: 30000,
        portfolioTotalValue: 1000000,
        currency: 'USD',
        asOfDate: '2026-10-22',
        executionMode: 'real_decision',
        candidates: [{
          candidateId: 'CAND-SIM-EXPLICIT',
          holdingName: 'Simulated Explicit Candidate',
          assetCategory: 'equity',
          currentAllocationPercent: 4.0,
          targetAllocationPercent: 10.0,
          thesisStatus: 'intact',
          valuationFavorable: true,
          valuationAssessmentTimestamp: '2026-09-25',
          valuationMetricsCount: 2,
          evidenceQuality: 'verified_fresh',
          verificationStatus: 'simulated_demonstration'
        }]
      });

      assert.strictEqual(resultExplicit.action, 'HOLD_AS_CASH');
      const evalExplicit = resultExplicit.candidateEvaluations[0];
      assert.strictEqual(evalExplicit.evidenceVerification, 'simulated_demonstration');
      assert.strictEqual(evalExplicit.qualifiesForCapital, false);
      assert.ok(evalExplicit.disqualificationReasons.some(r => r.includes('real decision mode')));

      // Subtest B: Via evidenceRecords containing simulated demonstration
      const simulatedRecords: EvidenceFinding[] = [
        {
          id: 'REC-SIM-1',
          holdingId: 'CAND-SIM-RECORDS',
          sourceDocId: 'DOC-SIM-01',
          claim: 'Demonstration metric',
          excerpt: 'Model output',
          type: 'model_interpretation',
          verificationStatus: 'simulated_demonstration',
          freshnessStatus: 'fresh',
          evidenceQuality: 'moderate_analytical',
          confidenceNotes: 'Demo record',
          lastVerifiedDate: '2026-09-25',
          isSyntheticDemonstration: true
        }
      ];

      const resultRecords = evaluateReinvestmentProceeds({
        netProceeds: 30000,
        portfolioTotalValue: 1000000,
        currency: 'USD',
        asOfDate: '2026-10-22',
        executionMode: 'real_decision',
        candidates: [{
          candidateId: 'CAND-SIM-RECORDS',
          holdingName: 'Candidate With Simulated Records',
          assetCategory: 'equity',
          currentAllocationPercent: 4.0,
          targetAllocationPercent: 10.0,
          thesisStatus: 'intact',
          valuationFavorable: true,
          valuationAssessmentTimestamp: '2026-09-25',
          valuationMetricsCount: 2,
          evidenceQuality: 'verified_fresh',
          evidenceRecords: simulatedRecords
        }]
      });

      assert.strictEqual(resultRecords.action, 'HOLD_AS_CASH');
      const evalRecords = resultRecords.candidateEvaluations[0];
      assert.strictEqual(evalRecords.evidenceVerification, 'simulated_demonstration');
      assert.strictEqual(evalRecords.qualifiesForCapital, false);
      assert.ok(evalRecords.disqualificationReasons.some(r => r.includes('real decision mode')));
    });

    test('Candidate evidence freshness is evaluated independently from thesis status', () => {
      const result = evaluateReinvestmentProceeds({
        netProceeds: 30000,
        portfolioTotalValue: 1000000,
        currency: 'USD',
        asOfDate: '2026-10-22',
        candidates: [{
          candidateId: 'CAND-QUESTIONABLE-THESIS',
          holdingName: 'Fresh Date but Questionable Thesis',
          assetCategory: 'equity',
          currentAllocationPercent: 5.0,
          targetAllocationPercent: 10.0,
          thesisStatus: 'questionable', // Failed thesis
          valuationFavorable: true,
          valuationAssessmentTimestamp: '2026-09-25', // Fresh!
          valuationMetricsCount: 2,
          evidenceQuality: 'verified_fresh',
          verificationStatus: 'verified_primary',
          traceableEvidenceIds: ['EVID-PRIMARY-01']
        }]
      });

      assert.strictEqual(result.action, 'HOLD_AS_CASH');
      const evalItem = result.candidateEvaluations[0];
      // Freshness must still be reported honestly as fresh, not conflated with thesis failure
      assert.strictEqual(evalItem.evidenceFreshness, 'fresh');
      assert.strictEqual(evalItem.evidenceVerification, 'verified_primary');
      assert.strictEqual(evalItem.qualifiesForCapital, false);
      assert.ok(evalItem.disqualificationReasons.some(r => r.includes("Thesis status is 'questionable'")));
    });

    test('Candidate evidence freshness is evaluated independently from allocation deficit', () => {
      const result = evaluateReinvestmentProceeds({
        netProceeds: 30000,
        portfolioTotalValue: 1000000,
        currency: 'USD',
        asOfDate: '2026-10-22',
        candidates: [{
          candidateId: 'CAND-NO-DEFICIT',
          holdingName: 'Fresh Date but Overweight Position',
          assetCategory: 'equity',
          currentAllocationPercent: 12.0,
          targetAllocationPercent: 10.0, // Deficit = 0
          thesisStatus: 'intact',
          valuationFavorable: true,
          valuationAssessmentTimestamp: '2026-09-25', // Fresh!
          valuationMetricsCount: 2,
          evidenceQuality: 'verified_fresh',
          verificationStatus: 'verified_primary',
          traceableEvidenceIds: ['EVID-PRIMARY-02']
        }]
      });

      assert.strictEqual(result.action, 'HOLD_AS_CASH');
      const evalItem = result.candidateEvaluations[0];
      assert.strictEqual(evalItem.evidenceFreshness, 'fresh');
      assert.strictEqual(evalItem.evidenceVerification, 'verified_primary');
      assert.strictEqual(evalItem.qualifiesForCapital, false);
      assert.ok(evalItem.disqualificationReasons.some(r => r.includes('deficit <= 0')));
    });

    test('Candidate with verified primary evidence and fresh KAP valuation qualifies in simulation', () => {
      const result = evaluateReinvestmentProceeds({
        netProceeds: 50000,
        portfolioTotalValue: 1000000,
        currency: 'USD',
        asOfDate: '2026-10-22',
        executionMode: 'synthetic_simulation',
        candidates: [{
          candidateId: 'CAND-QUALIFIED',
          holdingName: 'Fully Qualified Candidate',
          assetCategory: 'turkish_equity',
          currentAllocationPercent: 6.0,
          targetAllocationPercent: 10.0, // Deficit $40,000
          thesisStatus: 'intact',
          valuationFavorable: true,
          valuationAssessmentTimestamp: '2026-09-25', // 27 days old vs 90-day threshold
          valuationMetricsCount: 3,
          evidenceQuality: 'verified_fresh',
          verificationStatus: 'verified_primary',
          traceableEvidenceIds: ['EVID-BIMAS-KAP-2026Q3']
        }]
      });

      assert.strictEqual(result.action, 'REINVEST_NET_PROCEEDS');
      assert.strictEqual(result.selectedCandidateId, 'CAND-QUALIFIED');
      assert.strictEqual(result.allocatedNetProceedsCurrency, 40000);
      assert.strictEqual(result.unallocatedNetProceedsToCash, 10000);
      const evalItem = result.candidateEvaluations[0];
      assert.strictEqual(evalItem.evidenceFreshness, 'fresh');
      assert.strictEqual(evalItem.evidenceVerification, 'verified_primary');
      assert.strictEqual(evalItem.qualifiesForCapital, true);
    });

    test('Preserves clean distinction between freshness, evidence quality, and verification status', () => {
      // Candidate A: Stale date (freshness = stale), but high quality and explicit verified primary
      const candStale: ReinvestmentCandidateEvaluation = evaluateReinvestmentProceeds({
        netProceeds: 30000,
        portfolioTotalValue: 1000000,
        currency: 'USD',
        asOfDate: '2026-10-22',
        candidates: [{
          candidateId: 'CAND-STALE-VERIFIED',
          holdingName: 'Stale but Verified',
          assetCategory: 'equity', // 180-day threshold
          currentAllocationPercent: 5.0,
          targetAllocationPercent: 10.0,
          thesisStatus: 'intact',
          valuationFavorable: true,
          valuationAssessmentTimestamp: '2026-02-10', // 254 days old -> stale!
          valuationMetricsCount: 2,
          evidenceQuality: 'verified_fresh',
          verificationStatus: 'verified_primary'
        }]
      }).candidateEvaluations[0];

      // Freshness is stale, but verification remains verified_primary
      assert.strictEqual(candStale.evidenceFreshness, 'stale');
      assert.strictEqual(candStale.evidenceVerification, 'verified_primary');
      assert.strictEqual(candStale.qualifiesForCapital, false);
      assert.ok(candStale.disqualificationReasons.some(r => r.includes('stale')));

      // Candidate B: Fresh date (freshness = fresh), but unverified third party
      const candFreshUnverified: ReinvestmentCandidateEvaluation = evaluateReinvestmentProceeds({
        netProceeds: 30000,
        portfolioTotalValue: 1000000,
        currency: 'USD',
        asOfDate: '2026-10-22',
        candidates: [{
          candidateId: 'CAND-FRESH-UNVERIFIED',
          holdingName: 'Fresh but Unverified',
          assetCategory: 'equity',
          currentAllocationPercent: 5.0,
          targetAllocationPercent: 10.0,
          thesisStatus: 'intact',
          valuationFavorable: true,
          valuationAssessmentTimestamp: '2026-09-25', // 27 days old -> fresh!
          valuationMetricsCount: 2,
          evidenceQuality: 'adequate'
          // no verification status
        }]
      }).candidateEvaluations[0];

      // Freshness is fresh, but verification is unverified_third_party
      assert.strictEqual(candFreshUnverified.evidenceFreshness, 'fresh');
      assert.strictEqual(candFreshUnverified.evidenceVerification, 'unverified_third_party');
      assert.strictEqual(candFreshUnverified.qualifiesForCapital, false);
      assert.ok(candFreshUnverified.disqualificationReasons.some(r => r.includes('lacks primary statutory verification')));
    });
  });

  /* =========================================================================
     6. Targeted Unit Tests: Fix 3 - Financial Inputs and Friction Parameter Validation
     ========================================================================= */

  describe('Targeted Unit Tests: Fix 3 - Financial Inputs and Friction Parameter Validation', () => {
    const baseInput: ProfitRealizationEngineInput = {
      executionMode: 'synthetic_simulation',
      holdingId: 'PARAM-TEST',
      holdingName: 'Parameter Test Asset',
      assetCategory: 'equity',
      currentMarketValue: 140000,
      costBasisTotal: 50000,
      portfolioTotalValue: 1000000,
      currentAllocationPercent: 14.0,
      limitHierarchy: {
        strategicTarget: 8.0,
        toleranceCeiling: 10.5,
        userHardCeilingStatus: 'not_configured',
        externalCeilingStatus: 'not_applicable',
        effectiveHardCeiling: null,
        measurementBasis: 'percent_of_nav'
      },
      thesisStatus: 'intact',
      evidenceQuality: 'verified_fresh',
      valuationFavorable: false,
      valuationAssessmentTimestamp: '2026-09-15',
      asOfDate: '2026-10-22'
    };

    test('Rejects non-finite or non-positive portfolioTotalValue', () => {
      const resNaN = evaluateProfitRealization({ ...baseInput, portfolioTotalValue: NaN });
      assert.strictEqual(resNaN.realizationAssessment, 'INSUFFICIENT_EVIDENCE');
      assert.ok(resNaN.missingDataReasons?.some(r => r.includes('portfolioTotalValue')));

      const resZero = evaluateProfitRealization({ ...baseInput, portfolioTotalValue: 0 });
      assert.strictEqual(resZero.realizationAssessment, 'INSUFFICIENT_EVIDENCE');

      const resNeg = evaluateProfitRealization({ ...baseInput, portfolioTotalValue: -1000000 });
      assert.strictEqual(resNeg.realizationAssessment, 'INSUFFICIENT_EVIDENCE');

      const resInf = evaluateProfitRealization({ ...baseInput, portfolioTotalValue: Infinity });
      assert.strictEqual(resInf.realizationAssessment, 'INSUFFICIENT_EVIDENCE');
    });

    test('Rejects negative or non-finite currentMarketValue and costBasisTotal', () => {
      const resMarketNaN = evaluateProfitRealization({ ...baseInput, currentMarketValue: NaN });
      assert.strictEqual(resMarketNaN.realizationAssessment, 'INSUFFICIENT_EVIDENCE');

      const resMarketNeg = evaluateProfitRealization({ ...baseInput, currentMarketValue: -5000 });
      assert.strictEqual(resMarketNeg.realizationAssessment, 'INSUFFICIENT_EVIDENCE');

      const resBasisNaN = evaluateProfitRealization({ ...baseInput, costBasisTotal: NaN });
      assert.strictEqual(resBasisNaN.realizationAssessment, 'INSUFFICIENT_EVIDENCE');

      const resBasisNeg = evaluateProfitRealization({ ...baseInput, costBasisTotal: -1000 });
      assert.strictEqual(resBasisNeg.realizationAssessment, 'INSUFFICIENT_EVIDENCE');
    });

    test('Rejects non-finite or negative currentPrice', () => {
      const resPriceZero = evaluateProfitRealization({ ...baseInput, currentPrice: 0 });
      assert.strictEqual(resPriceZero.realizationAssessment, 'INSUFFICIENT_EVIDENCE');

      const resPriceNeg = evaluateProfitRealization({ ...baseInput, currentPrice: -50 });
      assert.strictEqual(resPriceNeg.realizationAssessment, 'INSUFFICIENT_EVIDENCE');

      const resPriceNaN = evaluateProfitRealization({ ...baseInput, currentPrice: NaN });
      assert.strictEqual(resPriceNaN.realizationAssessment, 'INSUFFICIENT_EVIDENCE');
    });

    test('Rejects out-of-range currentAllocationPercent (< 0 or > 100 or non-finite)', () => {
      const resAllocNeg = evaluateProfitRealization({ ...baseInput, currentAllocationPercent: -1.0 });
      assert.strictEqual(resAllocNeg.realizationAssessment, 'INSUFFICIENT_EVIDENCE');

      const resAlloc105 = evaluateProfitRealization({ ...baseInput, currentAllocationPercent: 105.0 });
      assert.strictEqual(resAlloc105.realizationAssessment, 'INSUFFICIENT_EVIDENCE');

      const resAllocNaN = evaluateProfitRealization({ ...baseInput, currentAllocationPercent: NaN });
      assert.strictEqual(resAllocNaN.realizationAssessment, 'INSUFFICIENT_EVIDENCE');
    });

    test('Rejects invalid costModel friction rates', () => {
      // Negative tax rate
      const resTaxNeg = evaluateProfitRealization({
        ...baseInput,
        costModel: { capitalGainsTaxRateEstimate: -0.10 }
      });
      assert.strictEqual(resTaxNeg.realizationAssessment, 'INSUFFICIENT_EVIDENCE');

      // Tax rate > 1.0
      const resTaxHigh = evaluateProfitRealization({
        ...baseInput,
        costModel: { capitalGainsTaxRateEstimate: 1.50 }
      });
      assert.strictEqual(resTaxHigh.realizationAssessment, 'INSUFFICIENT_EVIDENCE');

      // Excessive transaction fee rate (> 0.50)
      const resFeeHigh = evaluateProfitRealization({
        ...baseInput,
        costModel: { transactionFeeEstimateRate: 0.60 }
      });
      assert.strictEqual(resFeeHigh.realizationAssessment, 'INSUFFICIENT_EVIDENCE');

      // Negative spread rate
      const resSpreadNeg = evaluateProfitRealization({
        ...baseInput,
        costModel: { estimatedSpreadRate: -0.01 }
      });
      assert.strictEqual(resSpreadNeg.realizationAssessment, 'INSUFFICIENT_EVIDENCE');

      // Negative drag ratio hurdle
      const resDragNeg = evaluateProfitRealization({
        ...baseInput,
        costModel: { maxAllowableFrictionDragRatio: -0.5 }
      });
      assert.strictEqual(resDragNeg.realizationAssessment, 'INSUFFICIENT_EVIDENCE');

      // Negative minimum transaction threshold
      const resThreshNeg = evaluateProfitRealization({
        ...baseInput,
        costModel: { minimumTransactionThreshold: -100 }
      });
      assert.strictEqual(resThreshNeg.realizationAssessment, 'INSUFFICIENT_EVIDENCE');
    });

    test('Preserves distinction between legitimate realized loss (G < 0) vs invalid data', () => {
      // Underwater holding ($100k market value on $120k cost basis = -$20k loss)
      const underwaterInput: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'LOSS-HOLDING',
        holdingName: 'Holding Held at Capital Loss',
        assetCategory: 'equity',
        currentMarketValue: 100000,
        costBasisTotal: 120000, // Valid financial parameters, legitimate capital loss
        portfolioTotalValue: 1000000,
        currentAllocationPercent: 10.0,
        limitHierarchy: {
          strategicTarget: 10.0,
          toleranceCeiling: 12.5,
          userHardCeilingStatus: 'not_configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: null,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        valuationFavorable: null,
        asOfDate: '2026-10-22'
      };

      const res = evaluateProfitRealization(underwaterInput);
      // Legitimate loss must NOT be treated as missing/invalid data!
      assert.strictEqual(res.realizationAssessment, 'NO_ACTION');
      assert.strictEqual(res.complianceContext.isHoldingInProfit, false);
      assert.strictEqual(res.complianceContext.unrealizedGainCurrency, -20000);
      assert.strictEqual(res.suggestedAmount.amountType, 'NO_SALE');
    });

    test('calculateFrictionBreakdown rejects non-finite or invalid parameters', () => {
      assert.throws(() => {
        calculateFrictionBreakdown({
          grossTransactionAmount: NaN,
          totalMarketValue: 100000,
          costBasisTotal: 50000
        });
      }, /must be a non-negative finite number/);

      assert.throws(() => {
        calculateFrictionBreakdown({
          grossTransactionAmount: 20000,
          totalMarketValue: 100000,
          costBasisTotal: 50000,
          costModel: { capitalGainsTaxRateEstimate: 1.2 }
        });
      }, /between 0.0 and 1.0/);

      assert.throws(() => {
        calculateFrictionBreakdown({
          grossTransactionAmount: 20000,
          totalMarketValue: 100000,
          costBasisTotal: 50000,
          costModel: { transactionFeeEstimateRate: -0.01 }
        });
      }, /between 0.0 and 0.50/);
    });
  });

  /* =========================================================================
     7. Targeted Unit Tests: Fix 4 - Honest Hard-Limit Enforcement Under Discrete Units
     ========================================================================= */

  describe('Targeted Unit Tests: Fix 4 - Honest Hard-Limit Enforcement Under Discrete Units', () => {
    test('Fractional shares supported restores compliance exactly (isComplianceRestored: true)', () => {
      const trim = calculateGrossTrimAmount({
        currentAllocationPercent: 12.55,
        thresholdPercent: 10.0,
        portfolioTotalValue: 1000000,
        holdingMarketValue: 125500,
        currentPrice: 320.0,
        isFractionalSupported: true,
        isHardComplianceBreach: true
      });

      assert.strictEqual(trim.isComplianceRestored, true);
      assert.strictEqual(trim.discreteUnits, 79.6875);
      // Raw trim = 2.55% of $1,000,000 = $25,500. Units = 25,500 / 320 = 79.6875
      assert.strictEqual(trim.grossTrimAmount, 25500.0);
      assert.strictEqual(trim.resultingAllocationPercent, 10.0);
      assert.strictEqual(trim.complianceWarning, undefined);
    });

    test('Whole shares where floored units leave position above hard ceiling reports isComplianceRestored: false', () => {
      // Portfolio $1,000,000, ceiling 10.0% ($100,000), position $110,500 (11.05%), price $600/share
      // Raw trim = $10,500. Floored units = floor(10,500 / 600) = 17 shares = $10,200.
      // Remaining holding = $110,500 - $10,200 = $100,300 -> 10.03% > 10.00%
      const trim = calculateGrossTrimAmount({
        currentAllocationPercent: 11.05,
        thresholdPercent: 10.0,
        portfolioTotalValue: 1000000,
        holdingMarketValue: 110500,
        currentPrice: 600.0,
        isFractionalSupported: false,
        isHardComplianceBreach: true
      });

      assert.strictEqual(trim.isComplianceRestored, false);
      assert.strictEqual(trim.discreteUnits, 17);
      assert.strictEqual(trim.grossTrimAmount, 10200.0);
      assert.strictEqual(trim.resultingAllocationPercent, 10.03);
      assert.ok(trim.complianceWarning !== undefined);
      assert.ok(trim.complianceWarning.includes('Hard limit remains breached'));
      assert.ok(trim.complianceWarning.includes('Human review required'));
    });

    test('Position excess smaller than 1 whole share yields 0 trim with isComplianceRestored: false', () => {
      // Portfolio $1,000,000, ceiling 10.0% ($100,000), position $100,500 (10.05%), price $1,000/share
      // Excess is $500, but 1 share is $1,000 -> floored units = 0
      const trim = calculateGrossTrimAmount({
        currentAllocationPercent: 10.05,
        thresholdPercent: 10.0,
        portfolioTotalValue: 1000000,
        holdingMarketValue: 100500,
        currentPrice: 1000.0,
        isFractionalSupported: false,
        isHardComplianceBreach: true
      });

      assert.strictEqual(trim.isComplianceRestored, false);
      assert.strictEqual(trim.discreteUnits, 0);
      assert.strictEqual(trim.grossTrimAmount, 0.0);
      assert.strictEqual(trim.resultingAllocationPercent, 10.05);
      assert.ok(trim.complianceWarning !== undefined);
      assert.ok(trim.complianceWarning.includes('Position excess ($500.00) is smaller than one whole share'));
      assert.ok(trim.complianceWarning.includes('Human review required'));
    });

    test('Whole shares where floored units achieve exact compliance (isComplianceRestored: true)', () => {
      // Portfolio $1,000,000, ceiling 10.0% ($100,000), position $110,000 (11.0%), price $100/share
      // Excess = $10,000. Units = 100 shares = $10,000.
      const trim = calculateGrossTrimAmount({
        currentAllocationPercent: 11.0,
        thresholdPercent: 10.0,
        portfolioTotalValue: 1000000,
        holdingMarketValue: 110000,
        currentPrice: 100.0,
        isFractionalSupported: false,
        isHardComplianceBreach: true
      });

      assert.strictEqual(trim.isComplianceRestored, true);
      assert.strictEqual(trim.discreteUnits, 100);
      assert.strictEqual(trim.grossTrimAmount, 10000.0);
      assert.strictEqual(trim.resultingAllocationPercent, 10.0);
      assert.strictEqual(trim.complianceWarning, undefined);
    });

    test('Full engine run includes discrete compliance warning in rationale and limitations', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'DISCRETE-HARD-BREACH',
        holdingName: 'Discrete Units Hard Breach',
        assetCategory: 'equity',
        currentMarketValue: 110500,
        costBasisTotal: 50000,
        portfolioTotalValue: 1000000,
        currentAllocationPercent: 11.05,
        currentPrice: 600.0, // $10,500 excess / 600 = 17.5 shares -> 17 floored
        isFractionalSupported: false,
        limitHierarchy: {
          strategicTarget: 6.0,
          toleranceCeiling: 8.0,
          userHardCeiling: 10.0,
          userHardCeilingStatus: 'configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: 10.0,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        valuationAssessmentTimestamp: '2026-09-15',
        asOfDate: '2026-10-22'
      };

      const res = evaluateProfitRealization(input);
      assert.strictEqual(res.complianceContext.isHardLimitBreached, true);
      assert.strictEqual(res.suggestedAmount.isComplianceRestored, false);
      assert.strictEqual(res.suggestedAmount.resultingAllocationPercent, 10.03);
      assert.ok(res.realizationRationale.includes('Human review required'));
      assert.ok(res.suggestedAmount.limitations.some(l => l.includes('Hard limit remains breached')));
    });
  });

  /* =========================================================================
     8. Targeted Unit Tests: Fix 5 - Allocation-Limit Hierarchy Boundary Tests
     ========================================================================= */

  describe('Targeted Unit Tests: Fix 5 - Allocation-Limit Hierarchy Boundary Tests', () => {
    test('userHardCeilingStatus configured with undefined ceiling fails with isMateriallyUncertain: true', () => {
      const res = resolveEffectiveHardCeiling({
        strategicTarget: 5.0,
        toleranceCeiling: 8.0,
        userHardCeiling: undefined, // Contradictory!
        userHardCeilingStatus: 'configured',
        externalCeilingStatus: 'not_applicable',
        effectiveHardCeiling: null,
        measurementBasis: 'percent_of_nav'
      });

      assert.strictEqual(res.effectiveHardCeiling, null);
      assert.strictEqual(res.isMateriallyUncertain, true);
      assert.ok(res.disclosures.some(d => d.includes('Contradictory user hard ceiling configuration')));
    });

    test('userHardCeilingStatus configured with NaN ceiling fails with isMateriallyUncertain: true', () => {
      const res = resolveEffectiveHardCeiling({
        strategicTarget: 5.0,
        toleranceCeiling: 8.0,
        userHardCeiling: NaN,
        userHardCeilingStatus: 'configured',
        externalCeilingStatus: 'not_applicable',
        effectiveHardCeiling: null,
        measurementBasis: 'percent_of_nav'
      });

      assert.strictEqual(res.effectiveHardCeiling, null);
      assert.strictEqual(res.isMateriallyUncertain, true);
    });

    test('userHardCeilingStatus configured with negative ceiling fails with isMateriallyUncertain: true', () => {
      const res = resolveEffectiveHardCeiling({
        strategicTarget: 5.0,
        toleranceCeiling: 8.0,
        userHardCeiling: -5.0,
        userHardCeilingStatus: 'configured',
        externalCeilingStatus: 'not_applicable',
        effectiveHardCeiling: null,
        measurementBasis: 'percent_of_nav'
      });

      assert.strictEqual(res.effectiveHardCeiling, null);
      assert.strictEqual(res.isMateriallyUncertain, true);
    });

    test('userHardCeilingStatus configured with ceiling > 100 fails with isMateriallyUncertain: true', () => {
      const res = resolveEffectiveHardCeiling({
        strategicTarget: 5.0,
        toleranceCeiling: 8.0,
        userHardCeiling: 150.0,
        userHardCeilingStatus: 'configured',
        externalCeilingStatus: 'not_applicable',
        effectiveHardCeiling: null,
        measurementBasis: 'percent_of_nav'
      });

      assert.strictEqual(res.effectiveHardCeiling, null);
      assert.strictEqual(res.isMateriallyUncertain, true);
    });

    test('userHardCeilingStatus not_configured with defined numeric ceiling fails with isMateriallyUncertain: true', () => {
      const res = resolveEffectiveHardCeiling({
        strategicTarget: 5.0,
        toleranceCeiling: 8.0,
        userHardCeiling: 10.0, // Contradictory: value supplied with not_configured!
        userHardCeilingStatus: 'not_configured',
        externalCeilingStatus: 'not_applicable',
        effectiveHardCeiling: null,
        measurementBasis: 'percent_of_nav'
      });

      assert.strictEqual(res.effectiveHardCeiling, null);
      assert.strictEqual(res.isMateriallyUncertain, true);
      assert.ok(res.disclosures.some(d => d.includes('Contradictory user hard ceiling configuration')));
    });

    test('Invalid externalCeilingStatus fails with isMateriallyUncertain: true', () => {
      const res = resolveEffectiveHardCeiling({
        strategicTarget: 5.0,
        toleranceCeiling: 8.0,
        userHardCeilingStatus: 'not_configured',
        externalCeilingStatus: 'bogus_status' as any,
        effectiveHardCeiling: null,
        measurementBasis: 'percent_of_nav'
      });

      assert.strictEqual(res.effectiveHardCeiling, null);
      assert.strictEqual(res.isMateriallyUncertain, true);
      assert.ok(res.disclosures.some(d => d.includes('Invalid externalCeilingStatus')));
    });

    test('externalCeilingStatus not_applicable with defined verifiedExternalCeiling fails with isMateriallyUncertain: true', () => {
      const res = resolveEffectiveHardCeiling({
        strategicTarget: 5.0,
        toleranceCeiling: 8.0,
        userHardCeilingStatus: 'not_configured',
        externalCeilingStatus: 'not_applicable',
        verifiedExternalCeiling: {
          ceilingPercent: 5.0,
          sourceAuthority: 'Contradictory Directive',
          jurisdiction: 'EU',
          scope: 'Fund',
          verificationStatus: 'verified_primary',
          measurementBasis: 'percent_of_nav',
          isApplicabilityEstablished: true
        },
        effectiveHardCeiling: null,
        measurementBasis: 'percent_of_nav'
      });

      assert.strictEqual(res.effectiveHardCeiling, null);
      assert.strictEqual(res.isMateriallyUncertain, true);
      assert.ok(res.disclosures.some(d => d.includes('Inconsistent external ceiling')));
    });

    test('Negative strategicTarget or strategicTarget > 100 fails closed with INSUFFICIENT_EVIDENCE', () => {
      const inputNeg: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'NEG-TARGET',
        holdingName: 'Negative Target Holding',
        assetCategory: 'equity',
        currentMarketValue: 50000,
        costBasisTotal: 40000,
        portfolioTotalValue: 1000000,
        currentAllocationPercent: 5.0,
        limitHierarchy: {
          strategicTarget: -5.0, // Invalid negative!
          userHardCeilingStatus: 'not_configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: null,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        asOfDate: '2026-10-22'
      };

      const resNeg = evaluateProfitRealization(inputNeg);
      assert.strictEqual(resNeg.realizationAssessment, 'INSUFFICIENT_EVIDENCE');
      assert.ok(resNeg.missingDataReasons?.some(r => r.includes('strategicTarget')));

      const inputOver: ProfitRealizationEngineInput = {
        ...inputNeg,
        limitHierarchy: {
          ...inputNeg.limitHierarchy,
          strategicTarget: 110.0
        }
      };
      const resOver = evaluateProfitRealization(inputOver);
      assert.strictEqual(resOver.realizationAssessment, 'INSUFFICIENT_EVIDENCE');
    });

    test('toleranceCeiling less than strategicTarget fails closed with INSUFFICIENT_EVIDENCE', () => {
      const inputInverted: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'INVERTED-CEILING',
        holdingName: 'Inverted Ceiling Holding',
        assetCategory: 'equity',
        currentMarketValue: 100000,
        costBasisTotal: 50000,
        portfolioTotalValue: 1000000,
        currentAllocationPercent: 10.0,
        limitHierarchy: {
          strategicTarget: 10.0,
          toleranceCeiling: 8.0, // Inverted: tolerance ceiling lower than baseline strategic target!
          userHardCeilingStatus: 'not_configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: null,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        asOfDate: '2026-10-22'
      };

      const resInverted = evaluateProfitRealization(inputInverted);
      assert.strictEqual(resInverted.realizationAssessment, 'INSUFFICIENT_EVIDENCE');
      assert.ok(resInverted.missingDataReasons?.some(r => r.includes('cannot be less than strategicTarget')));
    });
  });

  /* =========================================================================
     9. Targeted Correctness Remediation: Item 1 - Enforce Transaction Amount Bounds
     ========================================================================= */

  describe('Item 1: Enforce Transaction Amount Bounds', () => {
    test('Zero position value and zero transaction returns zero friction breakdown', () => {
      const res = calculateFrictionBreakdown({
        grossTransactionAmount: 0,
        totalMarketValue: 0,
        costBasisTotal: 0
      });
      assert.strictEqual(res.grossTransactionAmount, 0);
      assert.strictEqual(res.fractionOfPositionRealized, 0);
      assert.strictEqual(res.allocatedCostBasis, 0);
      assert.strictEqual(res.grossRealizedCapitalGain, 0);
      assert.strictEqual(res.estimatedCapitalGainsTax, 0);
      assert.strictEqual(res.totalFrictionCosts, 0);
      assert.strictEqual(res.estimatedNetProceeds, 0);
      assert.strictEqual(res.taxCalculationMethod, 'Zero transaction value');
    });

    test('Zero transaction amount on non-zero position returns zero friction breakdown', () => {
      const res = calculateFrictionBreakdown({
        grossTransactionAmount: 0,
        totalMarketValue: 50000,
        costBasisTotal: 30000
      });
      assert.strictEqual(res.grossTransactionAmount, 0);
      assert.strictEqual(res.fractionOfPositionRealized, 0);
      assert.strictEqual(res.estimatedNetProceeds, 0);
    });

    test('Exact full-position sale realizes 100% of position and allocates entire cost basis without clamping', () => {
      const res = calculateFrictionBreakdown({
        grossTransactionAmount: 50000,
        totalMarketValue: 50000,
        costBasisTotal: 30000,
        costModel: {
          capitalGainsTaxRateEstimate: 0.20,
          transactionFeeEstimateRate: 0.0010,
          estimatedSpreadRate: 0.0015
        }
      });
      assert.strictEqual(res.grossTransactionAmount, 50000);
      assert.strictEqual(res.fractionOfPositionRealized, 1.0);
      assert.strictEqual(res.allocatedCostBasis, 30000);
      assert.strictEqual(res.grossRealizedCapitalGain, 20000);
      assert.strictEqual(res.estimatedCapitalGainsTax, 4000);
      assert.strictEqual(res.estimatedCommissionCosts, 50);
      assert.strictEqual(res.estimatedSpreadCosts, 75);
      assert.strictEqual(res.totalFrictionCosts, 4125);
      assert.strictEqual(res.estimatedNetProceeds, 45875);
    });

    test('Transaction amount just above position market value throws validation error', () => {
      assert.throws(
        () => {
          calculateFrictionBreakdown({
            grossTransactionAmount: 50000.01,
            totalMarketValue: 50000,
            costBasisTotal: 30000
          });
        },
        /Invalid grossTransactionAmount: cannot exceed totalMarketValue/
      );
    });

    test('Transaction amount on zero-value position throws validation error', () => {
      assert.throws(
        () => {
          calculateFrictionBreakdown({
            grossTransactionAmount: 10,
            totalMarketValue: 0,
            costBasisTotal: 0
          });
        },
        /Invalid grossTransactionAmount: cannot exceed totalMarketValue/
      );
    });
  });

  /* =========================================================================
     10. Targeted Correctness Remediation: Item 2 - Prevent Impossible Net Proceeds
     ========================================================================= */

  describe('Item 2: Prevent Impossible Net Proceeds', () => {
    test('Deductions equal to gross proceeds yields exactly $0.00 net proceeds without error', () => {
      const res = calculateFrictionBreakdown({
        grossTransactionAmount: 1000,
        totalMarketValue: 1000,
        costBasisTotal: 1000,
        costModel: {
          transactionFeeEstimateRate: 0.50,
          estimatedSpreadRate: 0.50,
          capitalGainsTaxRateEstimate: 0
        }
      });
      assert.strictEqual(res.grossTransactionAmount, 1000);
      assert.strictEqual(res.totalFrictionCosts, 1000);
      assert.strictEqual(res.estimatedNetProceeds, 0);
    });

    test('Deductions exceeding gross proceeds throws explicit error in calculateFrictionBreakdown', () => {
      assert.throws(
        () => {
          calculateFrictionBreakdown({
            grossTransactionAmount: 1000,
            totalMarketValue: 1000,
            costBasisTotal: 0,
            costModel: {
              capitalGainsTaxRateEstimate: 0.35,
              transactionFeeEstimateRate: 0.40,
              estimatedSpreadRate: 0.40
            }
          });
        },
        /total friction costs .* exceed gross proceeds/
      );
    });

    test('evaluateProfitRealization fails closed with INSUFFICIENT_EVIDENCE when cost model deductions exceed proceeds', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'HIGH-COST-MODEL',
        holdingName: 'High Cost Holding',
        assetCategory: 'equity',
        currentMarketValue: 120000,
        costBasisTotal: 20000,
        portfolioTotalValue: 1000000,
        currentAllocationPercent: 12.0,
        limitHierarchy: {
          strategicTarget: 6.0,
          toleranceCeiling: 8.0,
          userHardCeiling: 10.0,
          userHardCeilingStatus: 'configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: 10.0,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        valuationFavorable: false,
        valuationAssessmentTimestamp: '2026-09-15',
        asOfDate: '2026-10-22',
        costModel: {
          capitalGainsTaxRateEstimate: 0.40,
          transactionFeeEstimateRate: 0.40,
          estimatedSpreadRate: 0.40
        }
      };

      const res = evaluateProfitRealization(input);
      assert.strictEqual(res.realizationAssessment, 'INSUFFICIENT_EVIDENCE');
      assert.strictEqual(res.suggestedAmount.amountType, 'INSUFFICIENT_EVIDENCE');
      assert.ok(res.realizationRationale.includes('Cost model calculation failed'));
      assert.ok(res.violationsPrevented.some(v => v.includes('deductions exceed')));
    });

    test('Valid realized loss position preserves zero capital gains tax and positive net proceeds', () => {
      const res = calculateFrictionBreakdown({
        grossTransactionAmount: 4000,
        totalMarketValue: 8000,
        costBasisTotal: 10000,
        costModel: {
          capitalGainsTaxRateEstimate: 0.20,
          transactionFeeEstimateRate: 0.0010,
          estimatedSpreadRate: 0.0015
        }
      });
      assert.strictEqual(res.fractionOfPositionRealized, 0.5);
      assert.strictEqual(res.allocatedCostBasis, 5000);
      assert.strictEqual(res.grossRealizedCapitalGain, -1000);
      assert.strictEqual(res.estimatedCapitalGainsTax, 0);
      assert.strictEqual(res.estimatedCommissionCosts, 4);
      assert.strictEqual(res.estimatedSpreadCosts, 6);
      assert.strictEqual(res.totalFrictionCosts, 10);
      assert.strictEqual(res.estimatedNetProceeds, 3990);
      assert.strictEqual(res.frictionToGainDragRatio, 0);
    });

    test('Valid zero-gain position preserves zero capital gains tax and positive net proceeds', () => {
      const res = calculateFrictionBreakdown({
        grossTransactionAmount: 5000,
        totalMarketValue: 10000,
        costBasisTotal: 10000,
        costModel: {
          capitalGainsTaxRateEstimate: 0.20,
          transactionFeeEstimateRate: 0.0010,
          estimatedSpreadRate: 0.0015
        }
      });
      assert.strictEqual(res.fractionOfPositionRealized, 0.5);
      assert.strictEqual(res.allocatedCostBasis, 5000);
      assert.strictEqual(res.grossRealizedCapitalGain, 0);
      assert.strictEqual(res.estimatedCapitalGainsTax, 0);
      assert.strictEqual(res.estimatedCommissionCosts, 5);
      assert.strictEqual(res.estimatedSpreadCosts, 7.5);
      assert.strictEqual(res.totalFrictionCosts, 12.5);
      assert.strictEqual(res.estimatedNetProceeds, 4987.5);
    });
  });

  /* =========================================================================
     11. Targeted Correctness Remediation: Item 3 - Precise Freshness Thresholds
     ========================================================================= */

  describe('Item 3: Precise Freshness Thresholds', () => {
    const asOfUtc = '2026-10-22T00:00:00.000Z';
    const asOfMs = new Date(asOfUtc).getTime();
    const thresholdDays = 180;
    const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;

    test('Timestamp exactly at 180-day threshold is fresh', () => {
      const exactDate = new Date(asOfMs - thresholdMs).toISOString();
      const res = validateDateFreshness(exactDate, thresholdDays, asOfUtc);
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.isFresh, true);
      assert.strictEqual(res.daysElapsed, 180);
      assert.strictEqual(res.reason, undefined);
    });

    test('Timestamp just before 180-day threshold is fresh', () => {
      // 1 second before threshold
      const oneSecBefore = new Date(asOfMs - thresholdMs + 1000).toISOString();
      const resSec = validateDateFreshness(oneSecBefore, thresholdDays, asOfUtc);
      assert.strictEqual(resSec.isValid, true);
      assert.strictEqual(resSec.isFresh, true);
      assert.strictEqual(resSec.reason, undefined);

      // 1 minute before threshold (shows in 4-decimal daysElapsed: 179.9993)
      const oneMinBefore = new Date(asOfMs - thresholdMs + 60000).toISOString();
      const resMin = validateDateFreshness(oneMinBefore, thresholdDays, asOfUtc);
      assert.strictEqual(resMin.isFresh, true);
      assert.ok(resMin.daysElapsed < 180);
    });

    test('Timestamp just after 180-day threshold is stale', () => {
      // 1 second after threshold
      const oneSecAfter = new Date(asOfMs - thresholdMs - 1000).toISOString();
      const resSec = validateDateFreshness(oneSecAfter, thresholdDays, asOfUtc);
      assert.strictEqual(resSec.isValid, true);
      assert.strictEqual(resSec.isFresh, false);
      assert.ok(resSec.reason?.includes('stale'));

      // 1 minute after threshold (shows in 4-decimal daysElapsed: 180.0007)
      const oneMinAfter = new Date(asOfMs - thresholdMs - 60000).toISOString();
      const resMin = validateDateFreshness(oneMinAfter, thresholdDays, asOfUtc);
      assert.strictEqual(resMin.isFresh, false);
      assert.ok(resMin.daysElapsed > 180);
      assert.ok(resMin.reason?.includes('stale'));
    });

    test('Timestamp 180 days + 23 hours fails as stale (verifying fix for Math.floor flaw)', () => {
      const msElapsed = (180 * 24 + 23) * 60 * 60 * 1000;
      const floorFlawDate = new Date(asOfMs - msElapsed).toISOString();
      const res = validateDateFreshness(floorFlawDate, thresholdDays, asOfUtc);
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.isFresh, false);
      assert.strictEqual(res.daysElapsed, 180.9583);
      assert.ok(res.reason?.includes('stale'));
    });

    test('Time-of-day boundary precision works across intraday offsets', () => {
      const anchorTime = '2026-10-22T14:30:00.000Z';
      const anchorMs = new Date(anchorTime).getTime();
      const exact30Days = new Date(anchorMs - 30 * 24 * 3600 * 1000).toISOString();
      const resExact = validateDateFreshness(exact30Days, 30, anchorTime);
      assert.strictEqual(resExact.isFresh, true);

      const stale30Days = new Date(anchorMs - (30 * 24 * 3600 * 1000 + 60000)).toISOString();
      const resStale = validateDateFreshness(stale30Days, 30, anchorTime);
      assert.strictEqual(resStale.isFresh, false);
    });

    test('Missing, malformed, and future timestamps remain strictly invalid', () => {
      assert.strictEqual(validateDateFreshness(undefined, 180).isValid, false);
      assert.strictEqual(validateDateFreshness('', 180).isValid, false);
      assert.strictEqual(validateDateFreshness('   ', 180).isValid, false);
      assert.strictEqual(validateDateFreshness('not-a-valid-date', 180).isValid, false);
      
      const futureRes = validateDateFreshness('2026-12-01', 180, '2026-10-22');
      assert.strictEqual(futureRes.isValid, false);
      assert.strictEqual(futureRes.daysElapsed, -1);
      assert.ok(futureRes.reason?.includes('future'));
    });
  });

  /* =========================================================================
     12. Targeted Correctness Remediation: Item 4 - Conservative Uncertain External Limits
     ========================================================================= */

  describe('Item 4: Conservative Uncertain External Limits', () => {
    test('Unverified external ceiling with NaN ceilingPercent fails closed as materially uncertain', () => {
      const res = resolveEffectiveHardCeiling({
        strategicTarget: 5.0,
        userHardCeilingStatus: 'not_configured',
        externalCeilingStatus: 'unverified',
        verifiedExternalCeiling: {
          ceilingPercent: NaN,
          sourceAuthority: 'Rumor',
          jurisdiction: 'Unknown',
          scope: 'Fund',
          verificationStatus: 'unverified_third_party',
          measurementBasis: 'percent_of_nav',
          isApplicabilityEstablished: false
        },
        effectiveHardCeiling: null,
        measurementBasis: 'percent_of_nav'
      }, 7.0);

      assert.strictEqual(res.effectiveHardCeiling, null);
      assert.strictEqual(res.isMateriallyUncertain, true);
      assert.ok(res.disclosures.some(d => d.includes('missing, non-finite, or out-of-range')));
    });

    test('Unverified external ceiling with Infinity ceilingPercent fails closed as materially uncertain', () => {
      const res = resolveEffectiveHardCeiling({
        strategicTarget: 5.0,
        userHardCeilingStatus: 'not_configured',
        externalCeilingStatus: 'unverified',
        verifiedExternalCeiling: {
          ceilingPercent: Infinity,
          sourceAuthority: 'Rumor',
          jurisdiction: 'Unknown',
          scope: 'Fund',
          verificationStatus: 'unverified_third_party',
          measurementBasis: 'percent_of_nav',
          isApplicabilityEstablished: false
        },
        effectiveHardCeiling: null,
        measurementBasis: 'percent_of_nav'
      }, 7.0);

      assert.strictEqual(res.effectiveHardCeiling, null);
      assert.strictEqual(res.isMateriallyUncertain, true);
    });

    test('Unverified external ceiling with negative ceilingPercent fails closed as materially uncertain', () => {
      const res = resolveEffectiveHardCeiling({
        strategicTarget: 5.0,
        userHardCeilingStatus: 'not_configured',
        externalCeilingStatus: 'unverified',
        verifiedExternalCeiling: {
          ceilingPercent: -5.0,
          sourceAuthority: 'Rumor',
          jurisdiction: 'Unknown',
          scope: 'Fund',
          verificationStatus: 'unverified_third_party',
          measurementBasis: 'percent_of_nav',
          isApplicabilityEstablished: false
        },
        effectiveHardCeiling: null,
        measurementBasis: 'percent_of_nav'
      }, 7.0);

      assert.strictEqual(res.effectiveHardCeiling, null);
      assert.strictEqual(res.isMateriallyUncertain, true);
    });

    test('Unverified external ceiling with ceilingPercent > 100 fails closed as materially uncertain', () => {
      const res = resolveEffectiveHardCeiling({
        strategicTarget: 5.0,
        userHardCeilingStatus: 'not_configured',
        externalCeilingStatus: 'unverified',
        verifiedExternalCeiling: {
          ceilingPercent: 120.0,
          sourceAuthority: 'Rumor',
          jurisdiction: 'Unknown',
          scope: 'Fund',
          verificationStatus: 'unverified_third_party',
          measurementBasis: 'percent_of_nav',
          isApplicabilityEstablished: false
        },
        effectiveHardCeiling: null,
        measurementBasis: 'percent_of_nav'
      }, 7.0);

      assert.strictEqual(res.effectiveHardCeiling, null);
      assert.strictEqual(res.isMateriallyUncertain, true);
    });

    test('Unverified external ceiling with undefined verifiedExternalCeiling fails closed as materially uncertain', () => {
      const res = resolveEffectiveHardCeiling({
        strategicTarget: 5.0,
        userHardCeilingStatus: 'not_configured',
        externalCeilingStatus: 'unverified',
        verifiedExternalCeiling: undefined,
        effectiveHardCeiling: null,
        measurementBasis: 'percent_of_nav'
      }, 7.0);

      assert.strictEqual(res.effectiveHardCeiling, null);
      assert.strictEqual(res.isMateriallyUncertain, true);
    });

    test('Unverified external ceiling with valid finite limit that breaches current allocation is materially uncertain', () => {
      const res = resolveEffectiveHardCeiling({
        strategicTarget: 5.0,
        userHardCeilingStatus: 'not_configured',
        externalCeilingStatus: 'unverified',
        verifiedExternalCeiling: {
          ceilingPercent: 6.0,
          sourceAuthority: 'Rumor',
          jurisdiction: 'Unknown',
          scope: 'Fund',
          verificationStatus: 'unverified_third_party',
          measurementBasis: 'percent_of_nav',
          isApplicabilityEstablished: false
        },
        effectiveHardCeiling: null,
        measurementBasis: 'percent_of_nav'
      }, 8.0);

      assert.strictEqual(res.effectiveHardCeiling, null);
      assert.strictEqual(res.isMateriallyUncertain, true);
      assert.ok(res.disclosures.some(d => d.includes('exceeds alleged unverified limit')));
    });

    test('Unverified external ceiling with valid finite limit well above current allocation is immaterial', () => {
      const res = resolveEffectiveHardCeiling({
        strategicTarget: 5.0,
        userHardCeilingStatus: 'not_configured',
        externalCeilingStatus: 'unverified',
        verifiedExternalCeiling: {
          ceilingPercent: 15.0,
          sourceAuthority: 'Rumor',
          jurisdiction: 'Unknown',
          scope: 'Fund',
          verificationStatus: 'unverified_third_party',
          measurementBasis: 'percent_of_nav',
          isApplicabilityEstablished: false
        },
        effectiveHardCeiling: null,
        measurementBasis: 'percent_of_nav'
      }, 7.0);

      assert.strictEqual(res.effectiveHardCeiling, null);
      assert.strictEqual(res.isMateriallyUncertain, false);
      assert.ok(res.disclosures.some(d => d.includes('Constraint is currently immaterial')));
    });

    test('Valid absence of limits correctly resolves isMateriallyUncertain: false and allows discretionary rebalancing', () => {
      const res = resolveEffectiveHardCeiling({
        strategicTarget: 5.0,
        toleranceCeiling: 7.5,
        userHardCeilingStatus: 'not_configured',
        externalCeilingStatus: 'not_applicable',
        effectiveHardCeiling: null,
        measurementBasis: 'percent_of_nav'
      }, 6.0);

      assert.strictEqual(res.effectiveHardCeiling, null);
      assert.strictEqual(res.governingLimitType, 'none');
      assert.strictEqual(res.isMateriallyUncertain, false);
      assert.ok(res.disclosures.some(d => d.includes('Proceeding to ordinary discretionary rebalancing')));
    });
  });

  /* =========================================================================
     13. Targeted Correctness Remediation: Item 5 - End-to-End Financial Invariants
     ========================================================================= */

  describe('Item 5: End-to-End Financial Invariants', () => {
    test('End-to-end financial invariants hold across discretionary realization and reinvestment', () => {
      const portfolioTotalValue = 1000000;
      const holdingMarketValue = 90000;
      const costBasisTotal = 50000;
      const currentAllocationPercent = 9.0;
      const strategicTarget = 6.0;
      const toleranceCeiling = 8.0;

      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'INVARIANT-TEST-01',
        holdingName: 'Invariant Compounder Inc',
        assetCategory: 'equity',
        currentMarketValue: holdingMarketValue,
        costBasisTotal,
        portfolioTotalValue,
        currentAllocationPercent,
        limitHierarchy: {
          strategicTarget,
          toleranceCeiling,
          userHardCeilingStatus: 'not_configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: null,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        valuationFavorable: false,
        valuationAssessmentTimestamp: '2026-09-15',
        asOfDate: '2026-10-22',
        costModel: {
          capitalGainsTaxRateEstimate: 0.20,
          transactionFeeEstimateRate: 0.0010,
          estimatedSpreadRate: 0.0015,
          currency: 'USD'
        },
        reinvestmentCandidates: [
          {
            candidateId: 'CAND-VALUE-01',
            holdingName: 'Deep Value Leader',
            assetCategory: 'equity',
            currentAllocationPercent: 2.0,
            targetAllocationPercent: 5.0,
            thesisStatus: 'intact',
            valuationFavorable: true,
            valuationAssessmentTimestamp: '2026-09-15',
            valuationMetricsCount: 4,
            evidenceQuality: 'verified_fresh',
            verificationStatus: 'verified_primary',
            traceableEvidenceIds: ['EVID-SEC-10Q']
          }
        ]
      };

      const result = evaluateProfitRealization(input);
      assert.strictEqual(result.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION');

      const grossTrim = result.suggestedAmount.suggestedGrossCapitalValue!;
      const friction = result.suggestedAmount.frictionBreakdown!;
      const reinvestment = result.reinvestmentAssessment;

      assert.ok(grossTrim <= holdingMarketValue, 'Gross trim must not exceed position market value');
      assert.ok(grossTrim > 0, 'Gross trim must be positive');
      assert.ok(friction.allocatedCostBasis <= costBasisTotal, 'Allocated basis must not exceed total position cost basis');
      assert.ok(friction.estimatedNetProceeds <= grossTrim, 'Net proceeds must be less than or equal to gross transaction amount');
      assert.ok(friction.estimatedNetProceeds >= 0, 'Net proceeds must be non-negative');
      assert.ok(reinvestment.allocatedNetProceedsCurrency <= friction.estimatedNetProceeds, 'Candidate allocation must not exceed net proceeds');

      const candidateDeficit = (3.0 / 100) * portfolioTotalValue;
      assert.ok(reinvestment.allocatedNetProceedsCurrency <= candidateDeficit, 'Candidate allocation must not exceed target deficit');

      const totalProceedsAccounted = Number((reinvestment.allocatedNetProceedsCurrency + reinvestment.unallocatedNetProceedsToCash).toFixed(2));
      assert.strictEqual(totalProceedsAccounted, friction.estimatedNetProceeds, 'Proceeds accounting must be conserved: allocated + cash == net proceeds');
      assert.strictEqual(result.complianceContext.coreEngineDecisionComparison.automatedTradeExecutionBlocked, true);
    });

    test('End-to-end financial invariants hold across hard concentration limit breach', () => {
      const portfolioTotalValue = 1000000;
      const holdingMarketValue = 150000;
      const costBasisTotal = 80000;
      const currentAllocationPercent = 15.0;
      const hardCeiling = 10.0;

      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'HARD-BREACH-INVARIANT',
        holdingName: 'Over-Concentrated Leader',
        assetCategory: 'equity',
        currentMarketValue: holdingMarketValue,
        costBasisTotal,
        portfolioTotalValue,
        currentAllocationPercent,
        limitHierarchy: {
          strategicTarget: 6.0,
          toleranceCeiling: 8.0,
          userHardCeiling: hardCeiling,
          userHardCeilingStatus: 'configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: hardCeiling,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        asOfDate: '2026-10-22',
        costModel: {
          capitalGainsTaxRateEstimate: 0.20,
          transactionFeeEstimateRate: 0.0010,
          estimatedSpreadRate: 0.0015
        },
        reinvestmentCandidates: [
          {
            candidateId: 'CAND-DEFICIT-SMALL',
            holdingName: 'Small Deficit Asset',
            assetCategory: 'equity',
            currentAllocationPercent: 4.0,
            targetAllocationPercent: 5.0,
            thesisStatus: 'intact',
            valuationFavorable: true,
            valuationAssessmentTimestamp: '2026-09-15',
            valuationMetricsCount: 3,
            evidenceQuality: 'verified_fresh',
            verificationStatus: 'verified_primary',
            traceableEvidenceIds: ['EVID-10Q-PRIMARY']
          }
        ]
      };

      const result = evaluateProfitRealization(input);
      assert.strictEqual(result.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION');
      assert.strictEqual(result.suggestedAmount.amountType, 'TRIM_TO_EFFECTIVE_HARD_CEILING');

      const grossTrim = result.suggestedAmount.suggestedGrossCapitalValue!;
      const friction = result.suggestedAmount.frictionBreakdown!;
      const reinvestment = result.reinvestmentAssessment;

      assert.strictEqual(grossTrim, 50000);
      assert.ok(grossTrim <= holdingMarketValue);
      assert.ok(friction.allocatedCostBasis <= costBasisTotal);
      assert.ok(friction.estimatedNetProceeds <= grossTrim);
      assert.strictEqual(reinvestment.allocatedNetProceedsCurrency, 10000);
      assert.ok(reinvestment.unallocatedNetProceedsToCash > 0);
      assert.strictEqual(
        Number((reinvestment.allocatedNetProceedsCurrency + reinvestment.unallocatedNetProceedsToCash).toFixed(2)),
        friction.estimatedNetProceeds
      );
      assert.strictEqual(result.complianceContext.coreEngineDecisionComparison.automatedTradeExecutionBlocked, true);
    });

    test('Preserves Core Engine decision boundaries: SELL on broken thesis cannot be overridden', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'BROKEN-THESIS',
        holdingName: 'Broken Fundamental Asset',
        assetCategory: 'equity',
        currentMarketValue: 120000,
        costBasisTotal: 50000,
        portfolioTotalValue: 1000000,
        currentAllocationPercent: 12.0,
        limitHierarchy: {
          strategicTarget: 5.0,
          toleranceCeiling: 7.0,
          userHardCeilingStatus: 'not_configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: null,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'materially_invalidated',
        evidenceQuality: 'verified_fresh',
        asOfDate: '2026-10-22'
      };

      const result = evaluateProfitRealization(input);
      assert.strictEqual(result.realizationAssessment, 'INSUFFICIENT_EVIDENCE');
      assert.strictEqual(result.complianceContext.coreEngineDecisionComparison.coreEngineDecision, 'SELL');
      assert.strictEqual(result.complianceContext.coreEngineDecisionComparison.isAligned, false);
      assert.ok(result.realizationRationale.includes('Core Engine Rule 5 SELL liquidation'));
    });

    test('Preserves Core Engine decision boundaries: REDUCE on loss position yields to core risk mandate', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'LOSS-COMPLIANCE',
        holdingName: 'Loss Position Compliance Breach',
        assetCategory: 'equity',
        currentMarketValue: 120000,
        costBasisTotal: 150000,
        portfolioTotalValue: 1000000,
        currentAllocationPercent: 12.0,
        limitHierarchy: {
          strategicTarget: 5.0,
          toleranceCeiling: 7.0,
          userHardCeiling: 10.0,
          userHardCeilingStatus: 'configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: 10.0,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        asOfDate: '2026-10-22'
      };

      const result = evaluateProfitRealization(input);
      assert.strictEqual(result.realizationAssessment, 'YIELD_TO_RISK_REDUCTION');
      assert.strictEqual(result.suggestedAmount.amountType, 'NO_SALE');
      assert.strictEqual(result.complianceContext.coreEngineDecisionComparison.coreEngineDecision, 'REDUCE');
      assert.strictEqual(result.complianceContext.isHoldingInProfit, false);
      assert.ok(result.realizationRationale.includes('Core Decision Engine Rule 3, NOT profit realization'));
    });
  });

  /* =========================================================================
     14. Final Targeted Input-Validation Pass: maxFreshDays Validation
     ========================================================================= */

  describe('Item 1: maxFreshDays Validation in validateDateFreshness', () => {
    const asOfStr = '2026-10-22T00:00:00.000Z';
    const validDateStr = '2026-10-15T00:00:00.000Z';

    test('Negative maxFreshDays is rejected with explicit invalid result', () => {
      const res = validateDateFreshness(validDateStr, -1, asOfStr);
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(res.isFresh, false);
      assert.strictEqual(res.daysElapsed, Infinity);
      assert.ok(res.reason?.includes('maxFreshDays must be a non-negative finite number'));

      const resLargeNeg = validateDateFreshness(validDateStr, -180, asOfStr);
      assert.strictEqual(resLargeNeg.isValid, false);
      assert.ok(resLargeNeg.reason?.includes('-180'));
    });

    test('NaN maxFreshDays is rejected with explicit invalid result', () => {
      const res = validateDateFreshness(validDateStr, NaN, asOfStr);
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(res.isFresh, false);
      assert.strictEqual(res.daysElapsed, Infinity);
      assert.ok(res.reason?.includes('maxFreshDays must be a non-negative finite number'));
    });

    test('Infinity maxFreshDays is rejected with explicit invalid result', () => {
      const res = validateDateFreshness(validDateStr, Infinity, asOfStr);
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(res.isFresh, false);
      assert.strictEqual(res.daysElapsed, Infinity);
      assert.ok(res.reason?.includes('maxFreshDays must be a non-negative finite number'));

      const resNegInf = validateDateFreshness(validDateStr, -Infinity, asOfStr);
      assert.strictEqual(resNegInf.isValid, false);
    });

    test('Non-numeric maxFreshDays is rejected with explicit invalid result', () => {
      const res = validateDateFreshness(validDateStr, undefined as any, asOfStr);
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(res.isFresh, false);
      assert.ok(res.reason?.includes('maxFreshDays must be a non-negative finite number'));
    });

    test('Valid zero-day threshold (maxFreshDays: 0) works correctly with millisecond semantics', () => {
      // Exactly identical timestamp to asOfDate -> 0ms elapsed -> fresh under 0-day threshold!
      const resExact = validateDateFreshness(asOfStr, 0, asOfStr);
      assert.strictEqual(resExact.isValid, true);
      assert.strictEqual(resExact.isFresh, true);
      assert.strictEqual(resExact.daysElapsed, 0);
      assert.strictEqual(resExact.reason, undefined);

      // 1 second earlier -> 1000ms elapsed -> stale under 0-day threshold!
      const asOfMs = new Date(asOfStr).getTime();
      const oneSecEarlier = new Date(asOfMs - 1000).toISOString();
      const resOneSec = validateDateFreshness(oneSecEarlier, 0, asOfStr);
      assert.strictEqual(resOneSec.isValid, true);
      assert.strictEqual(resOneSec.isFresh, false);
      assert.ok(resOneSec.reason?.includes('stale'));
    });
  });

  /* =========================================================================
     15. Final Targeted Input-Validation Pass: Reinvestment Input Validation
     ========================================================================= */

  describe('Item 2: Reinvestment Input Validation in evaluateReinvestmentProceeds', () => {
    const validCandidate = {
      candidateId: 'CAND-VALID-01',
      holdingName: 'Valid Candidate Co',
      assetCategory: 'equity' as const,
      currentAllocationPercent: 2.0,
      targetAllocationPercent: 5.0,
      thesisStatus: 'intact' as const,
      valuationFavorable: true,
      valuationAssessmentTimestamp: '2026-09-15',
      valuationMetricsCount: 3,
      evidenceQuality: 'verified_fresh' as const,
      verificationStatus: 'verified_primary' as const,
      traceableEvidenceIds: ['EVID-001']
    };

    test('Invalid portfolioTotalValue (zero, negative, NaN, Infinity) parks proceeds in cash without fabrication', () => {
      // Zero portfolio total
      const resZero = evaluateReinvestmentProceeds({
        netProceeds: 10000,
        candidates: [validCandidate],
        portfolioTotalValue: 0,
        asOfDate: '2026-10-22',
        currency: 'USD'
      });
      assert.strictEqual(resZero.action, 'HOLD_AS_CASH');
      assert.strictEqual(resZero.allocatedNetProceedsCurrency, 0);
      assert.strictEqual(resZero.unallocatedNetProceedsToCash, 10000);
      assert.ok(resZero.rationale.includes('Invalid portfolioTotalValue'));
      assert.strictEqual(resZero.candidateEvaluations[0].qualifiesForCapital, false);

      // Negative portfolio total
      const resNeg = evaluateReinvestmentProceeds({
        netProceeds: 10000,
        candidates: [validCandidate],
        portfolioTotalValue: -500000,
        asOfDate: '2026-10-22',
        currency: 'USD'
      });
      assert.strictEqual(resNeg.action, 'HOLD_AS_CASH');
      assert.strictEqual(resNeg.allocatedNetProceedsCurrency, 0);
      assert.strictEqual(resNeg.unallocatedNetProceedsToCash, 10000);

      // NaN portfolio total
      const resNaN = evaluateReinvestmentProceeds({
        netProceeds: 10000,
        candidates: [validCandidate],
        portfolioTotalValue: NaN,
        asOfDate: '2026-10-22',
        currency: 'USD'
      });
      assert.strictEqual(resNaN.action, 'HOLD_AS_CASH');
      assert.strictEqual(resNaN.allocatedNetProceedsCurrency, 0);
      assert.strictEqual(resNaN.unallocatedNetProceedsToCash, 10000);

      // Infinity portfolio total
      const resInf = evaluateReinvestmentProceeds({
        netProceeds: 10000,
        candidates: [validCandidate],
        portfolioTotalValue: Infinity,
        asOfDate: '2026-10-22',
        currency: 'USD'
      });
      assert.strictEqual(resInf.action, 'HOLD_AS_CASH');
      assert.strictEqual(resInf.allocatedNetProceedsCurrency, 0);
      assert.strictEqual(resInf.unallocatedNetProceedsToCash, 10000);
    });

    test('Candidate with NaN, Infinity, negative, or >100 targetAllocationPercent is disqualified with zero deficit', () => {
      const invalidTargetCandidates = [
        { ...validCandidate, candidateId: 'CAND-NAN-TGT', targetAllocationPercent: NaN },
        { ...validCandidate, candidateId: 'CAND-INF-TGT', targetAllocationPercent: Infinity },
        { ...validCandidate, candidateId: 'CAND-NEG-TGT', targetAllocationPercent: -3.0 },
        { ...validCandidate, candidateId: 'CAND-OVER-TGT', targetAllocationPercent: 125.0 }
      ];

      for (const cand of invalidTargetCandidates) {
        const res = evaluateReinvestmentProceeds({
          netProceeds: 10000,
          candidates: [cand],
          portfolioTotalValue: 1000000,
          asOfDate: '2026-10-22',
          currency: 'USD'
        });

        assert.strictEqual(res.action, 'HOLD_AS_CASH');
        assert.strictEqual(res.allocatedNetProceedsCurrency, 0);
        assert.strictEqual(res.unallocatedNetProceedsToCash, 10000);

        const evalResult = res.candidateEvaluations[0];
        assert.strictEqual(evalResult.qualifiesForCapital, false);
        assert.strictEqual(evalResult.allocationDeficitPercent, 0);
        assert.strictEqual(evalResult.allocationDeficitCurrency, 0);
        assert.ok(evalResult.disqualificationReasons.some(r => r.includes('targetAllocationPercent')));
      }
    });

    test('Candidate with NaN, Infinity, negative, or >100 currentAllocationPercent is disqualified with zero deficit', () => {
      const invalidCurrentCandidates = [
        { ...validCandidate, candidateId: 'CAND-NAN-CURR', currentAllocationPercent: NaN },
        { ...validCandidate, candidateId: 'CAND-INF-CURR', currentAllocationPercent: Infinity },
        { ...validCandidate, candidateId: 'CAND-NEG-CURR', currentAllocationPercent: -2.0 },
        { ...validCandidate, candidateId: 'CAND-OVER-CURR', currentAllocationPercent: 110.0 }
      ];

      for (const cand of invalidCurrentCandidates) {
        const res = evaluateReinvestmentProceeds({
          netProceeds: 10000,
          candidates: [cand],
          portfolioTotalValue: 1000000,
          asOfDate: '2026-10-22',
          currency: 'USD'
        });

        assert.strictEqual(res.action, 'HOLD_AS_CASH');
        assert.strictEqual(res.allocatedNetProceedsCurrency, 0);
        assert.strictEqual(res.unallocatedNetProceedsToCash, 10000);

        const evalResult = res.candidateEvaluations[0];
        assert.strictEqual(evalResult.qualifiesForCapital, false);
        assert.strictEqual(evalResult.allocationDeficitPercent, 0);
        assert.strictEqual(evalResult.allocationDeficitCurrency, 0);
        assert.ok(evalResult.disqualificationReasons.some(r => r.includes('currentAllocationPercent')));
      }
    });

    test('Invalid candidates do not prevent a valid qualified candidate from receiving proceeds', () => {
      const candidates = [
        { ...validCandidate, candidateId: 'CAND-BAD-TGT', targetAllocationPercent: NaN },
        { ...validCandidate, candidateId: 'CAND-BAD-CURR', currentAllocationPercent: -5.0 },
        validCandidate // Target: 5%, Current: 2% -> Deficit: 3% of $1,000,000 = $30,000
      ];

      const res = evaluateReinvestmentProceeds({
        netProceeds: 15000,
        candidates,
        portfolioTotalValue: 1000000,
        asOfDate: '2026-10-22',
        currency: 'USD'
      });

      assert.strictEqual(res.action, 'REINVEST_NET_PROCEEDS');
      assert.strictEqual(res.selectedCandidateId, 'CAND-VALID-01');
      assert.strictEqual(res.allocatedNetProceedsCurrency, 15000);
      assert.strictEqual(res.unallocatedNetProceedsToCash, 0);
      assert.strictEqual(res.candidateEvaluations[0].qualifiesForCapital, false);
      assert.strictEqual(res.candidateEvaluations[1].qualifiesForCapital, false);
      assert.strictEqual(res.candidateEvaluations[2].qualifiesForCapital, true);
    });

    test('Non-finite net proceeds cannot cause NaN or Infinity in allocated or unallocated proceeds', () => {
      const resNaN = evaluateReinvestmentProceeds({
        netProceeds: NaN,
        candidates: [validCandidate],
        portfolioTotalValue: 1000000,
        currency: 'USD'
      });
      assert.strictEqual(resNaN.action, 'HOLD_AS_CASH');
      assert.strictEqual(resNaN.allocatedNetProceedsCurrency, 0);
      assert.strictEqual(resNaN.unallocatedNetProceedsToCash, 0);
      assert.ok(Number.isFinite(resNaN.allocatedNetProceedsCurrency));
      assert.ok(Number.isFinite(resNaN.unallocatedNetProceedsToCash));

      const resInf = evaluateReinvestmentProceeds({
        netProceeds: Infinity,
        candidates: [validCandidate],
        portfolioTotalValue: 1000000,
        currency: 'USD'
      });
      assert.strictEqual(resInf.action, 'HOLD_AS_CASH');
      assert.strictEqual(resInf.allocatedNetProceedsCurrency, 0);
      assert.strictEqual(resInf.unallocatedNetProceedsToCash, 0);
      assert.ok(Number.isFinite(resInf.allocatedNetProceedsCurrency));
      assert.ok(Number.isFinite(resInf.unallocatedNetProceedsToCash));
    });
  });

  /* =========================================================================
     16. Final Targeted Input-Validation Pass: Regression Invariants
     ========================================================================= */

  describe('Item 3: Regression Invariants for Finite Outputs and Cash Conservation', () => {
    test('All numerical outputs remain strictly finite across all engine outputs', () => {
      const input: ProfitRealizationEngineInput = {
        executionMode: 'synthetic_simulation',
        holdingId: 'INVARIANT-HOLDING',
        holdingName: 'Invariant Holding Inc',
        assetCategory: 'equity',
        currentMarketValue: 100000,
        costBasisTotal: 60000,
        portfolioTotalValue: 1000000,
        currentAllocationPercent: 10.0,
        limitHierarchy: {
          strategicTarget: 6.0,
          toleranceCeiling: 8.0,
          userHardCeilingStatus: 'not_configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: null,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        valuationFavorable: false,
        valuationAssessmentTimestamp: '2026-09-15',
        asOfDate: '2026-10-22',
        costModel: {
          capitalGainsTaxRateEstimate: 0.20,
          transactionFeeEstimateRate: 0.0010,
          estimatedSpreadRate: 0.0015
        },
        reinvestmentCandidates: [
          {
            candidateId: 'CAND-INV-01',
            holdingName: 'Invariant Candidate',
            assetCategory: 'equity',
            currentAllocationPercent: 2.0,
            targetAllocationPercent: 5.0, // Deficit: 3% = $30,000
            thesisStatus: 'intact',
            valuationFavorable: true,
            valuationAssessmentTimestamp: '2026-09-15',
            valuationMetricsCount: 3,
            evidenceQuality: 'verified_fresh',
            verificationStatus: 'verified_primary',
            traceableEvidenceIds: ['EVID-INV']
          }
        ]
      };

      const res = evaluateProfitRealization(input);
      assert.strictEqual(res.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION');

      // Gross trim & position outputs
      assert.ok(Number.isFinite(res.suggestedAmount.suggestedProportionOfHolding));
      assert.ok(Number.isFinite(res.suggestedAmount.suggestedGrossCapitalValue!));
      assert.ok(Number.isFinite(res.suggestedAmount.resultingAllocationPercent!));

      // Friction breakdown numbers
      const fb = res.suggestedAmount.frictionBreakdown!;
      assert.ok(Number.isFinite(fb.grossTransactionAmount));
      assert.ok(Number.isFinite(fb.fractionOfPositionRealized));
      assert.ok(Number.isFinite(fb.allocatedCostBasis));
      assert.ok(Number.isFinite(fb.grossRealizedCapitalGain));
      assert.ok(Number.isFinite(fb.estimatedCapitalGainsTax));
      assert.ok(Number.isFinite(fb.estimatedCommissionCosts));
      assert.ok(Number.isFinite(fb.estimatedSpreadCosts));
      assert.ok(Number.isFinite(fb.totalFrictionCosts));
      assert.ok(Number.isFinite(fb.estimatedNetProceeds));
      assert.ok(Number.isFinite(fb.frictionToGainDragRatio));

      // Reinvestment numbers
      const ra = res.reinvestmentAssessment;
      assert.ok(Number.isFinite(ra.allocatedNetProceedsCurrency));
      assert.ok(Number.isFinite(ra.unallocatedNetProceedsToCash));

      // Invariant: Allocated proceeds never exceed net proceeds
      assert.ok(ra.allocatedNetProceedsCurrency <= fb.estimatedNetProceeds);

      // Invariant: Allocated proceeds never exceed candidate deficit
      const candDeficit = (3.0 / 100) * 1000000;
      assert.ok(ra.allocatedNetProceedsCurrency <= candDeficit);

      // Invariant: Cash conservation
      assert.strictEqual(
        Number((ra.allocatedNetProceedsCurrency + ra.unallocatedNetProceedsToCash).toFixed(2)),
        fb.estimatedNetProceeds
      );
    });

    test('Cash conservation holds when candidate deficit is smaller than net proceeds', () => {
      const res = evaluateReinvestmentProceeds({
        netProceeds: 25000,
        portfolioTotalValue: 1000000,
        candidates: [
          {
            candidateId: 'CAND-SMALL-DEFICIT',
            holdingName: 'Small Deficit Holding',
            assetCategory: 'equity',
            currentAllocationPercent: 4.5,
            targetAllocationPercent: 5.0, // Deficit: 0.5% = $5,000 (smaller than $25,000 proceeds!)
            thesisStatus: 'intact',
            valuationFavorable: true,
            valuationAssessmentTimestamp: '2026-09-15',
            valuationMetricsCount: 3,
            evidenceQuality: 'verified_fresh',
            verificationStatus: 'verified_primary',
            traceableEvidenceIds: ['EVID-DEF']
          }
        ],
        asOfDate: '2026-10-22',
        currency: 'USD'
      });

      assert.strictEqual(res.action, 'REINVEST_NET_PROCEEDS');
      assert.strictEqual(res.allocatedNetProceedsCurrency, 5000);
      assert.strictEqual(res.unallocatedNetProceedsToCash, 20000);
      // Conservation check: $5,000 + $20,000 == $25,000
      assert.strictEqual(res.allocatedNetProceedsCurrency + res.unallocatedNetProceedsToCash, 25000);
    });

    test('Cash conservation holds when all candidates are disqualified', () => {
      const res = evaluateReinvestmentProceeds({
        netProceeds: 18500.50,
        portfolioTotalValue: 1000000,
        candidates: [
          {
            candidateId: 'CAND-DISQ',
            holdingName: 'Disqualified Candidate',
            assetCategory: 'equity',
            currentAllocationPercent: 2.0,
            targetAllocationPercent: 5.0,
            thesisStatus: 'materially_invalidated', // Broken thesis
            valuationFavorable: true,
            valuationAssessmentTimestamp: '2026-09-15',
            valuationMetricsCount: 3,
            evidenceQuality: 'verified_fresh',
            verificationStatus: 'verified_primary'
          }
        ],
        asOfDate: '2026-10-22',
        currency: 'USD'
      });

      assert.strictEqual(res.action, 'HOLD_AS_CASH');
      assert.strictEqual(res.allocatedNetProceedsCurrency, 0);
      assert.strictEqual(res.unallocatedNetProceedsToCash, 18500.50);
      assert.strictEqual(res.allocatedNetProceedsCurrency + res.unallocatedNetProceedsToCash, 18500.50);
    });
  });

  /* =========================================================================
     17. Synthetic Friction-Drag Ratio & Threshold Comparison Tests
     ========================================================================= */

  describe('Section 17: Synthetic Friction-Drag Ratio & Threshold Comparison Tests', () => {
    // Standard baseline synthetic portfolio:
    // Portfolio: $1,000,000 NAV
    // Holding: $100,000 Market Value (10.0% allocation)
    // Cost Basis: $50,000 (Position has $50,000 total unrealized gain)
    // Strategic Target: 6.0%, Tolerance Ceiling: 8.0%
    // Overweight excess: 10.0% - 8.0% = 2.0% -> Gross Trim: $20,000
    // Realized fraction: $20,000 / $100,000 = 0.20
    // Allocated basis: 0.20 * $50,000 = $10,000
    // Expected gain on realized tranche: $20,000 - $10,000 = $10,000
    // Fixed transaction fees: 0.10% commission ($20) + 0.15% spread ($30) on $20,000 gross = $50 total
    // Required taxes to hit target ratios (total friction = tax + $50):
    // - 15.00% ratio ($1,500 friction): tax = $1,450 (rate 0.1450)
    // - 20.00% ratio ($2,000 friction): tax = $1,950 (rate 0.1950)
    // - 30.00% ratio ($3,000 friction): tax = $2,950 (rate 0.2950)
    // - 35.00% ratio ($3,500 friction): tax = $3,450 (rate 0.3450)
    // - 45.00% ratio ($4,500 friction): tax = $4,450 (rate 0.4450)
    // - 50.00% ratio ($5,000 friction): tax = $4,950 (rate 0.4950)
    // - 60.00% ratio ($6,000 friction): tax = $5,950 (rate 0.5950)

    function createSyntheticInput(params: {
      taxRate: number;
      threshold: number;
      costBasisTotal?: number;
      currentMarketValue?: number;
      portfolioTotalValue?: number;
      omitCostModel?: boolean;
      customCostModel?: any;
    }): ProfitRealizationEngineInput {
      return {
        executionMode: 'synthetic_simulation',
        holdingId: 'SYNTH-DRAG-HOLDING',
        holdingName: 'Synthetic Drag Review Co',
        assetCategory: 'equity',
        currentMarketValue: 'currentMarketValue' in params ? params.currentMarketValue : 100000,
        costBasisTotal: 'costBasisTotal' in params ? params.costBasisTotal : 50000,
        portfolioTotalValue: 'portfolioTotalValue' in params ? params.portfolioTotalValue : 1000000,
        currentAllocationPercent: 10.0,
        limitHierarchy: {
          strategicTarget: 6.0,
          toleranceCeiling: 8.0,
          userHardCeilingStatus: 'not_configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: null,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        valuationFavorable: false,
        valuationAssessmentTimestamp: '2026-09-15',
        asOfDate: '2026-10-22',
        costModel: params.omitCostModel
          ? undefined
          : params.customCostModel
          ? params.customCostModel
          : {
              capitalGainsTaxRateEstimate: params.taxRate,
              transactionFeeEstimateRate: 0.0010,
              estimatedSpreadRate: 0.0015,
              maxAllowableFrictionDragRatio: params.threshold,
              currency: 'USD'
            },
        reinvestmentCandidates: [
          {
            candidateId: 'CAND-REINVEST-01',
            holdingName: 'Target Compounder Inc',
            assetCategory: 'equity',
            currentAllocationPercent: 2.0,
            targetAllocationPercent: 5.0,
            thesisStatus: 'intact',
            valuationFavorable: true,
            valuationAssessmentTimestamp: '2026-09-15',
            valuationMetricsCount: 3,
            evidenceQuality: 'verified_fresh',
            verificationStatus: 'verified_primary',
            traceableEvidenceIds: ['EVID-REINVEST']
          }
        ]
      };
    }

    /* -----------------------------------------------------------------------
       Subtest A: Denominator Verification (Expected Gain vs Gross Proceeds)
       ----------------------------------------------------------------------- */
    test('Requirement 5: Drag ratio strictly uses expected gain in denominator, not gross sale proceeds', () => {
      const input = createSyntheticInput({ taxRate: 0.1450, threshold: 0.20 });
      const result = evaluateProfitRealization(input);
      const friction = result.suggestedAmount.frictionBreakdown!;

      assert.strictEqual(friction.grossTransactionAmount, 20000);
      assert.strictEqual(friction.grossRealizedCapitalGain, 10000);
      assert.strictEqual(friction.totalFrictionCosts, 1500);

      // Ratio using expected gain: $1,500 / $10,000 = 0.1500 (15.00%)
      assert.strictEqual(friction.frictionToGainDragRatio, 0.15);

      // If incorrectly divided by gross proceeds: $1,500 / $20,000 = 0.0750 (7.50%)
      const erroneousGrossRatio = Number((friction.totalFrictionCosts / friction.grossTransactionAmount).toFixed(4));
      assert.strictEqual(erroneousGrossRatio, 0.075);
      assert.notStrictEqual(friction.frictionToGainDragRatio, erroneousGrossRatio);
      assert.strictEqual(
        friction.frictionToGainDragRatio,
        Number((friction.totalFrictionCosts / friction.grossRealizedCapitalGain).toFixed(4))
      );
    });

    /* -----------------------------------------------------------------------
       Subtest B: Threshold Comparison Matrix (20%, 35%, 50% across 15%, 30%, 45%, 60%)
       ----------------------------------------------------------------------- */
    describe('Requirements 2, 3 & 4: Multi-Threshold Matrix and Exact Boundary Cases', () => {
      // 15% Drag Ratio ($1,500 friction / $10,000 gain)
      test('Ratio 15%: Eligible at 20%, 35%, and 50% thresholds', () => {
        const input20 = createSyntheticInput({ taxRate: 0.1450, threshold: 0.20 });
        const res20 = evaluateProfitRealization(input20);
        assert.strictEqual(res20.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION');
        assert.strictEqual(res20.suggestedAmount.suggestedGrossCapitalValue, 20000);

        const input35 = createSyntheticInput({ taxRate: 0.1450, threshold: 0.35 });
        const res35 = evaluateProfitRealization(input35);
        assert.strictEqual(res35.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION');

        const input50 = createSyntheticInput({ taxRate: 0.1450, threshold: 0.50 });
        const res50 = evaluateProfitRealization(input50);
        assert.strictEqual(res50.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION');
      });

      // 30% Drag Ratio ($3,000 friction / $10,000 gain)
      test('Ratio 30%: Rejected at 20% threshold, Eligible at 35% and 50% thresholds', () => {
        const input20 = createSyntheticInput({ taxRate: 0.2950, threshold: 0.20 });
        const res20 = evaluateProfitRealization(input20);
        assert.strictEqual(res20.realizationAssessment, 'NO_ACTION');
        assert.strictEqual(res20.suggestedAmount.amountType, 'NO_SALE');
        assert.ok(res20.realizationRationale.includes('Friction Gate Rejected'));

        const input35 = createSyntheticInput({ taxRate: 0.2950, threshold: 0.35 });
        const res35 = evaluateProfitRealization(input35);
        assert.strictEqual(res35.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION');

        const input50 = createSyntheticInput({ taxRate: 0.2950, threshold: 0.50 });
        const res50 = evaluateProfitRealization(input50);
        assert.strictEqual(res50.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION');
      });

      // 45% Drag Ratio ($4,500 friction / $10,000 gain)
      test('Ratio 45%: Rejected at 20% and 35% thresholds, Eligible at 50% threshold', () => {
        const input20 = createSyntheticInput({ taxRate: 0.4450, threshold: 0.20 });
        const res20 = evaluateProfitRealization(input20);
        assert.strictEqual(res20.realizationAssessment, 'NO_ACTION');

        const input35 = createSyntheticInput({ taxRate: 0.4450, threshold: 0.35 });
        const res35 = evaluateProfitRealization(input35);
        assert.strictEqual(res35.realizationAssessment, 'NO_ACTION');
        assert.strictEqual(res35.suggestedAmount.amountType, 'NO_SALE');

        const input50 = createSyntheticInput({ taxRate: 0.4450, threshold: 0.50 });
        const res50 = evaluateProfitRealization(input50);
        assert.strictEqual(res50.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION');
      });

      // 60% Drag Ratio ($6,000 friction / $10,000 gain)
      test('Ratio 60%: Rejected at all three thresholds (20%, 35%, 50%)', () => {
        const input20 = createSyntheticInput({ taxRate: 0.5950, threshold: 0.20 });
        const res20 = evaluateProfitRealization(input20);
        assert.strictEqual(res20.realizationAssessment, 'NO_ACTION');

        const input35 = createSyntheticInput({ taxRate: 0.5950, threshold: 0.35 });
        const res35 = evaluateProfitRealization(input35);
        assert.strictEqual(res35.realizationAssessment, 'NO_ACTION');

        const input50 = createSyntheticInput({ taxRate: 0.5950, threshold: 0.50 });
        const res50 = evaluateProfitRealization(input50);
        assert.strictEqual(res50.realizationAssessment, 'NO_ACTION');
      });

      // Exact Boundary Cases: dragRatio == threshold (passes because rule is strictly `>`)
      test('Exact Boundary Cases: dragRatio exactly equals threshold (20%, 35%, 50%) -> Eligible', () => {
        // Boundary 1: Ratio 20.00% at Threshold 20%
        const inputB20 = createSyntheticInput({ taxRate: 0.1950, threshold: 0.20 });
        const resB20 = evaluateProfitRealization(inputB20);
        assert.strictEqual(resB20.suggestedAmount.frictionBreakdown!.frictionToGainDragRatio, 0.20);
        assert.strictEqual(resB20.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION');

        // Boundary 2: Ratio 35.00% at Threshold 35%
        const inputB35 = createSyntheticInput({ taxRate: 0.3450, threshold: 0.35 });
        const resB35 = evaluateProfitRealization(inputB35);
        assert.strictEqual(resB35.suggestedAmount.frictionBreakdown!.frictionToGainDragRatio, 0.35);
        assert.strictEqual(resB35.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION');

        // Boundary 3: Ratio 50.00% at Threshold 50%
        const inputB50 = createSyntheticInput({ taxRate: 0.4950, threshold: 0.50 });
        const resB50 = evaluateProfitRealization(inputB50);
        assert.strictEqual(resB50.suggestedAmount.frictionBreakdown!.frictionToGainDragRatio, 0.50);
        assert.strictEqual(resB50.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION');
      });
    });

    /* -----------------------------------------------------------------------
       Subtest C: Zero or Negative Expected Gain, Invalid Costs, and Missing Inputs
       ----------------------------------------------------------------------- */
    describe('Requirement 6: Zero/Negative Gain, Invalid Costs, and Missing Inputs Fail-Safe Contract', () => {
      test('Zero expected gain: Holding at cost basis ($0 gain) yields NO_ACTION and 0 drag ratio', () => {
        const inputZeroGain = createSyntheticInput({
          taxRate: 0.20,
          threshold: 0.35,
          costBasisTotal: 100000
        });
        const res = evaluateProfitRealization(inputZeroGain);
        assert.strictEqual(res.realizationAssessment, 'NO_ACTION');
        assert.strictEqual(res.complianceContext.isHoldingInProfit, false);
        assert.strictEqual(res.complianceContext.unrealizedGainCurrency, 0);
        assert.ok(res.realizationRationale.includes('has no unrealized capital gain'));

        const fbZero = calculateFrictionBreakdown({
          grossTransactionAmount: 20000,
          totalMarketValue: 100000,
          costBasisTotal: 100000
        });
        assert.strictEqual(fbZero.grossRealizedCapitalGain, 0);
        assert.strictEqual(fbZero.frictionToGainDragRatio, 0);
      });

      test('Negative expected gain: Holding at unrealized loss yields NO_ACTION without selling at a loss', () => {
        const inputLoss = createSyntheticInput({
          taxRate: 0.20,
          threshold: 0.35,
          costBasisTotal: 120000
        });
        const res = evaluateProfitRealization(inputLoss);
        assert.strictEqual(res.realizationAssessment, 'NO_ACTION');
        assert.strictEqual(res.complianceContext.isHoldingInProfit, false);
        assert.strictEqual(res.complianceContext.unrealizedGainCurrency, -20000);
        assert.ok(res.realizationRationale.includes('violates fiduciary rebalancing rules'));

        const fbLoss = calculateFrictionBreakdown({
          grossTransactionAmount: 20000,
          totalMarketValue: 100000,
          costBasisTotal: 120000
        });
        assert.strictEqual(fbLoss.grossRealizedCapitalGain, -4000);
        assert.strictEqual(fbLoss.frictionToGainDragRatio, 0);
      });

      test('Invalid cost inputs fail closed with INSUFFICIENT_EVIDENCE', () => {
        const resNegTax = evaluateProfitRealization(createSyntheticInput({
          taxRate: -0.10,
          threshold: 0.35
        }));
        assert.strictEqual(resNegTax.realizationAssessment, 'INSUFFICIENT_EVIDENCE');
        assert.ok(resNegTax.missingDataReasons?.some(r => r.includes('capitalGainsTaxRateEstimate')));

        const resOverTax = evaluateProfitRealization(createSyntheticInput({
          taxRate: 1.25,
          threshold: 0.35
        }));
        assert.strictEqual(resOverTax.realizationAssessment, 'INSUFFICIENT_EVIDENCE');

        const resNegThresh = evaluateProfitRealization(createSyntheticInput({
          taxRate: 0.20,
          threshold: -0.20
        }));
        assert.strictEqual(resNegThresh.realizationAssessment, 'INSUFFICIENT_EVIDENCE');
        assert.ok(resNegThresh.missingDataReasons?.some(r => r.includes('maxAllowableFrictionDragRatio')));

        const resNaNThresh = evaluateProfitRealization(createSyntheticInput({
          taxRate: 0.20,
          threshold: NaN
        }));
        assert.strictEqual(resNaNThresh.realizationAssessment, 'INSUFFICIENT_EVIDENCE');

        const resOverFriction = evaluateProfitRealization(createSyntheticInput({
          taxRate: 0.40,
          threshold: 0.50,
          customCostModel: {
            capitalGainsTaxRateEstimate: 0.40,
            transactionFeeEstimateRate: 0.45,
            estimatedSpreadRate: 0.45
          }
        }));
        assert.strictEqual(resOverFriction.realizationAssessment, 'INSUFFICIENT_EVIDENCE');
        assert.ok(resOverFriction.realizationRationale.includes('Cost model calculation failed'));
      });

      test('Missing inputs fail closed or fall back to safe statutory defaults', () => {
        const inputNoCostModel = createSyntheticInput({
          taxRate: 0.20,
          threshold: 0.35,
          omitCostModel: true
        });
        const resDefault = evaluateProfitRealization(inputNoCostModel);
        assert.strictEqual(resDefault.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION');
        assert.strictEqual(resDefault.suggestedAmount.frictionBreakdown!.frictionToGainDragRatio, 0.205);

        const inputNoBasis = createSyntheticInput({
          taxRate: 0.20,
          threshold: 0.35,
          costBasisTotal: undefined as any
        });
        const resNoBasis = evaluateProfitRealization(inputNoBasis);
        assert.strictEqual(resNoBasis.realizationAssessment, 'INSUFFICIENT_EVIDENCE');
        assert.ok(resNoBasis.missingDataReasons?.some(r => r.includes('costBasisTotal')));

        const inputNoMV = createSyntheticInput({
          taxRate: 0.20,
          threshold: 0.35,
          currentMarketValue: undefined as any
        });
        const resNoMV = evaluateProfitRealization(inputNoMV);
        assert.strictEqual(resNoMV.realizationAssessment, 'INSUFFICIENT_EVIDENCE');
        assert.ok(resNoMV.missingDataReasons?.some(r => r.includes('currentMarketValue')));

        const inputNoPV = createSyntheticInput({
          taxRate: 0.20,
          threshold: 0.35,
          portfolioTotalValue: undefined as any
        });
        const resNoPV = evaluateProfitRealization(inputNoPV);
        assert.strictEqual(resNoPV.realizationAssessment, 'INSUFFICIENT_EVIDENCE');
        assert.ok(resNoPV.missingDataReasons?.some(r => r.includes('portfolioTotalValue')));
      });
    });
  });

  /* =========================================================================
     18. Comprehensive Synthetic Stress Testing Suite
     ========================================================================= */

  describe('Section 18: Comprehensive Synthetic Stress Testing Suite', () => {
    function createStressInput(params: {
      taxRate?: number;
      commissionRate?: number;
      spreadRate?: number;
      threshold?: number;
      currentMarketValue?: number;
      costBasisTotal?: number;
      portfolioTotalValue?: number;
      currentAllocationPercent?: number;
      strategicTarget?: number;
      toleranceCeiling?: number;
      valuationFavorable?: boolean | null;
      currentPrice?: number;
      isFractionalSupported?: boolean;
      customCostModel?: any;
      omitCostModel?: boolean;
    }): ProfitRealizationEngineInput {
      return {
        executionMode: 'synthetic_simulation',
        holdingId: 'SYNTH-STRESS-HOLDING',
        holdingName: 'Synthetic Stress Holdings Ltd',
        assetCategory: 'equity',
        currentMarketValue: 'currentMarketValue' in params ? params.currentMarketValue! : 100000,
        costBasisTotal: 'costBasisTotal' in params ? params.costBasisTotal! : 50000,
        portfolioTotalValue: 'portfolioTotalValue' in params ? params.portfolioTotalValue! : 1000000,
        currentAllocationPercent: 'currentAllocationPercent' in params ? params.currentAllocationPercent! : 10.0,
        currentPrice: params.currentPrice,
        isFractionalSupported: params.isFractionalSupported,
        limitHierarchy: {
          strategicTarget: params.strategicTarget ?? 6.0,
          toleranceCeiling: params.toleranceCeiling ?? 8.0,
          userHardCeilingStatus: 'not_configured',
          externalCeilingStatus: 'not_applicable',
          effectiveHardCeiling: null,
          measurementBasis: 'percent_of_nav'
        },
        thesisStatus: 'intact',
        evidenceQuality: 'verified_fresh',
        valuationFavorable: 'valuationFavorable' in params ? params.valuationFavorable : false,
        valuationAssessmentTimestamp: '2026-09-15',
        asOfDate: '2026-10-22',
        costModel: params.omitCostModel
          ? undefined
          : params.customCostModel
          ? params.customCostModel
          : {
              capitalGainsTaxRateEstimate: params.taxRate ?? 0.20,
              transactionFeeEstimateRate: params.commissionRate ?? 0.0010,
              estimatedSpreadRate: params.spreadRate ?? 0.0015,
              maxAllowableFrictionDragRatio: params.threshold ?? 0.35,
              currency: 'USD'
            },
        reinvestmentCandidates: [
          {
            candidateId: 'CAND-STRESS-01',
            holdingName: 'Stress Reinvest Target',
            assetCategory: 'equity',
            currentAllocationPercent: 2.0,
            targetAllocationPercent: 6.0,
            thesisStatus: 'intact',
            valuationFavorable: true,
            valuationAssessmentTimestamp: '2026-09-15',
            valuationMetricsCount: 3,
            evidenceQuality: 'verified_fresh',
            verificationStatus: 'verified_primary',
            traceableEvidenceIds: ['EVID-STRESS-01']
          }
        ]
      };
    }

    /* -----------------------------------------------------------------------
       1. Expected Gain Sensitivity
       ----------------------------------------------------------------------- */
    describe('1. Expected Gain Sensitivity & Drag Ratio Math', () => {
      test('1.1: Increasing friction relative to expected gain monotonically increases drag ratio for low, medium, and high gain positions', () => {
        // Low expected gain: $2,000 gain ($20,000 trim from $100k MV, $90k basis -> $18k basis allocated)
        const fbLow1 = calculateFrictionBreakdown({
          grossTransactionAmount: 20000,
          totalMarketValue: 100000,
          costBasisTotal: 90000,
          costModel: { capitalGainsTaxRateEstimate: 0.10, transactionFeeEstimateRate: 0.0010, estimatedSpreadRate: 0.0015 }
        });
        const fbLow2 = calculateFrictionBreakdown({
          grossTransactionAmount: 20000,
          totalMarketValue: 100000,
          costBasisTotal: 90000,
          costModel: { capitalGainsTaxRateEstimate: 0.20, transactionFeeEstimateRate: 0.0010, estimatedSpreadRate: 0.0015 }
        });
        const fbLow3 = calculateFrictionBreakdown({
          grossTransactionAmount: 20000,
          totalMarketValue: 100000,
          costBasisTotal: 90000,
          costModel: { capitalGainsTaxRateEstimate: 0.40, transactionFeeEstimateRate: 0.0010, estimatedSpreadRate: 0.0015 }
        });
        assert.strictEqual(fbLow1.grossRealizedCapitalGain, 2000);
        assert.strictEqual(fbLow2.grossRealizedCapitalGain, 2000);
        assert.strictEqual(fbLow3.grossRealizedCapitalGain, 2000);
        assert.strictEqual(fbLow1.totalFrictionCosts, 250); // $200 tax + $20 comm + $30 spread
        assert.strictEqual(fbLow2.totalFrictionCosts, 450); // $400 tax + $20 comm + $30 spread
        assert.strictEqual(fbLow3.totalFrictionCosts, 850); // $800 tax + $20 comm + $30 spread
        assert.strictEqual(fbLow1.frictionToGainDragRatio, 0.125);
        assert.strictEqual(fbLow2.frictionToGainDragRatio, 0.225);
        assert.strictEqual(fbLow3.frictionToGainDragRatio, 0.425);
        assert.ok(fbLow1.frictionToGainDragRatio < fbLow2.frictionToGainDragRatio);
        assert.ok(fbLow2.frictionToGainDragRatio < fbLow3.frictionToGainDragRatio);

        // Medium expected gain: $10,000 gain ($20,000 trim from $100k MV, $50k basis -> $10k basis allocated)
        const fbMed1 = calculateFrictionBreakdown({
          grossTransactionAmount: 20000,
          totalMarketValue: 100000,
          costBasisTotal: 50000,
          costModel: { capitalGainsTaxRateEstimate: 0.10, transactionFeeEstimateRate: 0.0010, estimatedSpreadRate: 0.0015 }
        });
        const fbMed2 = calculateFrictionBreakdown({
          grossTransactionAmount: 20000,
          totalMarketValue: 100000,
          costBasisTotal: 50000,
          costModel: { capitalGainsTaxRateEstimate: 0.20, transactionFeeEstimateRate: 0.0010, estimatedSpreadRate: 0.0015 }
        });
        const fbMed3 = calculateFrictionBreakdown({
          grossTransactionAmount: 20000,
          totalMarketValue: 100000,
          costBasisTotal: 50000,
          costModel: { capitalGainsTaxRateEstimate: 0.35, transactionFeeEstimateRate: 0.0010, estimatedSpreadRate: 0.0015 }
        });
        assert.strictEqual(fbMed1.grossRealizedCapitalGain, 10000);
        assert.strictEqual(fbMed2.grossRealizedCapitalGain, 10000);
        assert.strictEqual(fbMed3.grossRealizedCapitalGain, 10000);
        assert.strictEqual(fbMed1.totalFrictionCosts, 1050); // $1,000 tax + $50 fees
        assert.strictEqual(fbMed2.totalFrictionCosts, 2050); // $2,000 tax + $50 fees
        assert.strictEqual(fbMed3.totalFrictionCosts, 3550); // $3,500 tax + $50 fees
        assert.strictEqual(fbMed1.frictionToGainDragRatio, 0.105);
        assert.strictEqual(fbMed2.frictionToGainDragRatio, 0.205);
        assert.strictEqual(fbMed3.frictionToGainDragRatio, 0.355);
        assert.ok(fbMed1.frictionToGainDragRatio < fbMed2.frictionToGainDragRatio);
        assert.ok(fbMed2.frictionToGainDragRatio < fbMed3.frictionToGainDragRatio);

        // High expected gain: $18,000 gain ($20,000 trim from $100k MV, $10k basis -> $2k basis allocated)
        const fbHigh1 = calculateFrictionBreakdown({
          grossTransactionAmount: 20000,
          totalMarketValue: 100000,
          costBasisTotal: 10000,
          costModel: { capitalGainsTaxRateEstimate: 0.10, transactionFeeEstimateRate: 0.0010, estimatedSpreadRate: 0.0015 }
        });
        const fbHigh2 = calculateFrictionBreakdown({
          grossTransactionAmount: 20000,
          totalMarketValue: 100000,
          costBasisTotal: 10000,
          costModel: { capitalGainsTaxRateEstimate: 0.20, transactionFeeEstimateRate: 0.0010, estimatedSpreadRate: 0.0015 }
        });
        const fbHigh3 = calculateFrictionBreakdown({
          grossTransactionAmount: 20000,
          totalMarketValue: 100000,
          costBasisTotal: 10000,
          costModel: { capitalGainsTaxRateEstimate: 0.35, transactionFeeEstimateRate: 0.0010, estimatedSpreadRate: 0.0015 }
        });
        assert.strictEqual(fbHigh1.grossRealizedCapitalGain, 18000);
        assert.strictEqual(fbHigh2.grossRealizedCapitalGain, 18000);
        assert.strictEqual(fbHigh3.grossRealizedCapitalGain, 18000);
        assert.strictEqual(fbHigh1.totalFrictionCosts, 1850); // $1,800 tax + $50 fees
        assert.strictEqual(fbHigh2.totalFrictionCosts, 3650); // $3,600 tax + $50 fees
        assert.strictEqual(fbHigh3.totalFrictionCosts, 6350); // $6,300 tax + $50 fees
        assert.strictEqual(fbHigh1.frictionToGainDragRatio, 0.1028);
        assert.strictEqual(fbHigh2.frictionToGainDragRatio, 0.2028);
        assert.strictEqual(fbHigh3.frictionToGainDragRatio, 0.3528);
        assert.ok(fbHigh1.frictionToGainDragRatio < fbHigh2.frictionToGainDragRatio);
        assert.ok(fbHigh2.frictionToGainDragRatio < fbHigh3.frictionToGainDragRatio);
      });

      test('1.2: Fixed transaction costs amortize across larger gains under uniform tax rate, reducing drag ratio', () => {
        // Under uniform 20% tax rate and identical $50 transaction fees on $20,000 gross trim:
        // dragRatio = (0.20 * gain + 50) / gain = 0.20 + (50 / gain)
        const lowRes = evaluateProfitRealization(createStressInput({
          taxRate: 0.20,
          costBasisTotal: 90000 // $2,000 gain
        }));
        const medRes = evaluateProfitRealization(createStressInput({
          taxRate: 0.20,
          costBasisTotal: 50000 // $10,000 gain
        }));
        const highRes = evaluateProfitRealization(createStressInput({
          taxRate: 0.20,
          costBasisTotal: 10000 // $18,000 gain
        }));

        const lowRatio = lowRes.suggestedAmount.frictionBreakdown!.frictionToGainDragRatio;
        const medRatio = medRes.suggestedAmount.frictionBreakdown!.frictionToGainDragRatio;
        const highRatio = highRes.suggestedAmount.frictionBreakdown!.frictionToGainDragRatio;

        assert.strictEqual(lowRatio, 0.2250); // 0.20 + 50/2000
        assert.strictEqual(medRatio, 0.2050); // 0.20 + 50/10000
        assert.strictEqual(highRatio, 0.2028); // 0.20 + 50/18000
        assert.ok(lowRatio > medRatio && medRatio > highRatio);
      });

      test('1.3: Higher dollar gain does NOT guarantee lower drag ratio when cost structures differ', () => {
        // High dollar gain ($18,000) under short-term / higher tax rate (0.35)
        const highGainHighTaxRes = evaluateProfitRealization(createStressInput({
          costBasisTotal: 10000,
          taxRate: 0.35,
          threshold: 0.35
        }));
        // Low dollar gain ($2,000) under preferential tax rate (0.10)
        const lowGainLowTaxRes = evaluateProfitRealization(createStressInput({
          costBasisTotal: 90000,
          taxRate: 0.10,
          threshold: 0.35
        }));

        const highRatio = highGainHighTaxRes.suggestedAmount.frictionBreakdown!.frictionToGainDragRatio;
        const lowRatio = lowGainLowTaxRes.suggestedAmount.frictionBreakdown!.frictionToGainDragRatio;

        assert.strictEqual(highRatio, 0.3528);
        assert.strictEqual(lowRatio, 0.1250);

        // Mathematical proof: The $18,000 gain holding has a significantly higher drag ratio than the $2,000 gain holding!
        assert.ok(highRatio > lowRatio);

        // Consequently, the high dollar gain holding fails the 35% hurdle (0.3528 > 0.35) while the low dollar gain clears it!
        assert.strictEqual(highGainHighTaxRes.realizationAssessment, 'NO_ACTION');
        assert.strictEqual(lowGainLowTaxRes.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION');
      });
    });

    /* -----------------------------------------------------------------------
       2. Gross Sale Amount Sensitivity ($5,000, $20,000, $50,000)
       ----------------------------------------------------------------------- */
    describe('2. Gross Sale Amount Sensitivity ($5k, $20k, $50k)', () => {
      test('2.1: Proportional scaling of allocated basis, realized gain, and friction across $5k, $20k, and $50k trims', () => {
        const totalMarketValue = 100000;
        const costBasisTotal = 40000; // 40% basis, 60% gain
        const costModel = {
          capitalGainsTaxRateEstimate: 0.20,
          transactionFeeEstimateRate: 0.0010,
          estimatedSpreadRate: 0.0015,
          maxAllowableFrictionDragRatio: 0.35
        };

        // Case 1: $5,000 trim (5% of holding)
        const fb5k = calculateFrictionBreakdown({
          grossTransactionAmount: 5000,
          totalMarketValue,
          costBasisTotal,
          costModel
        });
        assert.strictEqual(fb5k.fractionOfPositionRealized, 0.05);
        assert.strictEqual(fb5k.allocatedCostBasis, 2000);
        assert.strictEqual(fb5k.grossRealizedCapitalGain, 3000);
        assert.strictEqual(fb5k.estimatedCapitalGainsTax, 600); // 3000 * 0.20
        assert.strictEqual(fb5k.estimatedCommissionCosts, 5); // 5000 * 0.0010
        assert.strictEqual(fb5k.estimatedSpreadCosts, 7.5); // 5000 * 0.0015
        assert.strictEqual(fb5k.totalFrictionCosts, 612.5);
        assert.strictEqual(fb5k.estimatedNetProceeds, 4387.5);
        assert.strictEqual(fb5k.frictionToGainDragRatio, 0.2042);
        // Verify denominator is $3,000 (gain), not $5,000 (gross)
        assert.notStrictEqual(fb5k.frictionToGainDragRatio, Number((fb5k.totalFrictionCosts / fb5k.grossTransactionAmount).toFixed(4)));

        // Case 2: $20,000 trim (20% of holding)
        const fb20k = calculateFrictionBreakdown({
          grossTransactionAmount: 20000,
          totalMarketValue,
          costBasisTotal,
          costModel
        });
        assert.strictEqual(fb20k.fractionOfPositionRealized, 0.20);
        assert.strictEqual(fb20k.allocatedCostBasis, 8000);
        assert.strictEqual(fb20k.grossRealizedCapitalGain, 12000);
        assert.strictEqual(fb20k.estimatedCapitalGainsTax, 2400); // 12000 * 0.20
        assert.strictEqual(fb20k.estimatedCommissionCosts, 20); // 20000 * 0.0010
        assert.strictEqual(fb20k.estimatedSpreadCosts, 30); // 20000 * 0.0015
        assert.strictEqual(fb20k.totalFrictionCosts, 2450);
        assert.strictEqual(fb20k.estimatedNetProceeds, 17550);
        assert.strictEqual(fb20k.frictionToGainDragRatio, 0.2042);
        // Verify denominator is $12,000 (gain), not $20,000 (gross)
        assert.notStrictEqual(fb20k.frictionToGainDragRatio, Number((fb20k.totalFrictionCosts / fb20k.grossTransactionAmount).toFixed(4)));

        // Case 3: $50,000 trim (50% of holding)
        const fb50k = calculateFrictionBreakdown({
          grossTransactionAmount: 50000,
          totalMarketValue,
          costBasisTotal,
          costModel
        });
        assert.strictEqual(fb50k.fractionOfPositionRealized, 0.50);
        assert.strictEqual(fb50k.allocatedCostBasis, 20000);
        assert.strictEqual(fb50k.grossRealizedCapitalGain, 30000);
        assert.strictEqual(fb50k.estimatedCapitalGainsTax, 6000); // 30000 * 0.20
        assert.strictEqual(fb50k.estimatedCommissionCosts, 50); // 50000 * 0.0010
        assert.strictEqual(fb50k.estimatedSpreadCosts, 75); // 50000 * 0.0015
        assert.strictEqual(fb50k.totalFrictionCosts, 6125);
        assert.strictEqual(fb50k.estimatedNetProceeds, 43875);
        assert.strictEqual(fb50k.frictionToGainDragRatio, 0.2042);
        // Verify denominator is $30,000 (gain), not $50,000 (gross)
        assert.notStrictEqual(fb50k.frictionToGainDragRatio, Number((fb50k.totalFrictionCosts / fb50k.grossTransactionAmount).toFixed(4)));
      });

      test('2.2: End-to-end evaluation via evaluateProfitRealization correctly trims $5k, $20k, and $50k', () => {
        // Portfolio: $1,000,000. Tolerance ceiling: 8.0%. Position MV: $100,000, Basis: $40,000.
        // $5,000 trim: 8.5% allocation (0.5% excess = $5,000)
        const res5k = evaluateProfitRealization(createStressInput({
          currentAllocationPercent: 8.5,
          toleranceCeiling: 8.0,
          costBasisTotal: 40000,
          currentMarketValue: 100000
        }));
        assert.strictEqual(res5k.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION');
        assert.strictEqual(res5k.suggestedAmount.suggestedGrossCapitalValue, 5000);
        assert.strictEqual(res5k.suggestedAmount.frictionBreakdown!.allocatedCostBasis, 2000);
        assert.strictEqual(res5k.suggestedAmount.frictionBreakdown!.grossRealizedCapitalGain, 3000);
        assert.strictEqual(res5k.suggestedAmount.frictionBreakdown!.estimatedNetProceeds, 4387.5);

        // $20,000 trim: 10.0% allocation (2.0% excess = $20,000)
        const res20k = evaluateProfitRealization(createStressInput({
          currentAllocationPercent: 10.0,
          toleranceCeiling: 8.0,
          costBasisTotal: 40000,
          currentMarketValue: 100000
        }));
        assert.strictEqual(res20k.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION');
        assert.strictEqual(res20k.suggestedAmount.suggestedGrossCapitalValue, 20000);
        assert.strictEqual(res20k.suggestedAmount.frictionBreakdown!.allocatedCostBasis, 8000);
        assert.strictEqual(res20k.suggestedAmount.frictionBreakdown!.grossRealizedCapitalGain, 12000);
        assert.strictEqual(res20k.suggestedAmount.frictionBreakdown!.estimatedNetProceeds, 17550);

        // $50,000 trim: 13.0% allocation (5.0% excess = $50,000)
        const res50k = evaluateProfitRealization(createStressInput({
          currentAllocationPercent: 13.0,
          toleranceCeiling: 8.0,
          costBasisTotal: 40000,
          currentMarketValue: 100000
        }));
        assert.strictEqual(res50k.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION');
        assert.strictEqual(res50k.suggestedAmount.suggestedGrossCapitalValue, 50000);
        assert.strictEqual(res50k.suggestedAmount.frictionBreakdown!.allocatedCostBasis, 20000);
        assert.strictEqual(res50k.suggestedAmount.frictionBreakdown!.grossRealizedCapitalGain, 30000);
        assert.strictEqual(res50k.suggestedAmount.frictionBreakdown!.estimatedNetProceeds, 43875);
      });

      test('2.3: Position size boundaries: Full position sale ($100,000) succeeds, exceeding position ($100,001) is strictly rejected', () => {
        // Full position sale exactly equal to totalMarketValue ($100,000)
        const fbFull = calculateFrictionBreakdown({
          grossTransactionAmount: 100000,
          totalMarketValue: 100000,
          costBasisTotal: 40000
        });
        assert.strictEqual(fbFull.grossTransactionAmount, 100000);
        assert.strictEqual(fbFull.fractionOfPositionRealized, 1.0);
        assert.strictEqual(fbFull.allocatedCostBasis, 40000);
        assert.strictEqual(fbFull.grossRealizedCapitalGain, 60000);
        assert.ok(fbFull.estimatedNetProceeds > 0);

        // Gross transaction exceeding totalMarketValue ($100,001) throws
        assert.throws(
          () => calculateFrictionBreakdown({
            grossTransactionAmount: 100001,
            totalMarketValue: 100000,
            costBasisTotal: 40000
          }),
          /cannot exceed totalMarketValue/
        );

        // In calculateGrossTrimAmount: Raw excess exceeding holding market value is strictly clamped to holdingMarketValue
        const trimOver = calculateGrossTrimAmount({
          currentAllocationPercent: 25.0,
          thresholdPercent: 8.0,
          portfolioTotalValue: 1000000, // 17% excess = $170,000
          holdingMarketValue: 100000
        });
        assert.strictEqual(trimOver.grossTrimAmount, 100000);
        assert.strictEqual(trimOver.suggestedProportion, 1.0);
        assert.ok(trimOver.grossTrimAmount <= 100000);
      });
    });

    /* -----------------------------------------------------------------------
       3. Cost Composition (Tax-Dominant, Fee-Dominant, Spread-Dominant)
       ----------------------------------------------------------------------- */
    describe('3. Cost Composition (Tax-Dominant, Fee-Dominant, Spread-Dominant)', () => {
      test('3.1: Identical total friction ($3,000 on $10,000 gain) produces identical 0.3000 drag ratio across tax-, fee-, and spread-dominant regimes', () => {
        const grossTransactionAmount = 20000;
        const totalMarketValue = 100000;
        const costBasisTotal = 50000; // $10,000 realized gain

        // Regime 1: Tax-Dominant (tax = $2,950, fees = $50)
        const fbTaxDom = calculateFrictionBreakdown({
          grossTransactionAmount,
          totalMarketValue,
          costBasisTotal,
          costModel: {
            capitalGainsTaxRateEstimate: 0.2950,
            transactionFeeEstimateRate: 0.0010,
            estimatedSpreadRate: 0.0015
          }
        });
        assert.strictEqual(fbTaxDom.estimatedCapitalGainsTax, 2950);
        assert.strictEqual(fbTaxDom.estimatedCommissionCosts, 20);
        assert.strictEqual(fbTaxDom.estimatedSpreadCosts, 30);
        assert.strictEqual(fbTaxDom.totalFrictionCosts, 3000);
        assert.strictEqual(fbTaxDom.estimatedNetProceeds, 17000);
        assert.strictEqual(fbTaxDom.frictionToGainDragRatio, 0.30);

        // Regime 2: Commission-Dominant (tax = $1,000, fee = $1,970, spread = $30)
        const fbCommDom = calculateFrictionBreakdown({
          grossTransactionAmount,
          totalMarketValue,
          costBasisTotal,
          costModel: {
            capitalGainsTaxRateEstimate: 0.1000,
            transactionFeeEstimateRate: 0.0985, // 9.85% of $20,000 = $1,970
            estimatedSpreadRate: 0.0015
          }
        });
        assert.strictEqual(fbCommDom.estimatedCapitalGainsTax, 1000);
        assert.strictEqual(fbCommDom.estimatedCommissionCosts, 1970);
        assert.strictEqual(fbCommDom.estimatedSpreadCosts, 30);
        assert.strictEqual(fbCommDom.totalFrictionCosts, 3000);
        assert.strictEqual(fbCommDom.estimatedNetProceeds, 17000);
        assert.strictEqual(fbCommDom.frictionToGainDragRatio, 0.30);

        // Regime 3: Spread-Dominant (tax = $1,000, fee = $20, spread = $1,980)
        const fbSpreadDom = calculateFrictionBreakdown({
          grossTransactionAmount,
          totalMarketValue,
          costBasisTotal,
          costModel: {
            capitalGainsTaxRateEstimate: 0.1000,
            transactionFeeEstimateRate: 0.0010,
            estimatedSpreadRate: 0.0990 // 9.90% of $20,000 = $1,980
          }
        });
        assert.strictEqual(fbSpreadDom.estimatedCapitalGainsTax, 1000);
        assert.strictEqual(fbSpreadDom.estimatedCommissionCosts, 20);
        assert.strictEqual(fbSpreadDom.estimatedSpreadCosts, 1980);
        assert.strictEqual(fbSpreadDom.totalFrictionCosts, 3000);
        assert.strictEqual(fbSpreadDom.estimatedNetProceeds, 17000);
        assert.strictEqual(fbSpreadDom.frictionToGainDragRatio, 0.30);

        // Assert all three regimes have identical total friction and drag ratio
        assert.strictEqual(fbTaxDom.totalFrictionCosts, fbCommDom.totalFrictionCosts);
        assert.strictEqual(fbCommDom.totalFrictionCosts, fbSpreadDom.totalFrictionCosts);
        assert.strictEqual(fbTaxDom.frictionToGainDragRatio, fbCommDom.frictionToGainDragRatio);
        assert.strictEqual(fbCommDom.frictionToGainDragRatio, fbSpreadDom.frictionToGainDragRatio);

        // Test in evaluateProfitRealization: All three qualify at threshold 0.35, all three rejected at threshold 0.25
        for (const [name, model] of [
          ['tax-dominant', { capitalGainsTaxRateEstimate: 0.2950, transactionFeeEstimateRate: 0.0010, estimatedSpreadRate: 0.0015, maxAllowableFrictionDragRatio: 0.35 }],
          ['commission-dominant', { capitalGainsTaxRateEstimate: 0.1000, transactionFeeEstimateRate: 0.0985, estimatedSpreadRate: 0.0015, maxAllowableFrictionDragRatio: 0.35 }],
          ['spread-dominant', { capitalGainsTaxRateEstimate: 0.1000, transactionFeeEstimateRate: 0.0010, estimatedSpreadRate: 0.0990, maxAllowableFrictionDragRatio: 0.35 }]
        ] as const) {
          const resPass = evaluateProfitRealization(createStressInput({ customCostModel: model }));
          assert.strictEqual(resPass.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION', `${name} should pass at 0.35 threshold`);
          assert.strictEqual(resPass.suggestedAmount.frictionBreakdown!.frictionToGainDragRatio, 0.30);

          const modelFail = { ...model, maxAllowableFrictionDragRatio: 0.25 };
          const resFail = evaluateProfitRealization(createStressInput({ customCostModel: modelFail }));
          assert.strictEqual(resFail.realizationAssessment, 'NO_ACTION', `${name} should fail at 0.25 threshold`);
          assert.ok(resFail.realizationRationale.includes('Friction Gate Rejected'));
        }
      });

      test('3.2: Invalid and excessive cost parameters fail closed', () => {
        // Negative commission rate
        assert.throws(
          () => calculateFrictionBreakdown({
            grossTransactionAmount: 20000,
            totalMarketValue: 100000,
            costBasisTotal: 50000,
            costModel: { transactionFeeEstimateRate: -0.01 }
          }),
          /Invalid transactionFeeEstimateRate/
        );

        // Commission rate > 0.50
        assert.throws(
          () => calculateFrictionBreakdown({
            grossTransactionAmount: 20000,
            totalMarketValue: 100000,
            costBasisTotal: 50000,
            costModel: { transactionFeeEstimateRate: 0.55 }
          }),
          /Invalid transactionFeeEstimateRate/
        );

        // Negative spread rate
        assert.throws(
          () => calculateFrictionBreakdown({
            grossTransactionAmount: 20000,
            totalMarketValue: 100000,
            costBasisTotal: 50000,
            costModel: { estimatedSpreadRate: -0.01 }
          }),
          /Invalid estimatedSpreadRate/
        );

        // Spread rate > 0.50
        assert.throws(
          () => calculateFrictionBreakdown({
            grossTransactionAmount: 20000,
            totalMarketValue: 100000,
            costBasisTotal: 50000,
            costModel: { estimatedSpreadRate: 0.55 }
          }),
          /Invalid estimatedSpreadRate/
        );

        // Excessive deductions exceeding gross transaction amount
        assert.throws(
          () => calculateFrictionBreakdown({
            grossTransactionAmount: 20000,
            totalMarketValue: 100000,
            costBasisTotal: 10000, // $18k gain
            costModel: {
              capitalGainsTaxRateEstimate: 0.90, // $16,200 tax
              transactionFeeEstimateRate: 0.25, // $5,000 fee => $21,200 > $20,000
              estimatedSpreadRate: 0.05
            }
          }),
          /Invalid cost deductions: total friction costs/
        );

        // evaluateProfitRealization handles excessive costs gracefully with INSUFFICIENT_EVIDENCE
        const resExcess = evaluateProfitRealization(createStressInput({
          costBasisTotal: 10000,
          customCostModel: {
            capitalGainsTaxRateEstimate: 0.90,
            transactionFeeEstimateRate: 0.25,
            estimatedSpreadRate: 0.05,
            maxAllowableFrictionDragRatio: 0.50
          }
        }));
        assert.strictEqual(resExcess.realizationAssessment, 'INSUFFICIENT_EVIDENCE');
        assert.ok(resExcess.realizationRationale.includes('Cost model calculation failed'));
      });
    });

    /* -----------------------------------------------------------------------
       4. Threshold Boundary Precision (20%, 35%, 50%)
       ----------------------------------------------------------------------- */
    describe('4. Threshold Boundary Precision (20%, 35%, 50%)', () => {
      // In synthetic input with $20k trim, $10k basis, gain is $10,000.
      // Fixed transaction costs = $20 comm + $30 spread = $50.
      // totalFriction = estimatedTax + $50 = (taxRate * 10000) + 50.
      // dragRatio = (taxRate * 10000 + 50) / 10000 = taxRate + 0.0050.

      test('4.1: Threshold 20% precision: just below (0.1999), exactly equal (0.2000), just above (0.2001)', () => {
        // Just below: taxRate 0.1949 -> friction = $1,949 + $50 = $1,999 -> ratio = 0.1999 <= 0.20 -> Eligible
        const resBelow = evaluateProfitRealization(createStressInput({ taxRate: 0.1949, threshold: 0.20 }));
        assert.strictEqual(resBelow.suggestedAmount.frictionBreakdown!.frictionToGainDragRatio, 0.1999);
        assert.strictEqual(resBelow.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION');

        // Exactly equal: taxRate 0.1950 -> friction = $1,950 + $50 = $2,000 -> ratio = 0.2000 <= 0.20 -> Eligible
        const resEqual = evaluateProfitRealization(createStressInput({ taxRate: 0.1950, threshold: 0.20 }));
        assert.strictEqual(resEqual.suggestedAmount.frictionBreakdown!.frictionToGainDragRatio, 0.2000);
        assert.strictEqual(resEqual.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION');

        // Just above: taxRate 0.1951 -> friction = $1,951 + $50 = $2,001 -> ratio = 0.2001 > 0.20 -> Rejected
        const resAbove = evaluateProfitRealization(createStressInput({ taxRate: 0.1951, threshold: 0.20 }));
        assert.strictEqual(resAbove.suggestedAmount.frictionBreakdown!.frictionToGainDragRatio, 0.2001);
        assert.strictEqual(resAbove.realizationAssessment, 'NO_ACTION');
        assert.strictEqual(resAbove.suggestedAmount.amountType, 'NO_SALE');
        assert.ok(resAbove.realizationRationale.includes('Friction Gate Rejected'));
      });

      test('4.2: Threshold 35% precision: just below (0.3499), exactly equal (0.3500), just above (0.3501)', () => {
        // Just below: taxRate 0.3449 -> friction = $3,449 + $50 = $3,499 -> ratio = 0.3499 <= 0.35 -> Eligible
        const resBelow = evaluateProfitRealization(createStressInput({ taxRate: 0.3449, threshold: 0.35 }));
        assert.strictEqual(resBelow.suggestedAmount.frictionBreakdown!.frictionToGainDragRatio, 0.3499);
        assert.strictEqual(resBelow.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION');

        // Exactly equal: taxRate 0.3450 -> friction = $3,450 + $50 = $3,500 -> ratio = 0.3500 <= 0.35 -> Eligible
        const resEqual = evaluateProfitRealization(createStressInput({ taxRate: 0.3450, threshold: 0.35 }));
        assert.strictEqual(resEqual.suggestedAmount.frictionBreakdown!.frictionToGainDragRatio, 0.3500);
        assert.strictEqual(resEqual.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION');

        // Just above: taxRate 0.3451 -> friction = $3,451 + $50 = $3,501 -> ratio = 0.3501 > 0.35 -> Rejected
        const resAbove = evaluateProfitRealization(createStressInput({ taxRate: 0.3451, threshold: 0.35 }));
        assert.strictEqual(resAbove.suggestedAmount.frictionBreakdown!.frictionToGainDragRatio, 0.3501);
        assert.strictEqual(resAbove.realizationAssessment, 'NO_ACTION');
        assert.strictEqual(resAbove.suggestedAmount.amountType, 'NO_SALE');
        assert.ok(resAbove.realizationRationale.includes('Friction Gate Rejected'));
      });

      test('4.3: Threshold 50% precision: just below (0.4999), exactly equal (0.5000), just above (0.5001)', () => {
        // Just below: taxRate 0.4949 -> friction = $4,949 + $50 = $4,999 -> ratio = 0.4999 <= 0.50 -> Eligible
        const resBelow = evaluateProfitRealization(createStressInput({ taxRate: 0.4949, threshold: 0.50 }));
        assert.strictEqual(resBelow.suggestedAmount.frictionBreakdown!.frictionToGainDragRatio, 0.4999);
        assert.strictEqual(resBelow.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION');

        // Exactly equal: taxRate 0.4950 -> friction = $4,950 + $50 = $5,000 -> ratio = 0.5000 <= 0.50 -> Eligible
        const resEqual = evaluateProfitRealization(createStressInput({ taxRate: 0.4950, threshold: 0.50 }));
        assert.strictEqual(resEqual.suggestedAmount.frictionBreakdown!.frictionToGainDragRatio, 0.5000);
        assert.strictEqual(resEqual.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION');

        // Just above: taxRate 0.4951 -> friction = $4,951 + $50 = $5,001 -> ratio = 0.5001 > 0.50 -> Rejected
        const resAbove = evaluateProfitRealization(createStressInput({ taxRate: 0.4951, threshold: 0.50 }));
        assert.strictEqual(resAbove.suggestedAmount.frictionBreakdown!.frictionToGainDragRatio, 0.5001);
        assert.strictEqual(resAbove.realizationAssessment, 'NO_ACTION');
        assert.strictEqual(resAbove.suggestedAmount.amountType, 'NO_SALE');
        assert.ok(resAbove.realizationRationale.includes('Friction Gate Rejected'));
      });
    });

    /* -----------------------------------------------------------------------
       5. Gain and Loss Boundaries
       ----------------------------------------------------------------------- */
    describe('5. Gain and Loss Boundaries (Positive, Zero, Unrealized Loss)', () => {
      test('5.1: Positive gain holding qualifies for multi-factor evaluation', () => {
        const resPos = evaluateProfitRealization(createStressInput({
          currentMarketValue: 100000,
          costBasisTotal: 60000 // $40,000 gain
        }));
        assert.strictEqual(resPos.complianceContext.isHoldingInProfit, true);
        assert.strictEqual(resPos.complianceContext.unrealizedGainCurrency, 40000);
        assert.strictEqual(resPos.realizationAssessment, 'CONSIDER_PARTIAL_REALIZATION');
        assert.strictEqual(resPos.suggestedAmount.suggestedGrossCapitalValue, 20000);
        assert.ok(resPos.suggestedAmount.frictionBreakdown!.grossRealizedCapitalGain > 0);
      });

      test('5.2: Zero gain holding (at cost basis) yields NO_ACTION and 0 drag ratio', () => {
        const resZero = evaluateProfitRealization(createStressInput({
          currentMarketValue: 100000,
          costBasisTotal: 100000 // $0 gain
        }));
        assert.strictEqual(resZero.complianceContext.isHoldingInProfit, false);
        assert.strictEqual(resZero.complianceContext.unrealizedGainCurrency, 0);
        assert.strictEqual(resZero.realizationAssessment, 'NO_ACTION');
        assert.strictEqual(resZero.suggestedAmount.amountType, 'NO_SALE');
        assert.strictEqual(resZero.suggestedAmount.suggestedGrossCapitalValue, 0);
        assert.strictEqual(resZero.suggestedAmount.frictionBreakdown, null);
        assert.ok(resZero.realizationRationale.includes('has no unrealized capital gain'));

        // calculateFrictionBreakdown returns 0 gain and 0 drag ratio
        const fbZero = calculateFrictionBreakdown({
          grossTransactionAmount: 20000,
          totalMarketValue: 100000,
          costBasisTotal: 100000
        });
        assert.strictEqual(fbZero.grossRealizedCapitalGain, 0);
        assert.strictEqual(fbZero.estimatedCapitalGainsTax, 0);
        assert.strictEqual(fbZero.frictionToGainDragRatio, 0);
      });

      test('5.3: Underwater holding (unrealized loss) strictly yields NO_ACTION without realizing capital loss', () => {
        const resLoss = evaluateProfitRealization(createStressInput({
          currentMarketValue: 100000,
          costBasisTotal: 140000 // -$40,000 loss
        }));
        assert.strictEqual(resLoss.complianceContext.isHoldingInProfit, false);
        assert.strictEqual(resLoss.complianceContext.unrealizedGainCurrency, -40000);
        assert.strictEqual(resLoss.realizationAssessment, 'NO_ACTION');
        assert.strictEqual(resLoss.suggestedAmount.amountType, 'NO_SALE');
        assert.strictEqual(resLoss.suggestedAmount.suggestedGrossCapitalValue, 0);
        assert.strictEqual(resLoss.suggestedAmount.frictionBreakdown, null);
        assert.ok(resLoss.realizationRationale.includes('violates fiduciary rebalancing rules'));
        assert.strictEqual(resLoss.reinvestmentAssessment.action, 'HOLD_AS_CASH');
        assert.strictEqual(resLoss.reinvestmentAssessment.allocatedNetProceedsCurrency, 0);

        // calculateFrictionBreakdown with loss yields negative gain, zero tax (never negative tax), and 0 drag ratio
        const fbLoss = calculateFrictionBreakdown({
          grossTransactionAmount: 20000,
          totalMarketValue: 100000,
          costBasisTotal: 140000
        });
        assert.strictEqual(fbLoss.allocatedCostBasis, 28000); // 0.20 * 140,000
        assert.strictEqual(fbLoss.grossRealizedCapitalGain, -8000); // 20,000 - 28,000
        assert.strictEqual(fbLoss.estimatedCapitalGainsTax, 0); // tax strictly 0, never negative
        assert.strictEqual(fbLoss.frictionToGainDragRatio, 0);
        assert.strictEqual(fbLoss.totalFrictionCosts, 50); // only comm $20 + spread $30
        assert.strictEqual(fbLoss.estimatedNetProceeds, 19950); // 20,000 - 50
      });
    });

    /* -----------------------------------------------------------------------
       6. Financial Invariants, Conservation & Rounding
       ----------------------------------------------------------------------- */
    describe('6. Financial Invariants, Conservation & Rounding', () => {
      test('6.1: Strict mathematical identities hold across all friction and net proceeds outputs', () => {
        const trims = [1000, 5000, 20000, 50000, 99999];
        for (const trim of trims) {
          const fb = calculateFrictionBreakdown({
            grossTransactionAmount: trim,
            totalMarketValue: 100000,
            costBasisTotal: 40000,
            costModel: {
              capitalGainsTaxRateEstimate: 0.22,
              transactionFeeEstimateRate: 0.0012,
              estimatedSpreadRate: 0.0018
            }
          });

          // Identity 1: allocatedCostBasis + grossRealizedCapitalGain == grossTransactionAmount (within 1 cent)
          const sumBasisAndGain = Number((fb.allocatedCostBasis + fb.grossRealizedCapitalGain).toFixed(2));
          assert.ok(Math.abs(sumBasisAndGain - fb.grossTransactionAmount) <= 0.01);

          // Identity 2: tax + comm + spread == totalFrictionCosts (within 1 cent)
          const sumFriction = Number((fb.estimatedCapitalGainsTax + fb.estimatedCommissionCosts + fb.estimatedSpreadCosts).toFixed(2));
          assert.ok(Math.abs(sumFriction - fb.totalFrictionCosts) <= 0.01);

          // Identity 3: grossTransactionAmount - totalFrictionCosts == estimatedNetProceeds (within 1 cent)
          const calcNet = Number((fb.grossTransactionAmount - fb.totalFrictionCosts).toFixed(2));
          assert.ok(Math.abs(calcNet - fb.estimatedNetProceeds) <= 0.01);

          // Identity 4: allocatedCostBasis <= costBasisTotal
          assert.ok(fb.allocatedCostBasis <= 40000);

          // Identity 5: totalFrictionCosts <= grossTransactionAmount
          assert.ok(fb.totalFrictionCosts <= fb.grossTransactionAmount);

          // Identity 6: 0 <= estimatedNetProceeds <= grossTransactionAmount
          assert.ok(fb.estimatedNetProceeds >= 0);
          assert.ok(fb.estimatedNetProceeds <= fb.grossTransactionAmount);

          // Invariant 7: All outputs are strictly finite
          assert.ok(Number.isFinite(fb.grossTransactionAmount));
          assert.ok(Number.isFinite(fb.fractionOfPositionRealized));
          assert.ok(Number.isFinite(fb.allocatedCostBasis));
          assert.ok(Number.isFinite(fb.grossRealizedCapitalGain));
          assert.ok(Number.isFinite(fb.estimatedCapitalGainsTax));
          assert.ok(Number.isFinite(fb.estimatedCommissionCosts));
          assert.ok(Number.isFinite(fb.estimatedSpreadCosts));
          assert.ok(Number.isFinite(fb.totalFrictionCosts));
          assert.ok(Number.isFinite(fb.estimatedNetProceeds));
          assert.ok(Number.isFinite(fb.frictionToGainDragRatio));
        }
      });

      test('6.2: Reinvestment proceeds conservation holds exactly', () => {
        const res = evaluateProfitRealization(createStressInput({
          taxRate: 0.20,
          currentAllocationPercent: 10.0,
          toleranceCeiling: 8.0
        }));

        const netProceeds = res.suggestedAmount.frictionBreakdown!.estimatedNetProceeds;
        const allocated = res.reinvestmentAssessment.allocatedNetProceedsCurrency;
        const unallocatedCash = res.reinvestmentAssessment.unallocatedNetProceedsToCash;

        // Conservation: allocated + unallocatedCash == netProceeds (within 1 cent)
        assert.ok(Math.abs(allocated + unallocatedCash - netProceeds) <= 0.01);
        assert.ok(allocated >= 0);
        assert.ok(unallocatedCash >= 0);
        assert.ok(allocated <= netProceeds);
      });

      test('6.3: Discrete-share vs fractional-share rounding maintains compliance and non-negative finite proceeds', () => {
        // Test with price = $350.00, raw trim target = $20,000
        // Discrete units floored: floor(20,000 / 350) = 57 shares -> $19,950.00
        const resDiscrete = evaluateProfitRealization(createStressInput({
          currentPrice: 350.00,
          isFractionalSupported: false,
          currentAllocationPercent: 10.0,
          toleranceCeiling: 8.0
        }));
        assert.strictEqual(resDiscrete.suggestedAmount.discreteUnits, 57);
        assert.strictEqual(resDiscrete.suggestedAmount.suggestedGrossCapitalValue, 19950);
        assert.strictEqual(resDiscrete.suggestedAmount.frictionBreakdown!.grossTransactionAmount, 19950);
        assert.strictEqual(resDiscrete.suggestedAmount.frictionBreakdown!.allocatedCostBasis, 9975); // (19950 / 100000) * 50000
        assert.strictEqual(resDiscrete.suggestedAmount.frictionBreakdown!.grossRealizedCapitalGain, 9975);
        assert.ok(resDiscrete.suggestedAmount.frictionBreakdown!.estimatedNetProceeds > 0);
        assert.strictEqual(resDiscrete.suggestedAmount.isFractionalSupported, false);

        // Fractional units: 20000 / 350 = 57.142857 units -> $20,000.00
        const resFractional = evaluateProfitRealization(createStressInput({
          currentPrice: 350.00,
          isFractionalSupported: true,
          currentAllocationPercent: 10.0,
          toleranceCeiling: 8.0
        }));
        assert.strictEqual(resFractional.suggestedAmount.discreteUnits, 57.142857);
        assert.strictEqual(resFractional.suggestedAmount.suggestedGrossCapitalValue, 20000);
        assert.strictEqual(resFractional.suggestedAmount.frictionBreakdown!.grossTransactionAmount, 20000);
        assert.strictEqual(resFractional.suggestedAmount.isFractionalSupported, true);
      });

      test('6.4: Zero net proceeds boundary (deductions equal gross proceeds) completes safely without error', () => {
        // Zero basis ($10,000 gain on $10,000 gross). Tax rate 0.90 ($9,000), comm 0.05 ($500), spread 0.05 ($500)
        // Total friction = $9,000 + $500 + $500 = $10,000. Net proceeds = $0.00.
        const fbZeroNet = calculateFrictionBreakdown({
          grossTransactionAmount: 10000,
          totalMarketValue: 100000,
          costBasisTotal: 0,
          costModel: {
            capitalGainsTaxRateEstimate: 0.90,
            transactionFeeEstimateRate: 0.05,
            estimatedSpreadRate: 0.05
          }
        });
        assert.strictEqual(fbZeroNet.grossTransactionAmount, 10000);
        assert.strictEqual(fbZeroNet.grossRealizedCapitalGain, 10000);
        assert.strictEqual(fbZeroNet.totalFrictionCosts, 10000);
        assert.strictEqual(fbZeroNet.estimatedNetProceeds, 0);
        assert.strictEqual(fbZeroNet.frictionToGainDragRatio, 1.0);
      });
    });
  });
});


