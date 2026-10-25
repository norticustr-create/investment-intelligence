/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AssetCategory,
  EvidenceFinding,
  FreshnessStatus,
  VerificationStatus,
  ValuationMetric
} from '../types/investment';

/* =========================================================================
   1. Clarified Allocation Limit Hierarchy & Status Types
   ========================================================================= */

export type HardCeilingConfigurationStatus =
  | 'configured'         // Explicitly set with a validated numerical cap
  | 'not_configured'     // Intentionally omitted by user (validly absent)
  | 'not_applicable';    // Established that no policy limit governs this portfolio/asset

export type ExternalCeilingVerificationStatus =
  | 'verified_applicable'// Confirmed primary legal authority governing this portfolio
  | 'not_applicable'     // Confirmed that no external legal limit applies to this asset/account
  | 'unverified'         // Alleged/cited but lacking primary verification or jurisdiction proof
  | 'conflicting';       // Multiple incompatible or contradictory external limit claims

export interface VerifiedExternalCeilingSpec {
  ceilingPercent: number;                 // Numerical cap (e.g. 5.0%)
  sourceAuthority: string;                // e.g. "UCITS Directive 2009/65/EC Art. 52"
  jurisdiction: string;                   // e.g. "European Union / ESMA"
  scope: string;                          // Explicitly defined asset/fund scope
  verificationStatus: VerificationStatus; // Must be 'verified_primary'
  measurementBasis: string;               // e.g. "percent_of_total_portfolio_nav"
  isApplicabilityEstablished: boolean;    // true ONLY if applicable to this specific portfolio
}

export interface AllocationLimitHierarchy {
  strategicTarget: number;                // Baseline target percentage (e.g. 6.0%)
  toleranceCeiling?: number;              // Upper rebalance boundary (e.g. 8.0%)
  
  userHardCeiling?: number;               // Explicit user-configured policy limit (e.g. 10.0%)
  userHardCeilingStatus: HardCeilingConfigurationStatus;

  verifiedExternalCeiling?: VerifiedExternalCeilingSpec;
  externalCeilingStatus: ExternalCeilingVerificationStatus;

  effectiveHardCeiling: number | null;    // Strictest verified limit, or null if validly absent
  measurementBasis: string;               // Unified measurement basis (e.g. "percent_of_nav")
}

/* =========================================================================
   2. Realization Assessment Outputs
   ========================================================================= */

export type RealizationAction =
  | 'NO_ACTION'                      // Default: keep compounding, costs/evidence do not justify trim
  | 'CONSIDER_PARTIAL_REALIZATION'   // Multi-factor justification met for discretionary profit trim
  | 'YIELD_TO_RISK_REDUCTION'        // Hard compliance breach detected; yields jurisdiction to Core Engine REDUCE
  | 'INSUFFICIENT_EVIDENCE';         // Critical inputs missing, stale, conflicting, or materially unverified

export type RealizationAmountType =
  | 'NO_SALE'                        // Zero capital trimmed
  | 'TRIM_TO_TARGET'                 // Trim excess back to baseline target allocation
  | 'TRIM_TO_UPPER_TOLERANCE_BAND'   // Trim back to policy ceiling (preserving runner posture)
  | 'TRIM_TO_EFFECTIVE_HARD_CEILING' // Trim strictly to comply with effectiveHardCeiling
  | 'FIXED_GAIN_FRACTION'            // Realize a bounded portion of unrealized gain
  | 'INSUFFICIENT_EVIDENCE';         // Cannot calculate defensible amount due to missing parameters

export interface RealizationFrictionBreakdown {
  grossTransactionAmount: number;    // T
  fractionOfPositionRealized: number;// f (0.0 to 1.0)
  allocatedCostBasis: number;        // B_realized = f * B
  grossRealizedCapitalGain: number;  // G_realized = T - B_realized
  estimatedCapitalGainsTax: number;  // T_tax
  estimatedCommissionCosts: number;  // T * r_commission
  estimatedSpreadCosts: number;      // T * r_spread
  totalFrictionCosts: number;        // F_total = T_tax + C_trans
  estimatedNetProceeds: number;      // N_proceeds = T - F_total
  frictionToGainDragRatio: number;   // F_total / G_realized
  taxCalculationMethod: string;      // e.g. "Proportional basis allocation, estimated 20% flat rate"
}

export interface RealizationAmountEstimate {
  amountType: RealizationAmountType;
  suggestedProportionOfHolding: number;   // Clamped 0.0 to 1.0
  suggestedGrossCapitalValue: number | null; // In portfolio base currency (null if portfolio value unknown)
  currency: string;
  frictionBreakdown: RealizationFrictionBreakdown | null;
  discreteUnits?: number | null;          // Floored shares or precision-clamped fractional units
  isFractionalSupported?: boolean;
  resultingAllocationPercent?: number;    // Resulting allocation percentage after proposed trim
  isComplianceRestored?: boolean;         // false if discrete rounding leaves position above hard ceiling
  calculationFormula: string;             // Auditable formula string
  derivationSteps: string[];              // Step-by-step arithmetic proof
  limitations: string[];                  // Explicit caveats
}

/* =========================================================================
   3. Reinvestment & Capital Deployment Outputs
   ========================================================================= */

export type ReinvestmentAction =
  | 'REINVEST_NET_PROCEEDS'          // Allocate actual net proceeds (N > 0) to qualified candidate
  | 'HOLD_AS_CASH'                   // Default when no candidate qualifies, N=0, or evidence inadequate
  | 'INSUFFICIENT_EVIDENCE';         // Cannot reliably assess reinvestment universe

export interface ReinvestmentCandidateEvaluation {
  candidateId: string;
  holdingName: string;
  assetCategory: AssetCategory;
  thesisStatus: 'intact' | 'questionable' | 'materially_invalidated';
  currentAllocationPercent: number;
  targetAllocationPercent: number;
  allocationDeficitPercent: number;       // max(0, target - current)
  allocationDeficitCurrency: number | null;
  valuationFavorable: boolean | null;
  valuationMetricsCount: number;
  evidenceFreshness: FreshnessStatus;
  evidenceVerification: VerificationStatus;
  qualifiesForCapital: boolean;
  disqualificationReasons: string[];
  comparativeConvictionScore?: number;
}

export interface ReinvestmentAssessmentResult {
  action: ReinvestmentAction;
  selectedCandidateId: string | null;
  selectedCandidateName: string | null;
  allocatedNetProceedsCurrency: number;   // Amount of net realization proceeds committed
  unallocatedNetProceedsToCash: number;   // Net realization proceeds remaining in cash
  currency: string;
  rationale: string;
  candidateEvaluations: ReinvestmentCandidateEvaluation[];
  cashPreservationRationale?: string;
}

export interface UnallocatedCapitalOpportunity {
  candidateId: string;
  holdingName: string;
  assetCategory: AssetCategory;
  allocationDeficitCurrency: number | null;
  rationale: string;
  eligibleForNewDepositsOrIdleCash: boolean;
}

/* =========================================================================
   4. Configurable Asset-Specific Tolerance & Friction Models
   ========================================================================= */

export interface AssetCategoryTolerancePolicy {
  defaultToleranceBandPercent: number;    // +/- band width around target
  provisionalFreshnessThresholdDays: number;
  freshnessApprovalRequirementNotes: string;
}

export const ASSET_CATEGORY_POLICIES: Record<AssetCategory, AssetCategoryTolerancePolicy> = {
  equity: {
    defaultToleranceBandPercent: 2.5,
    provisionalFreshnessThresholdDays: 180,
    freshnessApprovalRequirementNotes: 'Provisional US Equity standard: 180 days (Statutory 10-Q/10-K cycle).'
  },
  etf: {
    defaultToleranceBandPercent: 2.0,
    provisionalFreshnessThresholdDays: 90,
    freshnessApprovalRequirementNotes: 'Provisional Global ETF standard: 90 days (Quarterly factsheet cycle).'
  },
  turkish_equity: {
    defaultToleranceBandPercent: 3.0,
    provisionalFreshnessThresholdDays: 90,
    freshnessApprovalRequirementNotes: 'Provisional BIST/SPK standard: 90 days (KAP quarterly disclosure cycle).'
  },
  turkish_fund: {
    defaultToleranceBandPercent: 1.5,
    provisionalFreshnessThresholdDays: 60,
    freshnessApprovalRequirementNotes: 'Provisional TEFAS standard: 60 days (Monthly portfolio distribution cycle).'
  },
  bitcoin: {
    defaultToleranceBandPercent: 4.0,
    provisionalFreshnessThresholdDays: 30,
    freshnessApprovalRequirementNotes: 'Provisional Crypto standard: 30 days (Custody / on-chain verification cycle).'
  }
};

export interface RealizationCostModel {
  transactionFeeEstimateRate?: number;     // e.g. 0.001 (0.10% broker commission)
  estimatedSpreadRate?: number;            // e.g. 0.0015 (0.15% bid-ask half-spread)
  capitalGainsTaxRateEstimate?: number;    // e.g. 0.20 (20% statutory rate)
  currency?: string;
  isTaxExemptAccount?: boolean;            // IRA, ISA, BES
  maxAllowableFrictionDragRatio?: number;  // Provisional default: 0.35 (friction cannot consume >35% of gain)
  minimumTransactionThreshold?: number;    // Provisional default: $100.00
}

/* =========================================================================
   5. Module Engine Input & Result Structures
   ========================================================================= */

export interface ProfitRealizationEngineInput {
  executionMode: 'real_decision' | 'synthetic_simulation';

  // Primary holding subject to review
  holdingId: string;
  holdingName: string;
  assetCategory: AssetCategory;
  
  // Position financials (mandatory for amount & friction sizing)
  currentMarketValue?: number;
  costBasisTotal?: number;
  unrealizedGainCurrency?: number;
  unrealizedGainPercent?: number;
  currentPrice?: number;
  isFractionalSupported?: boolean;

  // Allocation metrics & clarified limit hierarchy
  portfolioTotalValue?: number;
  currentAllocationPercent?: number;
  limitHierarchy: AllocationLimitHierarchy;

  // Fundamental & Evidence context
  thesisStatus: 'intact' | 'questionable' | 'materially_invalidated';
  evidenceQuality: 'verified_fresh' | 'adequate' | 'stale_or_missing' | 'conflicting';
  traceableEvidenceIds?: string[];
  evidenceRecords?: EvidenceFinding[];

  // Valuation context
  valuationFavorable?: boolean | null;
  valuationMetrics?: ValuationMetric[];
  valuationAssessmentTimestamp?: string;

  // Concentration and risk constraints
  hasDocumentedRiskConcern?: boolean;
  traceableRiskEvidenceIds?: string[];

  // Friction parameters
  costModel?: RealizationCostModel;

  // Optional candidate universe
  reinvestmentCandidates?: {
    candidateId: string;
    holdingName: string;
    assetCategory: AssetCategory;
    currentAllocationPercent: number;
    targetAllocationPercent: number;
    thesisStatus: 'intact' | 'questionable' | 'materially_invalidated';
    valuationFavorable: boolean | null;
    valuationAssessmentTimestamp?: string;
    valuationMetricsCount: number;
    evidenceQuality: 'verified_fresh' | 'adequate' | 'stale_or_missing' | 'conflicting';
    evidenceRecords?: EvidenceFinding[];
    traceableEvidenceIds?: string[];
    verificationStatus?: VerificationStatus;
  }[];

  asOfDate?: string; // Standardized evaluation anchor date (e.g. 2026-10-22)
}

export interface ProfitRealizationEngineResult {
  // A. Realization assessment
  realizationAssessment: RealizationAction;
  realizationRationale: string;
  
  // B. Suggested realization amount
  suggestedAmount: RealizationAmountEstimate;

  // C. Reinvestment assessment (from realization proceeds)
  reinvestmentAssessment: ReinvestmentAssessmentResult;

  // D. Independent opportunities for unallocated idle cash / new deposits
  unallocatedCapitalOpportunities: UnallocatedCapitalOpportunity[];

  // E. Compliance and dual-reporting boundary context
  complianceContext: {
    isHardLimitBreached: boolean;
    governingHardCeiling: number | null;
    governingLimitType: 'statutory_regulatory' | 'user_portfolio_policy' | 'none';
    isHoldingInProfit: boolean;
    unrealizedGainCurrency: number;
    coreEngineDecisionComparison: {
      coreEngineDecision: 'HOLD' | 'REDUCE' | 'SELL' | 'INCREASE' | 'INSUFFICIENT_EVIDENCE';
      profitEngineAssessment: RealizationAction;
      isAligned: boolean;
      boundaryNote: string;
      automatedTradeExecutionBlocked: true;
    };
  };

  // Auditing metadata
  appliedDecisionRules: {
    ruleId: string;
    ruleName: string;
    description: string;
    isKeyFactor: boolean;
  }[];
  violationsPrevented: string[];
  missingDataReasons?: string[];
  frictionAnalysisDisclosures: string[];
  isSimulatedDraft: boolean;
}

/* =========================================================================
   6. Deterministic Helper Functions & Validators
   ========================================================================= */

/**
 * Computes calendar days elapsed between two date strings (YYYY-MM-DD).
 */
export function computeDaysElapsed(earlierDateStr: string, asOfDateStr?: string): number {
  if (!earlierDateStr) return Infinity;
  const d1 = new Date(earlierDateStr);
  const d2 = asOfDateStr ? new Date(asOfDateStr) : new Date();
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return Infinity;
  return Math.round(((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) * 10000) / 10000;
}

export interface DateFreshnessValidation {
  isValid: boolean;
  isFresh: boolean;
  daysElapsed: number;
  reason?: string;
}

/**
 * Deterministically validates valuation date freshness against category threshold.
 * Catches missing, malformed, future, and stale dates using precise millisecond elapsed time.
 */
export function validateDateFreshness(
  dateStr: string | undefined,
  maxFreshDays: number,
  asOfDateStr?: string
): DateFreshnessValidation {
  if (typeof maxFreshDays !== 'number' || !Number.isFinite(maxFreshDays) || maxFreshDays < 0) {
    return {
      isValid: false,
      isFresh: false,
      daysElapsed: Infinity,
      reason: `maxFreshDays must be a non-negative finite number, received ${maxFreshDays}.`
    };
  }

  if (!dateStr || typeof dateStr !== 'string' || dateStr.trim() === '') {
    return {
      isValid: false,
      isFresh: false,
      daysElapsed: Infinity,
      reason: 'Valuation assessment timestamp is missing.'
    };
  }

  const parsedDate = new Date(dateStr);
  const asOfDate = asOfDateStr ? new Date(asOfDateStr) : new Date();

  if (isNaN(parsedDate.getTime()) || isNaN(asOfDate.getTime())) {
    return {
      isValid: false,
      isFresh: false,
      daysElapsed: Infinity,
      reason: `Valuation assessment timestamp '${dateStr}' is malformed or invalid.`
    };
  }

  // Future timestamp validation
  if (parsedDate.getTime() > asOfDate.getTime()) {
    return {
      isValid: false,
      isFresh: false,
      daysElapsed: -1,
      reason: `Valuation assessment timestamp '${dateStr}' is in the future relative to asOfDate.`
    };
  }

  const elapsedMs = asOfDate.getTime() - parsedDate.getTime();
  const maxFreshMs = maxFreshDays * 24 * 60 * 60 * 1000;
  const isFresh = elapsedMs <= maxFreshMs;
  const daysElapsed = Math.round((elapsedMs / (1000 * 60 * 60 * 24)) * 10000) / 10000;

  return {
    isValid: true,
    isFresh,
    daysElapsed,
    reason: isFresh ? undefined : `Valuation assessment timestamp is stale (${daysElapsed} days old vs ${maxFreshDays}-day threshold).`
  };
}

export interface EffectiveHardCeilingResolution {
  effectiveHardCeiling: number | null;
  governingLimitType: 'statutory_regulatory' | 'user_portfolio_policy' | 'none';
  isMateriallyUncertain: boolean;
  isIncomparable: boolean;
  disclosures: string[];
}

/**
 * Deterministically resolves the effective hard ceiling from the limit hierarchy.
 * Distinguishes validly absent limits from materially uncertain, contradictory, or incomparable limits.
 */
export function resolveEffectiveHardCeiling(
  hierarchy: AllocationLimitHierarchy,
  currentAllocationPercent?: number
): EffectiveHardCeilingResolution {
  const disclosures: string[] = [];

  if (!hierarchy) {
    return {
      effectiveHardCeiling: null,
      governingLimitType: 'none',
      isMateriallyUncertain: true,
      isIncomparable: false,
      disclosures: ['Limit hierarchy is missing.']
    };
  }

  // Validate userHardCeiling status and value consistency
  if (hierarchy.userHardCeilingStatus === 'configured') {
    if (
      hierarchy.userHardCeiling === undefined ||
      !Number.isFinite(hierarchy.userHardCeiling) ||
      hierarchy.userHardCeiling < 0 ||
      hierarchy.userHardCeiling > 100
    ) {
      disclosures.push(
        `Contradictory user hard ceiling configuration: Status is 'configured' but userHardCeiling is missing, non-finite, or out of range [0, 100] (received ${hierarchy.userHardCeiling}). Cannot treat as valid absence.`
      );
      return {
        effectiveHardCeiling: null,
        governingLimitType: 'none',
        isMateriallyUncertain: true,
        isIncomparable: false,
        disclosures
      };
    }
  } else if (hierarchy.userHardCeilingStatus === 'not_configured' || hierarchy.userHardCeilingStatus === 'not_applicable') {
    if (hierarchy.userHardCeiling !== undefined && hierarchy.userHardCeiling !== null) {
      disclosures.push(
        `Contradictory user hard ceiling configuration: Status is '${hierarchy.userHardCeilingStatus}' but numeric value ${hierarchy.userHardCeiling} was supplied.`
      );
      return {
        effectiveHardCeiling: null,
        governingLimitType: 'none',
        isMateriallyUncertain: true,
        isIncomparable: false,
        disclosures
      };
    }
  } else {
    disclosures.push(`Invalid userHardCeilingStatus: '${hierarchy.userHardCeilingStatus}'.`);
    return {
      effectiveHardCeiling: null,
      governingLimitType: 'none',
      isMateriallyUncertain: true,
      isIncomparable: false,
      disclosures
    };
  }

  // Validate external ceiling status enum and consistency
  if (
    hierarchy.externalCeilingStatus !== 'not_applicable' &&
    hierarchy.externalCeilingStatus !== 'unverified' &&
    hierarchy.externalCeilingStatus !== 'conflicting' &&
    hierarchy.externalCeilingStatus !== 'verified_applicable'
  ) {
    disclosures.push(`Invalid externalCeilingStatus: '${hierarchy.externalCeilingStatus}'.`);
    return {
      effectiveHardCeiling: null,
      governingLimitType: 'none',
      isMateriallyUncertain: true,
      isIncomparable: false,
      disclosures
    };
  }

  if (hierarchy.externalCeilingStatus === 'not_applicable' && hierarchy.verifiedExternalCeiling !== undefined) {
    disclosures.push(
      `Inconsistent external ceiling: Status is 'not_applicable' but verifiedExternalCeiling specification was provided.`
    );
    return {
      effectiveHardCeiling: null,
      governingLimitType: 'none',
      isMateriallyUncertain: true,
      isIncomparable: false,
      disclosures
    };
  }

  // Check external ceiling status and validity
  if (hierarchy.externalCeilingStatus === 'unverified' || hierarchy.externalCeilingStatus === 'conflicting') {
    disclosures.push(
      `External regulatory ceiling status is '${hierarchy.externalCeilingStatus}'. Engine strictly refuses to assume unverified legal requirements.`
    );
    const allegedLimit = hierarchy.verifiedExternalCeiling?.ceilingPercent;
    const isInvalidOrUnbounded =
      allegedLimit === undefined ||
      allegedLimit === null ||
      !Number.isFinite(allegedLimit) ||
      allegedLimit < 0 ||
      allegedLimit > 100;

    let isMateriallyUncertain = false;
    if (hierarchy.externalCeilingStatus === 'conflicting') {
      isMateriallyUncertain = true;
      disclosures.push('Conflicting external ceiling claims require human legal resolution.');
    } else if (isInvalidOrUnbounded) {
      isMateriallyUncertain = true;
      disclosures.push(
        `Unverified external ceiling claim has missing, non-finite, or out-of-range value (${allegedLimit}). Cannot verify whether constraint is immaterial; failing closed as materially uncertain.`
      );
    } else {
      if (currentAllocationPercent !== undefined && currentAllocationPercent > allegedLimit) {
        isMateriallyUncertain = true;
        disclosures.push(
          `Current allocation (${currentAllocationPercent.toFixed(2)}%) exceeds alleged unverified limit (${allegedLimit.toFixed(2)}%). Material uncertainty halts discretionary execution.`
        );
      } else {
        isMateriallyUncertain = false;
        disclosures.push(
          `Alleged unverified limit (${allegedLimit.toFixed(2)}%) is above current allocation (${currentAllocationPercent !== undefined ? currentAllocationPercent.toFixed(2) + '%' : 'unspecified'}). Constraint is currently immaterial; proceeding with user policy.`
        );
      }
    }

    return {
      effectiveHardCeiling: null,
      governingLimitType: 'none',
      isMateriallyUncertain,
      isIncomparable: false,
      disclosures
    };
  }

  if (hierarchy.externalCeilingStatus === 'verified_applicable') {
    if (
      !hierarchy.verifiedExternalCeiling ||
      !Number.isFinite(hierarchy.verifiedExternalCeiling.ceilingPercent) ||
      hierarchy.verifiedExternalCeiling.ceilingPercent < 0 ||
      hierarchy.verifiedExternalCeiling.ceilingPercent > 100 ||
      hierarchy.verifiedExternalCeiling.verificationStatus !== 'verified_primary' ||
      !hierarchy.verifiedExternalCeiling.isApplicabilityEstablished
    ) {
      disclosures.push(
        'Contradictory external ceiling: Status is verified_applicable, but verifiedExternalCeiling specification is missing, invalid, or lacks verified_primary status and established applicability.'
      );
      return {
        effectiveHardCeiling: null,
        governingLimitType: 'none',
        isMateriallyUncertain: true,
        isIncomparable: false,
        disclosures
      };
    }
  }

  // Collect valid applicable hard limits
  const validLimits: Array<{ ceiling: number; type: 'statutory_regulatory' | 'user_portfolio_policy'; basis: string }> = [];

  if (hierarchy.userHardCeilingStatus === 'configured' && typeof hierarchy.userHardCeiling === 'number') {
    validLimits.push({
      ceiling: hierarchy.userHardCeiling,
      type: 'user_portfolio_policy',
      basis: hierarchy.measurementBasis
    });
  }

  if (
    hierarchy.externalCeilingStatus === 'verified_applicable' &&
    hierarchy.verifiedExternalCeiling &&
    hierarchy.verifiedExternalCeiling.verificationStatus === 'verified_primary' &&
    hierarchy.verifiedExternalCeiling.isApplicabilityEstablished
  ) {
    validLimits.push({
      ceiling: hierarchy.verifiedExternalCeiling.ceilingPercent,
      type: 'statutory_regulatory',
      basis: hierarchy.verifiedExternalCeiling.measurementBasis
    });
  }

  // Incomparable measurement bases check
  if (validLimits.length > 1) {
    const primaryBasis = validLimits[0].basis;
    for (let i = 1; i < validLimits.length; i++) {
      if (validLimits[i].basis !== primaryBasis) {
        disclosures.push(
          `Incomparable measurement bases detected: '${primaryBasis}' vs '${validLimits[i].basis}'. Engine refuses to invent synthetic conversion.`
        );
        return {
          effectiveHardCeiling: null,
          governingLimitType: 'none',
          isMateriallyUncertain: true,
          isIncomparable: true,
          disclosures
        };
      }
    }
  }

  // Valid absence (no hard limits configured/applicable)
  if (validLimits.length === 0) {
    disclosures.push('No hard portfolio limit is configured or applicable. Proceeding to ordinary discretionary rebalancing.');
    return {
      effectiveHardCeiling: null,
      governingLimitType: 'none',
      isMateriallyUncertain: false,
      isIncomparable: false,
      disclosures
    };
  }

  // Resolve strictest limit on same basis
  validLimits.sort((a, b) => a.ceiling - b.ceiling);
  const strictest = validLimits[0];
  disclosures.push(`Effective hard ceiling established at ${strictest.ceiling.toFixed(2)}% (${strictest.type}).`);

  return {
    effectiveHardCeiling: strictest.ceiling,
    governingLimitType: strictest.type,
    isMateriallyUncertain: false,
    isIncomparable: false,
    disclosures
  };
}

/**
 * Computes exact step-by-step transaction friction and net proceeds for a proposed gross sale.
 * Calculates tax on the realized tranche only, not the entire holding.
 * Strictly validates financial and cost parameters.
 */
export function calculateFrictionBreakdown(params: {
  grossTransactionAmount: number;
  totalMarketValue: number;
  costBasisTotal: number;
  costModel?: RealizationCostModel;
}): RealizationFrictionBreakdown {
  const { grossTransactionAmount, totalMarketValue, costBasisTotal, costModel } = params;

  if (!Number.isFinite(grossTransactionAmount) || grossTransactionAmount < 0) {
    throw new Error(`Invalid grossTransactionAmount: must be a non-negative finite number, received ${grossTransactionAmount}`);
  }
  if (!Number.isFinite(totalMarketValue) || totalMarketValue < 0) {
    throw new Error(`Invalid totalMarketValue: must be a non-negative finite number, received ${totalMarketValue}`);
  }
  if (!Number.isFinite(costBasisTotal) || costBasisTotal < 0) {
    throw new Error(`Invalid costBasisTotal: must be a non-negative finite number, received ${costBasisTotal}`);
  }

  if (grossTransactionAmount > totalMarketValue) {
    throw new Error(
      `Invalid grossTransactionAmount: cannot exceed totalMarketValue ($${grossTransactionAmount} > $${totalMarketValue}). Selling more than the existing position is prohibited.`
    );
  }

  if (costModel) {
    if (costModel.capitalGainsTaxRateEstimate !== undefined) {
      if (!Number.isFinite(costModel.capitalGainsTaxRateEstimate) || costModel.capitalGainsTaxRateEstimate < 0 || costModel.capitalGainsTaxRateEstimate > 1.0) {
        throw new Error(`Invalid capitalGainsTaxRateEstimate: must be between 0.0 and 1.0, received ${costModel.capitalGainsTaxRateEstimate}`);
      }
    }
    if (costModel.transactionFeeEstimateRate !== undefined) {
      if (!Number.isFinite(costModel.transactionFeeEstimateRate) || costModel.transactionFeeEstimateRate < 0 || costModel.transactionFeeEstimateRate > 0.50) {
        throw new Error(`Invalid transactionFeeEstimateRate: must be between 0.0 and 0.50, received ${costModel.transactionFeeEstimateRate}`);
      }
    }
    if (costModel.estimatedSpreadRate !== undefined) {
      if (!Number.isFinite(costModel.estimatedSpreadRate) || costModel.estimatedSpreadRate < 0 || costModel.estimatedSpreadRate > 0.50) {
        throw new Error(`Invalid estimatedSpreadRate: must be between 0.0 and 0.50, received ${costModel.estimatedSpreadRate}`);
      }
    }
    if (costModel.maxAllowableFrictionDragRatio !== undefined) {
      if (!Number.isFinite(costModel.maxAllowableFrictionDragRatio) || costModel.maxAllowableFrictionDragRatio < 0) {
        throw new Error(`Invalid maxAllowableFrictionDragRatio: must be a non-negative finite number, received ${costModel.maxAllowableFrictionDragRatio}`);
      }
    }
    if (costModel.minimumTransactionThreshold !== undefined) {
      if (!Number.isFinite(costModel.minimumTransactionThreshold) || costModel.minimumTransactionThreshold < 0) {
        throw new Error(`Invalid minimumTransactionThreshold: must be a non-negative finite number, received ${costModel.minimumTransactionThreshold}`);
      }
    }
  }

  if (totalMarketValue === 0 || grossTransactionAmount === 0) {
    return {
      grossTransactionAmount: 0,
      fractionOfPositionRealized: 0,
      allocatedCostBasis: 0,
      grossRealizedCapitalGain: 0,
      estimatedCapitalGainsTax: 0,
      estimatedCommissionCosts: 0,
      estimatedSpreadCosts: 0,
      totalFrictionCosts: 0,
      estimatedNetProceeds: 0,
      frictionToGainDragRatio: 0,
      taxCalculationMethod: 'Zero transaction value'
    };
  }

  const fractionOfPositionRealized = grossTransactionAmount / totalMarketValue;
  const allocatedCostBasis = Number((fractionOfPositionRealized * costBasisTotal).toFixed(2));
  const grossRealizedCapitalGain = Number((grossTransactionAmount - allocatedCostBasis).toFixed(2));

  const taxRate = costModel?.isTaxExemptAccount
    ? 0
    : costModel?.capitalGainsTaxRateEstimate !== undefined
      ? costModel.capitalGainsTaxRateEstimate
      : 0.20;

  // Never allow negative tax to increase net proceeds!
  const estimatedCapitalGainsTax = grossRealizedCapitalGain > 0 ? Number((grossRealizedCapitalGain * taxRate).toFixed(2)) : 0;

  const commissionRate = costModel?.transactionFeeEstimateRate !== undefined ? costModel.transactionFeeEstimateRate : 0.0010;
  const spreadRate = costModel?.estimatedSpreadRate !== undefined ? costModel.estimatedSpreadRate : 0.0015;

  const estimatedCommissionCosts = Number((grossTransactionAmount * commissionRate).toFixed(2));
  const estimatedSpreadCosts = Number((grossTransactionAmount * spreadRate).toFixed(2));
  const totalFrictionCosts = Number((estimatedCapitalGainsTax + estimatedCommissionCosts + estimatedSpreadCosts).toFixed(2));
  const estimatedNetProceeds = Number((grossTransactionAmount - totalFrictionCosts).toFixed(2));

  if (totalFrictionCosts > grossTransactionAmount || estimatedNetProceeds < 0) {
    throw new Error(
      `Invalid cost deductions: total friction costs ($${totalFrictionCosts.toFixed(2)}) exceed gross proceeds ($${grossTransactionAmount.toFixed(2)}), resulting in impossible negative net proceeds ($${estimatedNetProceeds.toFixed(2)}). Supplied cost model assumptions are invalid.`
    );
  }

  const frictionToGainDragRatio = grossRealizedCapitalGain > 0 ? Number((totalFrictionCosts / grossRealizedCapitalGain).toFixed(4)) : 0.0;

  const taxCalculationMethod = costModel?.isTaxExemptAccount
    ? 'Tax-exempt account (0% capital gains tax)'
    : `Proportional cost basis allocation ($${allocatedCostBasis.toFixed(2)} basis on tranche), estimated ${(taxRate * 100).toFixed(1)}% tax rate`;

  return {
    grossTransactionAmount,
    fractionOfPositionRealized,
    allocatedCostBasis,
    grossRealizedCapitalGain,
    estimatedCapitalGainsTax,
    estimatedCommissionCosts,
    estimatedSpreadCosts,
    totalFrictionCosts,
    estimatedNetProceeds,
    frictionToGainDragRatio,
    taxCalculationMethod
  };
}

/**
 * Calculates clamped gross trim amount and validates whether discrete share rounding restores compliance.
 */
export function calculateGrossTrimAmount(params: {
  currentAllocationPercent: number;
  thresholdPercent: number;
  portfolioTotalValue: number;
  holdingMarketValue: number;
  currentPrice?: number;
  isFractionalSupported?: boolean;
  minimumTransactionThreshold?: number;
  isHardComplianceBreach?: boolean;
}): {
  grossTrimAmount: number;
  suggestedProportion: number;
  discreteUnits: number | null;
  resultingAllocationPercent: number;
  isComplianceRestored: boolean;
  derivationSteps: string[];
  complianceWarning?: string;
} {
  const {
    currentAllocationPercent,
    thresholdPercent,
    portfolioTotalValue,
    holdingMarketValue,
    currentPrice,
    isFractionalSupported = false,
    minimumTransactionThreshold = 100.0,
    isHardComplianceBreach = false
  } = params;

  if (!Number.isFinite(currentAllocationPercent) || currentAllocationPercent < 0 || currentAllocationPercent > 100) {
    throw new Error(`Invalid currentAllocationPercent: must be between 0 and 100, received ${currentAllocationPercent}`);
  }
  if (!Number.isFinite(thresholdPercent) || thresholdPercent < 0 || thresholdPercent > 100) {
    throw new Error(`Invalid thresholdPercent: must be between 0 and 100, received ${thresholdPercent}`);
  }
  if (!Number.isFinite(portfolioTotalValue) || portfolioTotalValue <= 0) {
    throw new Error(`Invalid portfolioTotalValue: must be a positive finite number, received ${portfolioTotalValue}`);
  }
  if (!Number.isFinite(holdingMarketValue) || holdingMarketValue < 0) {
    throw new Error(`Invalid holdingMarketValue: must be a non-negative finite number, received ${holdingMarketValue}`);
  }
  if (currentPrice !== undefined && (!Number.isFinite(currentPrice) || currentPrice <= 0)) {
    throw new Error(`Invalid currentPrice: must be a positive finite number, received ${currentPrice}`);
  }
  if (minimumTransactionThreshold !== undefined && (!Number.isFinite(minimumTransactionThreshold) || minimumTransactionThreshold < 0)) {
    throw new Error(`Invalid minimumTransactionThreshold: must be a non-negative finite number, received ${minimumTransactionThreshold}`);
  }

  const derivationSteps: string[] = [];
  const excessPercent = Math.max(0, currentAllocationPercent - thresholdPercent);
  derivationSteps.push(
    `Excess percentage calculated: max(0, ${currentAllocationPercent.toFixed(2)}% - ${thresholdPercent.toFixed(2)}%) = ${excessPercent.toFixed(2)}%`
  );

  let rawGrossTrim = (excessPercent / 100) * portfolioTotalValue;
  rawGrossTrim = Math.max(0, Math.min(holdingMarketValue, rawGrossTrim));
  derivationSteps.push(
    `Continuous gross trim clamped: min($${holdingMarketValue.toFixed(2)}, $${portfolioTotalValue.toFixed(2)} * ${excessPercent.toFixed(2)}%) = $${rawGrossTrim.toFixed(2)}`
  );

  let discreteUnits: number | null = null;
  let finalGrossTrim = rawGrossTrim;

  if (currentPrice && currentPrice > 0) {
    if (isFractionalSupported) {
      discreteUnits = Number((rawGrossTrim / currentPrice).toFixed(6));
      finalGrossTrim = Number((discreteUnits * currentPrice).toFixed(2));
      derivationSteps.push(`Fractional units supported: ${discreteUnits} units at $${currentPrice.toFixed(2)} = $${finalGrossTrim.toFixed(2)}`);
    } else {
      discreteUnits = Math.floor(rawGrossTrim / currentPrice);
      finalGrossTrim = Number((discreteUnits * currentPrice).toFixed(2));
      derivationSteps.push(`Discrete units floored: ${discreteUnits} shares at $${currentPrice.toFixed(2)} = $${finalGrossTrim.toFixed(2)}`);
    }
  }

  // De minimis check for discretionary rebalance
  if (finalGrossTrim < minimumTransactionThreshold && !isHardComplianceBreach) {
    derivationSteps.push(
      `Trim amount $${finalGrossTrim.toFixed(2)} is below minimum transaction threshold $${minimumTransactionThreshold.toFixed(2)}. Suppressing to $0.00 to avoid churn.`
    );
    finalGrossTrim = 0;
    if (discreteUnits !== null) discreteUnits = 0;
  }

  const suggestedProportion = holdingMarketValue > 0 ? Math.max(0, Math.min(1.0, finalGrossTrim / holdingMarketValue)) : 0;
  derivationSteps.push(`Final suggested proportion of holding: ${(suggestedProportion * 100).toFixed(2)}%`);

  // Calculate resulting position and allocation percentage
  const remainingHoldingValue = Math.max(0, holdingMarketValue - finalGrossTrim);
  const resultingAllocationPercent = Number(((remainingHoldingValue / portfolioTotalValue) * 100).toFixed(4));
  derivationSteps.push(
    `Resulting position value: $${remainingHoldingValue.toFixed(2)}. Resulting allocation: ${resultingAllocationPercent.toFixed(2)}%`
  );

  let isComplianceRestored = true;
  let complianceWarning: string | undefined;

  if (isHardComplianceBreach) {
    if (resultingAllocationPercent > thresholdPercent + 0.0001) {
      isComplianceRestored = false;
      if (discreteUnits === 0 && currentPrice && currentPrice > 0) {
        complianceWarning = `Position excess ($${rawGrossTrim.toFixed(2)}) is smaller than one whole share at price $${currentPrice.toFixed(2)}. Zero shares can be sold without overselling. Hard limit remains breached (${resultingAllocationPercent.toFixed(2)}% vs ${thresholdPercent.toFixed(2)}%). Human review required.`;
      } else {
        complianceWarning = `Discrete share rounding down to ${discreteUnits} whole shares leaves allocation at ${resultingAllocationPercent.toFixed(2)}%, which still exceeds the hard ceiling of ${thresholdPercent.toFixed(2)}%. Hard limit remains breached. Human review required.`;
      }
      derivationSteps.push(`WARNING: ${complianceWarning}`);
    } else {
      isComplianceRestored = true;
      derivationSteps.push(`Compliance verified: Resulting allocation ${resultingAllocationPercent.toFixed(2)}% is at or below hard ceiling ${thresholdPercent.toFixed(2)}%.`);
    }
  }

  return {
    grossTrimAmount: finalGrossTrim,
    suggestedProportion,
    discreteUnits,
    resultingAllocationPercent,
    isComplianceRestored,
    derivationSteps,
    complianceWarning
  };
}

/* =========================================================================
   7. Core Engine Evaluation Function
   ========================================================================= */

/**
 * Deterministically evaluates profit realization, hard-limit compliance, and proceeds reinvestment.
 * Operates strictly within the fiduciary invariants specified in PROFIT_REALIZATION_REINVESTMENT_DESIGN.md.
 */
export function evaluateProfitRealization(input: ProfitRealizationEngineInput): ProfitRealizationEngineResult {
  const violationsPrevented: string[] = [];
  const frictionAnalysisDisclosures: string[] = [];
  const appliedDecisionRules: Array<{ ruleId: string; ruleName: string; description: string; isKeyFactor: boolean }> = [];
  const currency = input.costModel?.currency ?? 'USD';

  // Security Check: Real Decision Mode Isolation
  if (input.executionMode === 'real_decision') {
    const hasSyntheticEvidence =
      input.evidenceRecords?.some(e => e.isSyntheticDemonstration || e.verificationStatus === 'simulated_demonstration') ||
      input.valuationMetrics?.some(m => m.isSyntheticDemonstration);

    if (hasSyntheticEvidence) {
      return {
        realizationAssessment: 'INSUFFICIENT_EVIDENCE',
        realizationRationale: 'Real decision mode security failure: Synthetic demonstration evidence submitted to a real-decision context.',
        suggestedAmount: {
          amountType: 'INSUFFICIENT_EVIDENCE',
          suggestedProportionOfHolding: 0,
          suggestedGrossCapitalValue: null,
          currency,
          frictionBreakdown: null,
          calculationFormula: 'N/A',
          derivationSteps: ['Execution mode security gate rejected synthetic evidence.'],
          limitations: ['Synthetic evidence cannot authorize real investment recommendations.']
        },
        reinvestmentAssessment: {
          action: 'INSUFFICIENT_EVIDENCE',
          selectedCandidateId: null,
          selectedCandidateName: null,
          allocatedNetProceedsCurrency: 0,
          unallocatedNetProceedsToCash: 0,
          currency,
          rationale: 'Security gate rejected synthetic demonstration evidence.',
          candidateEvaluations: []
        },
        unallocatedCapitalOpportunities: [],
        complianceContext: {
          isHardLimitBreached: false,
          governingHardCeiling: null,
          governingLimitType: 'none',
          isHoldingInProfit: false,
          unrealizedGainCurrency: 0,
          coreEngineDecisionComparison: {
            coreEngineDecision: 'INSUFFICIENT_EVIDENCE',
            profitEngineAssessment: 'INSUFFICIENT_EVIDENCE',
            isAligned: true,
            boundaryNote: 'Security gate violation: Synthetic data rejected in real decision mode.',
            automatedTradeExecutionBlocked: true
          }
        },
        appliedDecisionRules: [{
          ruleId: 'SEC_REAL_SYNTHETIC_ISOLATION',
          ruleName: 'Real/Synthetic Evidence Isolation',
          description: 'Synthetic demonstration records are strictly prohibited from entering real decision contexts.',
          isKeyFactor: true
        }],
        violationsPrevented: ['Prevented synthetic demonstration fixture from authorizing a real decision'],
        missingDataReasons: ['Verified primary evidence required for real decision mode'],
        frictionAnalysisDisclosures: [],
        isSimulatedDraft: false
      };
    }
  }

  // Gate 0: Validate baseline financials and parameters
  const inputValidationErrors: string[] = [];

  if (input.currentMarketValue === undefined) {
    inputValidationErrors.push('currentMarketValue is undefined');
  } else if (!Number.isFinite(input.currentMarketValue) || input.currentMarketValue < 0) {
    inputValidationErrors.push(`currentMarketValue must be a non-negative finite number, received ${input.currentMarketValue}`);
  }

  if (input.costBasisTotal === undefined) {
    inputValidationErrors.push('costBasisTotal is undefined');
  } else if (!Number.isFinite(input.costBasisTotal) || input.costBasisTotal < 0) {
    inputValidationErrors.push(`costBasisTotal must be a non-negative finite number, received ${input.costBasisTotal}`);
  }

  if (input.portfolioTotalValue === undefined) {
    inputValidationErrors.push('portfolioTotalValue is undefined');
  } else if (!Number.isFinite(input.portfolioTotalValue) || input.portfolioTotalValue <= 0) {
    inputValidationErrors.push(`portfolioTotalValue must be a positive finite number, received ${input.portfolioTotalValue}`);
  }

  if (input.currentPrice !== undefined) {
    if (!Number.isFinite(input.currentPrice) || input.currentPrice <= 0) {
      inputValidationErrors.push(`currentPrice must be a positive finite number, received ${input.currentPrice}`);
    }
  }

  if (input.currentAllocationPercent !== undefined) {
    if (!Number.isFinite(input.currentAllocationPercent) || input.currentAllocationPercent < 0 || input.currentAllocationPercent > 100) {
      inputValidationErrors.push(`currentAllocationPercent must be between 0 and 100, received ${input.currentAllocationPercent}`);
    }
  }

  if (!input.limitHierarchy) {
    inputValidationErrors.push('limitHierarchy is undefined');
  } else {
    if (input.limitHierarchy.strategicTarget === undefined) {
      inputValidationErrors.push('strategicTarget is undefined');
    } else if (!Number.isFinite(input.limitHierarchy.strategicTarget) || input.limitHierarchy.strategicTarget < 0 || input.limitHierarchy.strategicTarget > 100) {
      inputValidationErrors.push(`strategicTarget must be a finite percentage between 0 and 100, received ${input.limitHierarchy.strategicTarget}`);
    }

    if (input.limitHierarchy.toleranceCeiling !== undefined) {
      if (!Number.isFinite(input.limitHierarchy.toleranceCeiling) || input.limitHierarchy.toleranceCeiling < 0 || input.limitHierarchy.toleranceCeiling > 100) {
        inputValidationErrors.push(`toleranceCeiling must be a finite percentage between 0 and 100, received ${input.limitHierarchy.toleranceCeiling}`);
      } else if (input.limitHierarchy.strategicTarget !== undefined && input.limitHierarchy.toleranceCeiling < input.limitHierarchy.strategicTarget) {
        inputValidationErrors.push(`toleranceCeiling (${input.limitHierarchy.toleranceCeiling}%) cannot be less than strategicTarget (${input.limitHierarchy.strategicTarget}%)`);
      }
    }
  }

  // Cost model validation
  if (input.costModel) {
    if (input.costModel.capitalGainsTaxRateEstimate !== undefined) {
      if (!Number.isFinite(input.costModel.capitalGainsTaxRateEstimate) || input.costModel.capitalGainsTaxRateEstimate < 0 || input.costModel.capitalGainsTaxRateEstimate > 1.0) {
        inputValidationErrors.push(`costModel.capitalGainsTaxRateEstimate must be between 0.0 and 1.0, received ${input.costModel.capitalGainsTaxRateEstimate}`);
      }
    }
    if (input.costModel.transactionFeeEstimateRate !== undefined) {
      if (!Number.isFinite(input.costModel.transactionFeeEstimateRate) || input.costModel.transactionFeeEstimateRate < 0 || input.costModel.transactionFeeEstimateRate > 0.50) {
        inputValidationErrors.push(`costModel.transactionFeeEstimateRate must be between 0.0 and 0.50, received ${input.costModel.transactionFeeEstimateRate}`);
      }
    }
    if (input.costModel.estimatedSpreadRate !== undefined) {
      if (!Number.isFinite(input.costModel.estimatedSpreadRate) || input.costModel.estimatedSpreadRate < 0 || input.costModel.estimatedSpreadRate > 0.50) {
        inputValidationErrors.push(`costModel.estimatedSpreadRate must be between 0.0 and 0.50, received ${input.costModel.estimatedSpreadRate}`);
      }
    }
    if (input.costModel.maxAllowableFrictionDragRatio !== undefined) {
      if (!Number.isFinite(input.costModel.maxAllowableFrictionDragRatio) || input.costModel.maxAllowableFrictionDragRatio < 0) {
        inputValidationErrors.push(`costModel.maxAllowableFrictionDragRatio must be a non-negative finite number, received ${input.costModel.maxAllowableFrictionDragRatio}`);
      }
    }
    if (input.costModel.minimumTransactionThreshold !== undefined) {
      if (!Number.isFinite(input.costModel.minimumTransactionThreshold) || input.costModel.minimumTransactionThreshold < 0) {
        inputValidationErrors.push(`costModel.minimumTransactionThreshold must be a non-negative finite number, received ${input.costModel.minimumTransactionThreshold}`);
      }
    }
  }

  if (inputValidationErrors.length > 0) {
    violationsPrevented.push('Prevented arbitrary realization without complete, valid financial parameters');
    return {
      realizationAssessment: 'INSUFFICIENT_EVIDENCE',
      realizationRationale: `Fail-Closed Gate: Invalid or missing baseline financial parameters: ${inputValidationErrors.join('; ')}.`,
      suggestedAmount: {
        amountType: 'INSUFFICIENT_EVIDENCE',
        suggestedProportionOfHolding: 0,
        suggestedGrossCapitalValue: null,
        currency,
        frictionBreakdown: null,
        calculationFormula: 'N/A',
        derivationSteps: ['Cannot calculate trim without valid, complete position financials.'],
        limitations: ['Requires valid, non-negative finite values for market value, cost basis, portfolio value, and targets.']
      },
      reinvestmentAssessment: {
        action: 'INSUFFICIENT_EVIDENCE',
        selectedCandidateId: null,
        selectedCandidateName: null,
        allocatedNetProceedsCurrency: 0,
        unallocatedNetProceedsToCash: 0,
        currency,
        rationale: 'Cannot evaluate reinvestment when primary holding parameters are invalid.',
        candidateEvaluations: []
      },
      unallocatedCapitalOpportunities: [],
      complianceContext: {
        isHardLimitBreached: false,
        governingHardCeiling: null,
        governingLimitType: 'none',
        isHoldingInProfit: false,
        unrealizedGainCurrency: 0,
        coreEngineDecisionComparison: {
          coreEngineDecision: 'INSUFFICIENT_EVIDENCE',
          profitEngineAssessment: 'INSUFFICIENT_EVIDENCE',
          isAligned: true,
          boundaryNote: 'Both engines fail closed when baseline financial parameters are invalid.',
          automatedTradeExecutionBlocked: true
        }
      },
      appliedDecisionRules: [{
        ruleId: 'GATE_0_BASELINE_FINANCIALS',
        ruleName: 'Baseline Financials Validation Gate',
        description: 'Position financials and portfolio targets must be fully populated and valid before evaluation.',
        isKeyFactor: true
      }],
      violationsPrevented,
      missingDataReasons: inputValidationErrors,
      frictionAnalysisDisclosures: [],
      isSimulatedDraft: input.executionMode === 'synthetic_simulation'
    };
  }

  const currentMarketValue = input.currentMarketValue!;
  const costBasisTotal = input.costBasisTotal!;
  const portfolioTotalValue = input.portfolioTotalValue!;
  const strategicTarget = input.limitHierarchy.strategicTarget;
  const currentAllocationPercent = input.currentAllocationPercent ?? (currentMarketValue / portfolioTotalValue) * 100;
  const unrealizedGainCurrency = currentMarketValue - costBasisTotal;
  const isHoldingInProfit = unrealizedGainCurrency > 0;

  // Resolve Effective Hard Ceiling
  const ceilingResolution = resolveEffectiveHardCeiling(input.limitHierarchy, currentAllocationPercent);
  ceilingResolution.disclosures.forEach(d => frictionAnalysisDisclosures.push(d));

  if (ceilingResolution.isMateriallyUncertain) {
    violationsPrevented.push('Prevented acting on unverified, disputed, or incomparable external limits');
    return {
      realizationAssessment: 'INSUFFICIENT_EVIDENCE',
      realizationRationale: `Fail-Closed Gate: Materially uncertain or incomparable allocation limits detected. ${ceilingResolution.disclosures.join(' ')}`,
      suggestedAmount: {
        amountType: 'INSUFFICIENT_EVIDENCE',
        suggestedProportionOfHolding: 0,
        suggestedGrossCapitalValue: null,
        currency,
        frictionBreakdown: null,
        calculationFormula: 'N/A',
        derivationSteps: ['Cannot calculate trim when governing legal or portfolio limits are unresolved.'],
        limitations: ['Clarify whether external limit applies before requesting rebalance evaluation.']
      },
      reinvestmentAssessment: {
        action: 'INSUFFICIENT_EVIDENCE',
        selectedCandidateId: null,
        selectedCandidateName: null,
        allocatedNetProceedsCurrency: 0,
        unallocatedNetProceedsToCash: 0,
        currency,
        rationale: 'Reinvestment universe halted due to uncertain constraint status on reviewed holding.',
        candidateEvaluations: []
      },
      unallocatedCapitalOpportunities: [],
      complianceContext: {
        isHardLimitBreached: false,
        governingHardCeiling: null,
        governingLimitType: 'none',
        isHoldingInProfit,
        unrealizedGainCurrency,
        coreEngineDecisionComparison: {
          coreEngineDecision: 'INSUFFICIENT_EVIDENCE',
          profitEngineAssessment: 'INSUFFICIENT_EVIDENCE',
          isAligned: true,
          boundaryNote: 'Material legal or constraint ambiguity requires human fiduciary resolution.',
          automatedTradeExecutionBlocked: true
        }
      },
      appliedDecisionRules: [{
        ruleId: 'LIMIT_UNCERTAINTY_GATE',
        ruleName: 'Material Limit Uncertainty Gate',
        description: 'Refuses to guess statutory requirements when external limits are disputed or incomparable.',
        isKeyFactor: true
      }],
      violationsPrevented,
      frictionAnalysisDisclosures,
      missingDataReasons: ceilingResolution.disclosures,
      isSimulatedDraft: input.executionMode === 'synthetic_simulation'
    };
  }

  const effectiveHardCeiling = ceilingResolution.effectiveHardCeiling;
  const isHardLimitBreached = effectiveHardCeiling !== null && currentAllocationPercent > effectiveHardCeiling;

  // Gate 1: Material Thesis Invalidation Check
  if (input.thesisStatus === 'materially_invalidated') {
    violationsPrevented.push('Prevented mislabeling structural thesis breakdown as routine profit realization');
    return {
      realizationAssessment: 'INSUFFICIENT_EVIDENCE',
      realizationRationale:
        'Boundary Rule: Investment premise has collapsed (thesis materially invalidated). Position handling belongs exclusively to Core Engine Rule 5 SELL liquidation, NOT discretionary profit realization.',
      suggestedAmount: {
        amountType: 'NO_SALE',
        suggestedProportionOfHolding: 0,
        suggestedGrossCapitalValue: 0,
        currency,
        frictionBreakdown: null,
        calculationFormula: 'Yield to Core Engine Rule 5 SELL',
        derivationSteps: ['Profit realization engine yields jurisdiction on invalidated assets.'],
        limitations: ['Liquidating an asset with broken fundamentals is capital preservation, not profit-taking.']
      },
      reinvestmentAssessment: {
        action: 'HOLD_AS_CASH',
        selectedCandidateId: null,
        selectedCandidateName: null,
        allocatedNetProceedsCurrency: 0,
        unallocatedNetProceedsToCash: 0,
        currency,
        rationale: 'Zero proceeds generated; capital protection liquidation handled by core engine.',
        candidateEvaluations: []
      },
      unallocatedCapitalOpportunities: evaluateUnallocatedOpportunities(input.reinvestmentCandidates, portfolioTotalValue),
      complianceContext: {
        isHardLimitBreached,
        governingHardCeiling: effectiveHardCeiling,
        governingLimitType: ceilingResolution.governingLimitType,
        isHoldingInProfit,
        unrealizedGainCurrency,
        coreEngineDecisionComparison: {
          coreEngineDecision: 'SELL',
          profitEngineAssessment: 'INSUFFICIENT_EVIDENCE',
          isAligned: false,
          boundaryNote: 'Core Engine handles complete liquidation; Profit Engine yields jurisdiction.',
          automatedTradeExecutionBlocked: true
        }
      },
      appliedDecisionRules: [{
        ruleId: 'GATE_1_THESIS_COLLAPSE_YIELD',
        ruleName: 'Thesis Invalidation Precedence Gate',
        description: 'When moat collapses, position is routed exclusively to Core Decision Engine SELL.',
        isKeyFactor: true
      }],
      violationsPrevented,
      frictionAnalysisDisclosures,
      isSimulatedDraft: input.executionMode === 'synthetic_simulation'
    };
  }

  // Branch A: Verified Hard Limit Breach (Compliance-driven Risk Reduction)
  if (isHardLimitBreached && effectiveHardCeiling !== null) {
    appliedDecisionRules.push({
      ruleId: 'HARD_LIMIT_BREACH_PRECEDENCE',
      ruleName: 'Hard Concentration Limit Precedence',
      description: 'Prioritizes reducing holding to comply with effectiveHardCeiling over soft tolerance preferences.',
      isKeyFactor: true
    });

    // Sub-case A1: Position has NO unrealized profit (Loss or Flat)
    if (!isHoldingInProfit) {
      violationsPrevented.push('Prevented mislabeling loss-position compliance reduction as profit-taking');
      return {
        realizationAssessment: 'YIELD_TO_RISK_REDUCTION',
        realizationRationale: `Mandate Compliance Notice: Holding exceeds hard limit (${currentAllocationPercent.toFixed(2)}% vs ${effectiveHardCeiling.toFixed(2)}%), but position is at an unrealized loss ($${unrealizedGainCurrency.toFixed(2)}). Reducing this holding is a risk/compliance reduction under Core Decision Engine Rule 3, NOT profit realization.`,
        suggestedAmount: {
          amountType: 'NO_SALE',
          suggestedProportionOfHolding: 0,
          suggestedGrossCapitalValue: 0,
          currency,
          frictionBreakdown: null,
          calculationFormula: 'N/A (Yield to Core Engine REDUCE)',
          derivationSteps: ['Holding has no profit to realize; risk reduction belongs to core risk mandate.'],
          limitations: ['Profit engine does not execute loss-position risk trims.']
        },
        reinvestmentAssessment: {
          action: 'HOLD_AS_CASH',
          selectedCandidateId: null,
          selectedCandidateName: null,
          allocatedNetProceedsCurrency: 0,
          unallocatedNetProceedsToCash: 0,
          currency,
          rationale: 'Zero profit realization proceeds generated.',
          candidateEvaluations: []
        },
        unallocatedCapitalOpportunities: evaluateUnallocatedOpportunities(input.reinvestmentCandidates, portfolioTotalValue),
        complianceContext: {
          isHardLimitBreached: true,
          governingHardCeiling: effectiveHardCeiling,
          governingLimitType: ceilingResolution.governingLimitType,
          isHoldingInProfit: false,
          unrealizedGainCurrency,
          coreEngineDecisionComparison: {
            coreEngineDecision: 'REDUCE',
            profitEngineAssessment: 'YIELD_TO_RISK_REDUCTION',
            isAligned: false,
            boundaryNote: 'Core Engine issues REDUCE for compliance; Profit Engine notes no profit to realize. Zero trade executed.',
            automatedTradeExecutionBlocked: true
          }
        },
        appliedDecisionRules,
        violationsPrevented,
        frictionAnalysisDisclosures,
        isSimulatedDraft: input.executionMode === 'synthetic_simulation'
      };
    }

    // Sub-case A2: Position IS profitable -> Hard Compliance Trim
    const trimCalc = calculateGrossTrimAmount({
      currentAllocationPercent,
      thresholdPercent: effectiveHardCeiling,
      portfolioTotalValue,
      holdingMarketValue: currentMarketValue,
      currentPrice: input.currentPrice,
      isFractionalSupported: input.isFractionalSupported,
      minimumTransactionThreshold: input.costModel?.minimumTransactionThreshold,
      isHardComplianceBreach: true
    });

    const limitations = [
      ceilingResolution.governingLimitType === 'user_portfolio_policy'
        ? 'User-configured policy limit; not a statutory or regulatory requirement.'
        : 'Statutory mandate compliance trim.'
    ];

    if (!trimCalc.isComplianceRestored && trimCalc.complianceWarning) {
      limitations.push(trimCalc.complianceWarning);
    }

    let friction: RealizationFrictionBreakdown;
    try {
      friction = calculateFrictionBreakdown({
        grossTransactionAmount: trimCalc.grossTrimAmount,
        totalMarketValue: currentMarketValue,
        costBasisTotal,
        costModel: input.costModel
      });
    } catch (err: any) {
      violationsPrevented.push('Prevented realization evaluation with invalid cost model where deductions exceed proceeds');
      return {
        realizationAssessment: 'INSUFFICIENT_EVIDENCE',
        realizationRationale: `Fail-Closed Gate: Cost model calculation failed: ${err?.message || 'Invalid friction calculation'}.`,
        suggestedAmount: {
          amountType: 'INSUFFICIENT_EVIDENCE',
          suggestedProportionOfHolding: 0,
          suggestedGrossCapitalValue: null,
          currency,
          frictionBreakdown: null,
          calculationFormula: 'N/A',
          derivationSteps: [err?.message || 'Friction calculation rejected.'],
          limitations: ['Requires valid cost model parameters where deductions do not exceed gross proceeds.']
        },
        reinvestmentAssessment: {
          action: 'INSUFFICIENT_EVIDENCE',
          selectedCandidateId: null,
          selectedCandidateName: null,
          allocatedNetProceedsCurrency: 0,
          unallocatedNetProceedsToCash: 0,
          currency,
          rationale: 'Friction calculation failure on reviewed holding.',
          candidateEvaluations: []
        },
        unallocatedCapitalOpportunities: [],
        complianceContext: {
          isHardLimitBreached: true,
          governingHardCeiling: effectiveHardCeiling,
          governingLimitType: ceilingResolution.governingLimitType,
          isHoldingInProfit: true,
          unrealizedGainCurrency,
          coreEngineDecisionComparison: {
            coreEngineDecision: 'REDUCE',
            profitEngineAssessment: 'INSUFFICIENT_EVIDENCE',
            isAligned: false,
            boundaryNote: 'Cost model error halts calculation. Core Engine maintains mandate REDUCE.',
            automatedTradeExecutionBlocked: true
          }
        },
        appliedDecisionRules,
        violationsPrevented,
        frictionAnalysisDisclosures,
        missingDataReasons: [err?.message || 'Cost model invalid'],
        isSimulatedDraft: input.executionMode === 'synthetic_simulation'
      };
    }

    const reinvestment = evaluateReinvestmentProceeds({
      netProceeds: friction.estimatedNetProceeds,
      candidates: input.reinvestmentCandidates,
      portfolioTotalValue,
      asOfDate: input.asOfDate,
      currency,
      executionMode: input.executionMode
    });

    let rationale = `Hard Limit Compliance: Holding allocation (${currentAllocationPercent.toFixed(2)}%) exceeds ${
      ceilingResolution.governingLimitType === 'statutory_regulatory' ? 'statutory mandate limit' : 'user hard portfolio policy ceiling'
    } (${effectiveHardCeiling.toFixed(2)}%). Trimming excess to restore compliance.`;

    if (!trimCalc.isComplianceRestored && trimCalc.complianceWarning) {
      rationale += ` Note: ${trimCalc.complianceWarning}`;
    }

    return {
      realizationAssessment: 'CONSIDER_PARTIAL_REALIZATION',
      realizationRationale: rationale,
      suggestedAmount: {
        amountType: 'TRIM_TO_EFFECTIVE_HARD_CEILING',
        suggestedProportionOfHolding: trimCalc.suggestedProportion,
        suggestedGrossCapitalValue: trimCalc.grossTrimAmount,
        currency,
        frictionBreakdown: friction,
        discreteUnits: trimCalc.discreteUnits,
        isFractionalSupported: input.isFractionalSupported,
        resultingAllocationPercent: trimCalc.resultingAllocationPercent,
        isComplianceRestored: trimCalc.isComplianceRestored,
        calculationFormula: `Trim excess = max(0, ${currentAllocationPercent.toFixed(2)}% - ${effectiveHardCeiling.toFixed(2)}%) * $${portfolioTotalValue.toFixed(2)}`,
        derivationSteps: trimCalc.derivationSteps,
        limitations
      },
      reinvestmentAssessment: reinvestment,
      unallocatedCapitalOpportunities: evaluateUnallocatedOpportunities(input.reinvestmentCandidates, portfolioTotalValue),
      complianceContext: {
        isHardLimitBreached: true,
        governingHardCeiling: effectiveHardCeiling,
        governingLimitType: ceilingResolution.governingLimitType,
        isHoldingInProfit: true,
        unrealizedGainCurrency,
        coreEngineDecisionComparison: {
          coreEngineDecision: 'REDUCE',
          profitEngineAssessment: 'CONSIDER_PARTIAL_REALIZATION',
          isAligned: true,
          boundaryNote: 'Both engines recognize mandate breach; profit engine computes exact net proceeds.',
          automatedTradeExecutionBlocked: true
        }
      },
      appliedDecisionRules,
      violationsPrevented,
      frictionAnalysisDisclosures,
      isSimulatedDraft: input.executionMode === 'synthetic_simulation'
    };
  }

  // Branch B: No Hard Limit Breach (Discretionary Rebalancing Path)

  // Gate 2: Safe Early Termination for Holdings at or Below Target
  if (currentAllocationPercent <= strategicTarget) {
    violationsPrevented.push('Prevented selling an intact compounder operating at or below target allocation');
    appliedDecisionRules.push({
      ruleId: 'GATE_2_SAFE_EARLY_TERMINATION',
      ruleName: 'Safe Early Termination for Target Holdings',
      description: 'Intact compounders at or below target weight are protected from premature selling.',
      isKeyFactor: true
    });

    return {
      realizationAssessment: 'NO_ACTION',
      realizationRationale: `Safe Early Termination: Holding allocation (${currentAllocationPercent.toFixed(2)}%) is at or below strategic target (${strategicTarget.toFixed(2)}%) with an intact thesis. Winners are allowed to compound.`,
      suggestedAmount: {
        amountType: 'NO_SALE',
        suggestedProportionOfHolding: 0,
        suggestedGrossCapitalValue: 0,
        currency,
        frictionBreakdown: null,
        calculationFormula: 'N/A (Holding at target)',
        derivationSteps: ['Allocation does not exceed strategic target; zero trim calculated.'],
        limitations: ['Fiduciary buy-and-hold philosophy protects balanced assets.']
      },
      reinvestmentAssessment: {
        action: 'HOLD_AS_CASH',
        selectedCandidateId: null,
        selectedCandidateName: null,
        allocatedNetProceedsCurrency: 0,
        unallocatedNetProceedsToCash: 0,
        currency,
        rationale: 'Zero realization proceeds generated; holding operating at target.',
        candidateEvaluations: []
      },
      unallocatedCapitalOpportunities: evaluateUnallocatedOpportunities(input.reinvestmentCandidates, portfolioTotalValue),
      complianceContext: {
        isHardLimitBreached: false,
        governingHardCeiling: effectiveHardCeiling,
        governingLimitType: 'none',
        isHoldingInProfit,
        unrealizedGainCurrency,
        coreEngineDecisionComparison: {
          coreEngineDecision: 'HOLD',
          profitEngineAssessment: 'NO_ACTION',
          isAligned: true,
          boundaryNote: 'Both engines maintain long-term holding.',
          automatedTradeExecutionBlocked: true
        }
      },
      appliedDecisionRules,
      violationsPrevented,
      frictionAnalysisDisclosures,
      isSimulatedDraft: input.executionMode === 'synthetic_simulation'
    };
  }

  // Gate 3: Overweight Discretionary Rebalance Evaluation
  const categoryPolicy = ASSET_CATEGORY_POLICIES[input.assetCategory] ?? ASSET_CATEGORY_POLICIES.equity;
  const toleranceCeiling =
    input.limitHierarchy.toleranceCeiling !== undefined
      ? input.limitHierarchy.toleranceCeiling
      : strategicTarget + categoryPolicy.defaultToleranceBandPercent;

  // Case B1: Drift within tolerance band
  if (currentAllocationPercent <= toleranceCeiling) {
    violationsPrevented.push('Prevented rebalancing churn within configured tolerance band');
    appliedDecisionRules.push({
      ruleId: 'TOLERANCE_BAND_INERTIA',
      ruleName: 'Tolerance Band Rebalancing Inertia',
      description: 'Minor drift within tolerance band is treated as normal market variance.',
      isKeyFactor: true
    });

    return {
      realizationAssessment: 'NO_ACTION',
      realizationRationale: `Normal Portfolio Drift: Current allocation (${currentAllocationPercent.toFixed(2)}%) exceeds strategic target (${strategicTarget.toFixed(2)}%) but remains within tolerance band ceiling (${toleranceCeiling.toFixed(2)}%). Fiduciary inertia protects position from frictional churn.`,
      suggestedAmount: {
        amountType: 'NO_SALE',
        suggestedProportionOfHolding: 0,
        suggestedGrossCapitalValue: 0,
        currency,
        frictionBreakdown: null,
        calculationFormula: 'N/A (Within tolerance band)',
        derivationSteps: ['Allocation does not breach tolerance band ceiling.'],
        limitations: ['Discretionary tolerance buffers normal volatility.']
      },
      reinvestmentAssessment: {
        action: 'HOLD_AS_CASH',
        selectedCandidateId: null,
        selectedCandidateName: null,
        allocatedNetProceedsCurrency: 0,
        unallocatedNetProceedsToCash: 0,
        currency,
        rationale: 'Zero realization proceeds generated; position within tolerance band.',
        candidateEvaluations: []
      },
      unallocatedCapitalOpportunities: evaluateUnallocatedOpportunities(input.reinvestmentCandidates, portfolioTotalValue),
      complianceContext: {
        isHardLimitBreached: false,
        governingHardCeiling: effectiveHardCeiling,
        governingLimitType: 'none',
        isHoldingInProfit,
        unrealizedGainCurrency,
        coreEngineDecisionComparison: {
          coreEngineDecision: 'HOLD',
          profitEngineAssessment: 'NO_ACTION',
          isAligned: true,
          boundaryNote: 'Both engines agree to maintain long-term holding.',
          automatedTradeExecutionBlocked: true
        }
      },
      appliedDecisionRules,
      violationsPrevented,
      frictionAnalysisDisclosures,
      isSimulatedDraft: input.executionMode === 'synthetic_simulation'
    };
  }

  // Case B2: Overweight beyond tolerance ceiling -> Full Multi-Factor Verification

  // Invariant Check: Position must be profitable to harvest profit
  if (!isHoldingInProfit) {
    violationsPrevented.push('Prevented realization sale on a position held at a capital loss');
    return {
      realizationAssessment: 'NO_ACTION',
      realizationRationale: `Holding exceeds tolerance ceiling (${currentAllocationPercent.toFixed(2)}% vs ${toleranceCeiling.toFixed(2)}%), but position has no unrealized capital gain ($${unrealizedGainCurrency.toFixed(2)}). Selling an asset at a loss solely due to allocation drift violates fiduciary rebalancing rules.`,
      suggestedAmount: {
        amountType: 'NO_SALE',
        suggestedProportionOfHolding: 0,
        suggestedGrossCapitalValue: 0,
        currency,
        frictionBreakdown: null,
        calculationFormula: 'N/A (Position at a loss)',
        derivationSteps: ['Unrealized gain is <= 0; profit realization strictly prohibited.'],
        limitations: ['Managing drift in an underwater asset is handled via new contribution steering.']
      },
      reinvestmentAssessment: {
        action: 'HOLD_AS_CASH',
        selectedCandidateId: null,
        selectedCandidateName: null,
        allocatedNetProceedsCurrency: 0,
        unallocatedNetProceedsToCash: 0,
        currency,
        rationale: 'Zero realization proceeds generated.',
        candidateEvaluations: []
      },
      unallocatedCapitalOpportunities: evaluateUnallocatedOpportunities(input.reinvestmentCandidates, portfolioTotalValue),
      complianceContext: {
        isHardLimitBreached: false,
        governingHardCeiling: effectiveHardCeiling,
        governingLimitType: 'none',
        isHoldingInProfit: false,
        unrealizedGainCurrency,
        coreEngineDecisionComparison: {
          coreEngineDecision: 'HOLD',
          profitEngineAssessment: 'NO_ACTION',
          isAligned: true,
          boundaryNote: 'Both engines refuse to sell an underwater position without moat break or risk breach.',
          automatedTradeExecutionBlocked: true
        }
      },
      appliedDecisionRules,
      violationsPrevented,
      frictionAnalysisDisclosures,
      isSimulatedDraft: input.executionMode === 'synthetic_simulation'
    };
  }

  // Evidence Verification Checks on Overweight Asset
  if (input.evidenceQuality === 'conflicting') {
    violationsPrevented.push('Prevented discretionary realization based on conflicting disclosures');
    return {
      realizationAssessment: 'INSUFFICIENT_EVIDENCE',
      realizationRationale: 'Fail-Closed Gate: Primary evidence contains unresolved conflicts or contradictory disclosures.',
      suggestedAmount: {
        amountType: 'INSUFFICIENT_EVIDENCE',
        suggestedProportionOfHolding: 0,
        suggestedGrossCapitalValue: null,
        currency,
        frictionBreakdown: null,
        calculationFormula: 'N/A',
        derivationSteps: ['Conflicting evidence halts capital decisions.'],
        limitations: ['Requires audit reconciliation before realization assessment.']
      },
      reinvestmentAssessment: {
        action: 'INSUFFICIENT_EVIDENCE',
        selectedCandidateId: null,
        selectedCandidateName: null,
        allocatedNetProceedsCurrency: 0,
        unallocatedNetProceedsToCash: 0,
        currency,
        rationale: 'Halted due to conflicting primary evidence.',
        candidateEvaluations: []
      },
      unallocatedCapitalOpportunities: [],
      complianceContext: {
        isHardLimitBreached: false,
        governingHardCeiling: effectiveHardCeiling,
        governingLimitType: 'none',
        isHoldingInProfit: true,
        unrealizedGainCurrency,
        coreEngineDecisionComparison: {
          coreEngineDecision: 'INSUFFICIENT_EVIDENCE',
          profitEngineAssessment: 'INSUFFICIENT_EVIDENCE',
          isAligned: true,
          boundaryNote: 'Both engines fail closed on conflicting disclosures.',
          automatedTradeExecutionBlocked: true
        }
      },
      appliedDecisionRules: [{
        ruleId: 'GATE_3_CONFLICTING_EVIDENCE',
        ruleName: 'Conflicting Evidence Guard',
        description: 'Unresolved disputes between filings require absolute halt.',
        isKeyFactor: true
      }],
      violationsPrevented,
      frictionAnalysisDisclosures,
      isSimulatedDraft: input.executionMode === 'synthetic_simulation'
    };
  }

  // Valuation Presence Check
  if (input.valuationFavorable === undefined) {
    violationsPrevented.push('Prevented rebalancing without verified valuation inputs');
    return {
      realizationAssessment: 'INSUFFICIENT_EVIDENCE',
      realizationRationale: 'Fail-Closed Gate: Valuation inputs are missing (valuationFavorable is undefined).',
      suggestedAmount: {
        amountType: 'INSUFFICIENT_EVIDENCE',
        suggestedProportionOfHolding: 0,
        suggestedGrossCapitalValue: null,
        currency,
        frictionBreakdown: null,
        calculationFormula: 'N/A',
        derivationSteps: ['Valuation metrics missing.'],
        limitations: ['Engine refuses to assume valuation is extended without dated metrics.']
      },
      reinvestmentAssessment: {
        action: 'INSUFFICIENT_EVIDENCE',
        selectedCandidateId: null,
        selectedCandidateName: null,
        allocatedNetProceedsCurrency: 0,
        unallocatedNetProceedsToCash: 0,
        currency,
        rationale: 'Valuation inputs missing for reviewed holding.',
        candidateEvaluations: []
      },
      unallocatedCapitalOpportunities: [],
      complianceContext: {
        isHardLimitBreached: false,
        governingHardCeiling: effectiveHardCeiling,
        governingLimitType: 'none',
        isHoldingInProfit: true,
        unrealizedGainCurrency,
        coreEngineDecisionComparison: {
          coreEngineDecision: 'HOLD',
          profitEngineAssessment: 'INSUFFICIENT_EVIDENCE',
          isAligned: false,
          boundaryNote: 'Core engine defaults to HOLD; profit engine requires valuation evidence.',
          automatedTradeExecutionBlocked: true
        }
      },
      appliedDecisionRules: [{
        ruleId: 'GATE_3_VALUATION_PRESENCE',
        ruleName: 'Valuation Presence Guard',
        description: 'Valuation metrics must be present before discretionary rebalancing can be authorized.',
        isKeyFactor: true
      }],
      violationsPrevented,
      frictionAnalysisDisclosures,
      missingDataReasons: ['valuationFavorable is undefined'],
      isSimulatedDraft: input.executionMode === 'synthetic_simulation'
    };
  }

  // Mandatory Valuation Date Freshness Validation
  const dateValidation = validateDateFreshness(
    input.valuationAssessmentTimestamp,
    categoryPolicy.provisionalFreshnessThresholdDays,
    input.asOfDate
  );

  if (!dateValidation.isValid) {
    violationsPrevented.push('Prevented discretionary realization without defensible valuation date');
    return {
      realizationAssessment: 'INSUFFICIENT_EVIDENCE',
      realizationRationale: `Fail-Closed Gate: Discretionary realization requires defensible valuation freshness: ${dateValidation.reason}`,
      suggestedAmount: {
        amountType: 'INSUFFICIENT_EVIDENCE',
        suggestedProportionOfHolding: 0,
        suggestedGrossCapitalValue: null,
        currency,
        frictionBreakdown: null,
        calculationFormula: 'N/A',
        derivationSteps: [dateValidation.reason ?? 'Valuation timestamp invalid.'],
        limitations: ['Discretionary profit realization requires a valid, non-future, non-stale valuation timestamp.']
      },
      reinvestmentAssessment: {
        action: 'INSUFFICIENT_EVIDENCE',
        selectedCandidateId: null,
        selectedCandidateName: null,
        allocatedNetProceedsCurrency: 0,
        unallocatedNetProceedsToCash: 0,
        currency,
        rationale: 'Valuation timestamp invalid on reviewed holding.',
        candidateEvaluations: []
      },
      unallocatedCapitalOpportunities: [],
      complianceContext: {
        isHardLimitBreached: false,
        governingHardCeiling: effectiveHardCeiling,
        governingLimitType: 'none',
        isHoldingInProfit: true,
        unrealizedGainCurrency,
        coreEngineDecisionComparison: {
          coreEngineDecision: 'HOLD',
          profitEngineAssessment: 'INSUFFICIENT_EVIDENCE',
          isAligned: false,
          boundaryNote: 'Discretionary rebalance fails closed on missing/invalid valuation date.',
          automatedTradeExecutionBlocked: true
        }
      },
      appliedDecisionRules: [{
        ruleId: 'GATE_3_VALUATION_FRESHNESS',
        ruleName: 'Valuation Freshness Policy',
        description: `Valuation date must be valid and within ${categoryPolicy.provisionalFreshnessThresholdDays} days for ${input.assetCategory}.`,
        isKeyFactor: true
      }],
      violationsPrevented,
      frictionAnalysisDisclosures,
      missingDataReasons: [dateValidation.reason ?? 'Valuation timestamp invalid'],
      isSimulatedDraft: input.executionMode === 'synthetic_simulation'
    };
  }

  if (!dateValidation.isFresh) {
    violationsPrevented.push('Prevented realization using stale valuation metrics');
    return {
      realizationAssessment: 'INSUFFICIENT_EVIDENCE',
      realizationRationale: `Fail-Closed Gate: Valuation assessment is stale (${dateValidation.daysElapsed} days old, exceeding ${categoryPolicy.provisionalFreshnessThresholdDays}-day threshold for ${input.assetCategory}).`,
      suggestedAmount: {
        amountType: 'INSUFFICIENT_EVIDENCE',
        suggestedProportionOfHolding: 0,
        suggestedGrossCapitalValue: null,
        currency,
        frictionBreakdown: null,
        calculationFormula: 'N/A',
        derivationSteps: [`Valuation date ${input.valuationAssessmentTimestamp} is stale (${dateValidation.daysElapsed} days old).`],
        limitations: ['Fresh valuation data required before trading winners.']
      },
      reinvestmentAssessment: {
        action: 'INSUFFICIENT_EVIDENCE',
        selectedCandidateId: null,
        selectedCandidateName: null,
        allocatedNetProceedsCurrency: 0,
        unallocatedNetProceedsToCash: 0,
        currency,
        rationale: 'Reviewed asset valuation evidence is stale.',
        candidateEvaluations: []
      },
      unallocatedCapitalOpportunities: [],
      complianceContext: {
        isHardLimitBreached: false,
        governingHardCeiling: effectiveHardCeiling,
        governingLimitType: 'none',
        isHoldingInProfit: true,
        unrealizedGainCurrency,
        coreEngineDecisionComparison: {
          coreEngineDecision: 'HOLD',
          profitEngineAssessment: 'INSUFFICIENT_EVIDENCE',
          isAligned: false,
          boundaryNote: 'Evidence staleness blocks profit realization.',
          automatedTradeExecutionBlocked: true
        }
      },
      appliedDecisionRules: [{
        ruleId: 'GATE_3_VALUATION_FRESHNESS',
        ruleName: 'Valuation Freshness Policy',
        description: `Valuation must be within ${categoryPolicy.provisionalFreshnessThresholdDays} days for ${input.assetCategory}.`,
        isKeyFactor: true
      }],
      violationsPrevented,
      frictionAnalysisDisclosures,
      missingDataReasons: [dateValidation.reason ?? 'Valuation timestamp stale'],
      isSimulatedDraft: input.executionMode === 'synthetic_simulation'
    };
  }

  // Valuation Multiple Check: If valuation is favorable or neutral, let winners run!
  if (input.valuationFavorable !== false) {
    violationsPrevented.push('Prevented selling an intact compounder with fair or favorable valuation multiples');
    appliedDecisionRules.push({
      ruleId: 'VALUATION_RUNNER_INERTIA',
      ruleName: 'Valuation Multiples Inertia',
      description: 'Compounders with fair or favorable valuation multiples are allowed to run despite drift.',
      isKeyFactor: true
    });

    return {
      realizationAssessment: 'NO_ACTION',
      realizationRationale: `Runner Protection: Holding allocation (${currentAllocationPercent.toFixed(2)}%) exceeds tolerance ceiling (${toleranceCeiling.toFixed(2)}%), but valuation multiples are ${input.valuationFavorable === true ? 'favorable' : 'neutral/fair'}. Trimming an intact compounder without valuation stretch constitutes prohibited churning.`,
      suggestedAmount: {
        amountType: 'NO_SALE',
        suggestedProportionOfHolding: 0,
        suggestedGrossCapitalValue: 0,
        currency,
        frictionBreakdown: null,
        calculationFormula: 'N/A (Valuation not extended)',
        derivationSteps: ['Valuation multiple is not extended; holding allowed to run.'],
        limitations: ['Drift without valuation stretch is managed via future contribution steering.']
      },
      reinvestmentAssessment: {
        action: 'HOLD_AS_CASH',
        selectedCandidateId: null,
        selectedCandidateName: null,
        allocatedNetProceedsCurrency: 0,
        unallocatedNetProceedsToCash: 0,
        currency,
        rationale: 'Zero realization proceeds generated; valuation not extended.',
        candidateEvaluations: []
      },
      unallocatedCapitalOpportunities: evaluateUnallocatedOpportunities(input.reinvestmentCandidates, portfolioTotalValue),
      complianceContext: {
        isHardLimitBreached: false,
        governingHardCeiling: effectiveHardCeiling,
        governingLimitType: 'none',
        isHoldingInProfit: true,
        unrealizedGainCurrency,
        coreEngineDecisionComparison: {
          coreEngineDecision: 'HOLD',
          profitEngineAssessment: 'NO_ACTION',
          isAligned: true,
          boundaryNote: 'Both engines maintain long-term holding.',
          automatedTradeExecutionBlocked: true
        }
      },
      appliedDecisionRules,
      violationsPrevented,
      frictionAnalysisDisclosures,
      isSimulatedDraft: input.executionMode === 'synthetic_simulation'
    };
  }

  // Gate 4: Net Economic Benefit (Friction vs. Gain) Hurdle
  const trimCalc = calculateGrossTrimAmount({
    currentAllocationPercent,
    thresholdPercent: toleranceCeiling,
    portfolioTotalValue,
    holdingMarketValue: currentMarketValue,
    currentPrice: input.currentPrice,
    isFractionalSupported: input.isFractionalSupported,
    minimumTransactionThreshold: input.costModel?.minimumTransactionThreshold,
    isHardComplianceBreach: false
  });

  let friction: RealizationFrictionBreakdown;
  try {
    friction = calculateFrictionBreakdown({
      grossTransactionAmount: trimCalc.grossTrimAmount,
      totalMarketValue: currentMarketValue,
      costBasisTotal,
      costModel: input.costModel
    });
  } catch (err: any) {
    violationsPrevented.push('Prevented rebalancing where cost deductions exceed gross proceeds');
    return {
      realizationAssessment: 'INSUFFICIENT_EVIDENCE',
      realizationRationale: `Fail-Closed Gate: Cost model calculation failed: ${err?.message || 'Invalid friction calculation'}.`,
      suggestedAmount: {
        amountType: 'INSUFFICIENT_EVIDENCE',
        suggestedProportionOfHolding: 0,
        suggestedGrossCapitalValue: null,
        currency,
        frictionBreakdown: null,
        calculationFormula: 'N/A',
        derivationSteps: [err?.message || 'Friction calculation rejected.'],
        limitations: ['Requires valid cost model parameters where deductions do not exceed gross proceeds.']
      },
      reinvestmentAssessment: {
        action: 'INSUFFICIENT_EVIDENCE',
        selectedCandidateId: null,
        selectedCandidateName: null,
        allocatedNetProceedsCurrency: 0,
        unallocatedNetProceedsToCash: 0,
        currency,
        rationale: 'Friction calculation failure on reviewed holding.',
        candidateEvaluations: []
      },
      unallocatedCapitalOpportunities: [],
      complianceContext: {
        isHardLimitBreached: false,
        governingHardCeiling: effectiveHardCeiling,
        governingLimitType: 'none',
        isHoldingInProfit: true,
        unrealizedGainCurrency,
        coreEngineDecisionComparison: {
          coreEngineDecision: 'HOLD',
          profitEngineAssessment: 'INSUFFICIENT_EVIDENCE',
          isAligned: false,
          boundaryNote: 'Cost model error halts discretionary realization. Core Engine maintains default HOLD.',
          automatedTradeExecutionBlocked: true
        }
      },
      appliedDecisionRules,
      violationsPrevented,
      frictionAnalysisDisclosures,
      missingDataReasons: [err?.message || 'Cost model invalid'],
      isSimulatedDraft: input.executionMode === 'synthetic_simulation'
    };
  }

  const maxDragRatio = input.costModel?.maxAllowableFrictionDragRatio !== undefined ? input.costModel.maxAllowableFrictionDragRatio : 0.35;

  if (friction.frictionToGainDragRatio > maxDragRatio) {
    violationsPrevented.push('Prevented rebalancing where tax and fee friction exceeds net economic benefit');
    appliedDecisionRules.push({
      ruleId: 'GATE_4_FRICTION_HURDLE',
      ruleName: 'Net Economic Benefit Hurdle Gate',
      description: `Friction drag (${(friction.frictionToGainDragRatio * 100).toFixed(2)}%) exceeds maximum allowable hurdle (${(maxDragRatio * 100).toFixed(2)}%).`,
      isKeyFactor: true
    });

    frictionAnalysisDisclosures.push(
      `Frictional drag ${(friction.frictionToGainDragRatio * 100).toFixed(2)}% violates ${(maxDragRatio * 100).toFixed(2)}% threshold. Trimming destroys more value than risk reduction recovers.`
    );

    return {
      realizationAssessment: 'NO_ACTION',
      realizationRationale: `Friction Gate Rejected: Trimming $${trimCalc.grossTrimAmount.toFixed(2)} would incur $${friction.totalFrictionCosts.toFixed(2)} in total friction (${(friction.frictionToGainDragRatio * 100).toFixed(2)}% of realized gain), exceeding the ${(maxDragRatio * 100).toFixed(2)}% maximum allowable hurdle rate. Discretionary rebalancing is economically self-defeating.`,
      suggestedAmount: {
        amountType: 'NO_SALE',
        suggestedProportionOfHolding: 0,
        suggestedGrossCapitalValue: 0,
        currency,
        frictionBreakdown: friction,
        calculationFormula: 'N/A (Friction hurdle failed)',
        derivationSteps: trimCalc.derivationSteps,
        limitations: ['Taxes and spread costs impair capital efficiency more than drift impairs risk.']
      },
      reinvestmentAssessment: {
        action: 'HOLD_AS_CASH',
        selectedCandidateId: null,
        selectedCandidateName: null,
        allocatedNetProceedsCurrency: 0,
        unallocatedNetProceedsToCash: 0,
        currency,
        rationale: 'Zero realization proceeds generated due to friction hurdle rejection.',
        candidateEvaluations: []
      },
      unallocatedCapitalOpportunities: evaluateUnallocatedOpportunities(input.reinvestmentCandidates, portfolioTotalValue),
      complianceContext: {
        isHardLimitBreached: false,
        governingHardCeiling: effectiveHardCeiling,
        governingLimitType: 'none',
        isHoldingInProfit: true,
        unrealizedGainCurrency,
        coreEngineDecisionComparison: {
          coreEngineDecision: 'HOLD',
          profitEngineAssessment: 'NO_ACTION',
          isAligned: true,
          boundaryNote: 'High friction drag protects holding from taxable churn.',
          automatedTradeExecutionBlocked: true
        }
      },
      appliedDecisionRules,
      violationsPrevented,
      frictionAnalysisDisclosures,
      isSimulatedDraft: input.executionMode === 'synthetic_simulation'
    };
  }

  // All Gates Passed: Discretionary Partial Realization
  appliedDecisionRules.push({
    ruleId: 'DISCRETIONARY_PARTIAL_REALIZATION',
    ruleName: 'Discretionary Profit Realization Qualification',
    description: 'Multi-factor hurdles satisfied: high profit, drift exceeds tolerance band, valuation extended, friction acceptable.',
    isKeyFactor: true
  });

  const reinvestment = evaluateReinvestmentProceeds({
    netProceeds: friction.estimatedNetProceeds,
    candidates: input.reinvestmentCandidates,
    portfolioTotalValue,
    asOfDate: input.asOfDate,
    currency,
    executionMode: input.executionMode
  });

  return {
    realizationAssessment: 'CONSIDER_PARTIAL_REALIZATION',
    realizationRationale: `Discretionary Rebalancing: Holding allocation (${currentAllocationPercent.toFixed(2)}%) exceeds tolerance ceiling (${toleranceCeiling.toFixed(2)}%), thesis is intact, valuation is extended, and friction drag (${(friction.frictionToGainDragRatio * 100).toFixed(2)}%) clears the hurdle rate. Partial realization suggested back to tolerance ceiling.`,
    suggestedAmount: {
      amountType: 'TRIM_TO_UPPER_TOLERANCE_BAND',
      suggestedProportionOfHolding: trimCalc.suggestedProportion,
      suggestedGrossCapitalValue: trimCalc.grossTrimAmount,
      currency,
      frictionBreakdown: friction,
      discreteUnits: trimCalc.discreteUnits,
      isFractionalSupported: input.isFractionalSupported,
      resultingAllocationPercent: trimCalc.resultingAllocationPercent,
      isComplianceRestored: trimCalc.isComplianceRestored,
      calculationFormula: `Trim excess = max(0, ${currentAllocationPercent.toFixed(2)}% - ${toleranceCeiling.toFixed(2)}%) * $${portfolioTotalValue.toFixed(2)}`,
      derivationSteps: trimCalc.derivationSteps,
      limitations: ['Retains core holding operating at tolerance band ceiling; proceeds park in cash unless candidate qualifies.']
    },
    reinvestmentAssessment: reinvestment,
    unallocatedCapitalOpportunities: evaluateUnallocatedOpportunities(input.reinvestmentCandidates, portfolioTotalValue),
    complianceContext: {
      isHardLimitBreached: false,
      governingHardCeiling: effectiveHardCeiling,
      governingLimitType: 'none',
      isHoldingInProfit: true,
      unrealizedGainCurrency,
      coreEngineDecisionComparison: {
        coreEngineDecision: 'HOLD',
        profitEngineAssessment: 'CONSIDER_PARTIAL_REALIZATION',
        isAligned: false,
        boundaryNote: 'Core engine maintains HOLD inertia; Profit engine suggests fiduciary rebalance trim.',
        automatedTradeExecutionBlocked: true
      }
    },
    appliedDecisionRules,
    violationsPrevented,
    frictionAnalysisDisclosures,
    isSimulatedDraft: input.executionMode === 'synthetic_simulation'
  };
}

/* =========================================================================
   8. Reinvestment & Opportunity Helper Functions
   ========================================================================= */

export function evaluateReinvestmentProceeds(params: {
  netProceeds: number;
  candidates?: ProfitRealizationEngineInput['reinvestmentCandidates'];
  portfolioTotalValue: number;
  asOfDate?: string;
  currency: string;
  executionMode?: 'real_decision' | 'synthetic_simulation';
}): ReinvestmentAssessmentResult {
  const { netProceeds, candidates, portfolioTotalValue, asOfDate, currency, executionMode } = params;

  const safeNetProceeds = Number.isFinite(netProceeds) && netProceeds > 0 ? Number(netProceeds.toFixed(2)) : 0;

  // Validate portfolioTotalValue as a finite positive number before computing allocation deficits
  if (!Number.isFinite(portfolioTotalValue) || portfolioTotalValue <= 0) {
    return {
      action: 'HOLD_AS_CASH',
      selectedCandidateId: null,
      selectedCandidateName: null,
      allocatedNetProceedsCurrency: 0,
      unallocatedNetProceedsToCash: safeNetProceeds,
      currency,
      rationale: `Invalid portfolioTotalValue: must be a positive finite number, received ${portfolioTotalValue}. Net proceeds held in cash reserves.`,
      candidateEvaluations: (candidates || []).map(cand => ({
        candidateId: cand.candidateId,
        holdingName: cand.holdingName,
        assetCategory: cand.assetCategory,
        thesisStatus: cand.thesisStatus,
        currentAllocationPercent: cand.currentAllocationPercent,
        targetAllocationPercent: cand.targetAllocationPercent,
        allocationDeficitPercent: 0,
        allocationDeficitCurrency: 0,
        valuationFavorable: cand.valuationFavorable,
        valuationMetricsCount: cand.valuationMetricsCount,
        evidenceFreshness: 'expired' as FreshnessStatus,
        evidenceVerification: 'unverified_third_party' as VerificationStatus,
        qualifiesForCapital: false,
        disqualificationReasons: [`Invalid portfolioTotalValue (${portfolioTotalValue}); cannot compute allocation deficit.`],
        comparativeConvictionScore: 0
      }))
    };
  }

  if (!candidates || candidates.length === 0 || safeNetProceeds <= 0) {
    return {
      action: 'HOLD_AS_CASH',
      selectedCandidateId: null,
      selectedCandidateName: null,
      allocatedNetProceedsCurrency: 0,
      unallocatedNetProceedsToCash: safeNetProceeds,
      currency,
      rationale: safeNetProceeds <= 0 ? 'No net proceeds generated.' : 'No reinvestment candidates submitted; net proceeds held in cash reserves.',
      candidateEvaluations: []
    };
  }

  const evaluations: ReinvestmentCandidateEvaluation[] = [];

  for (const cand of candidates) {
    const reasons: string[] = [];
    let qualifies = true;

    // Validate candidate target and current allocation percentages
    const isTargetValid =
      typeof cand.targetAllocationPercent === 'number' &&
      Number.isFinite(cand.targetAllocationPercent) &&
      cand.targetAllocationPercent >= 0 &&
      cand.targetAllocationPercent <= 100;

    const isCurrentValid =
      typeof cand.currentAllocationPercent === 'number' &&
      Number.isFinite(cand.currentAllocationPercent) &&
      cand.currentAllocationPercent >= 0 &&
      cand.currentAllocationPercent <= 100;

    if (!isTargetValid) {
      qualifies = false;
      reasons.push(
        `targetAllocationPercent must be a finite percentage between 0 and 100, received ${cand.targetAllocationPercent}`
      );
    }

    if (!isCurrentValid) {
      qualifies = false;
      reasons.push(
        `currentAllocationPercent must be a finite percentage between 0 and 100, received ${cand.currentAllocationPercent}`
      );
    }

    // Thesis qualification
    if (cand.thesisStatus !== 'intact') {
      qualifies = false;
      reasons.push(`Thesis status is '${cand.thesisStatus}' (must be intact)`);
    }

    // Allocation deficit calculation (safe from NaN/Infinity)
    let deficitPercent = 0;
    let deficitCurrency = 0;
    if (isTargetValid && isCurrentValid) {
      deficitPercent = Math.max(0, cand.targetAllocationPercent - cand.currentAllocationPercent);
      deficitCurrency = Number(((deficitPercent / 100) * portfolioTotalValue).toFixed(2));
      if (deficitPercent <= 0) {
        qualifies = false;
        reasons.push('Candidate is not underweight (deficit <= 0)');
      }
    } else {
      qualifies = false;
    }

    // Valuation qualification
    if (cand.valuationFavorable !== true) {
      qualifies = false;
      reasons.push('Valuation is not favorable');
    }

    // Evidence freshness evaluation (independent of thesis/deficit)
    const policy = ASSET_CATEGORY_POLICIES[cand.assetCategory] ?? ASSET_CATEGORY_POLICIES.equity;
    const dateValidation = validateDateFreshness(cand.valuationAssessmentTimestamp, policy.provisionalFreshnessThresholdDays, asOfDate);

    let evidenceFreshness: FreshnessStatus;
    if (!dateValidation.isValid) {
      evidenceFreshness = 'expired';
      qualifies = false;
      reasons.push(dateValidation.reason ?? 'Valuation timestamp invalid');
    } else if (!dateValidation.isFresh) {
      evidenceFreshness = 'stale';
      qualifies = false;
      reasons.push(dateValidation.reason ?? 'Valuation timestamp stale');
    } else {
      evidenceFreshness = 'fresh';
    }

    // Evidence quality check
    if (cand.evidenceQuality === 'conflicting') {
      qualifies = false;
      reasons.push('Evidence quality is conflicting');
    } else if (cand.evidenceQuality === 'stale_or_missing') {
      qualifies = false;
      reasons.push('Evidence quality is stale_or_missing');
    }

    // Evidence verification evaluation
    let evidenceVerification: VerificationStatus;
    if (cand.evidenceRecords && cand.evidenceRecords.length > 0) {
      const allPrimary = cand.evidenceRecords.every(r => r.verificationStatus === 'verified_primary');
      const anyUnverified = cand.evidenceRecords.some(r => r.verificationStatus === 'unverified_third_party');
      const anySimulated = cand.evidenceRecords.some(r => r.verificationStatus === 'simulated_demonstration');

      if (allPrimary) {
        evidenceVerification = cand.verificationStatus ?? 'verified_primary';
      } else if (anyUnverified) {
        // Mixed verification statuses containing unverified records fail verification
        evidenceVerification = 'unverified_third_party';
      } else if (anySimulated) {
        // Wholly or partly simulated demonstration records
        evidenceVerification = 'simulated_demonstration';
      } else {
        evidenceVerification = 'unverified_third_party';
      }
    } else if (cand.verificationStatus) {
      evidenceVerification = cand.verificationStatus;
    } else {
      evidenceVerification = 'unverified_third_party';
    }

    if (evidenceVerification === 'unverified_third_party') {
      qualifies = false;
      reasons.push('Candidate evidence lacks primary statutory verification');
    } else if (executionMode === 'real_decision' && evidenceVerification === 'simulated_demonstration') {
      qualifies = false;
      reasons.push('Candidate evidence is simulated demonstration in real decision mode');
    }

    evaluations.push({
      candidateId: cand.candidateId,
      holdingName: cand.holdingName,
      assetCategory: cand.assetCategory,
      thesisStatus: cand.thesisStatus,
      currentAllocationPercent: cand.currentAllocationPercent,
      targetAllocationPercent: cand.targetAllocationPercent,
      allocationDeficitPercent: deficitPercent,
      allocationDeficitCurrency: deficitCurrency,
      valuationFavorable: cand.valuationFavorable,
      valuationMetricsCount: cand.valuationMetricsCount,
      evidenceFreshness,
      evidenceVerification,
      qualifiesForCapital: qualifies,
      disqualificationReasons: reasons,
      comparativeConvictionScore: qualifies ? 80 + deficitPercent : 30
    });
  }

  // Filter qualified candidates and select best candidate
  const qualified = evaluations.filter(e => e.qualifiesForCapital);
  if (qualified.length === 0) {
    return {
      action: 'HOLD_AS_CASH',
      selectedCandidateId: null,
      selectedCandidateName: null,
      allocatedNetProceedsCurrency: 0,
      unallocatedNetProceedsToCash: safeNetProceeds,
      currency,
      rationale: 'All submitted reinvestment candidates failed fiduciary qualification hurdles. Net proceeds park in risk-free cash liquidity.',
      candidateEvaluations: evaluations
    };
  }

  // Rank by conviction / deficit
  qualified.sort((a, b) => (b.comparativeConvictionScore ?? 0) - (a.comparativeConvictionScore ?? 0));
  const selected = qualified[0];
  const maxAllocatable = selected.allocationDeficitCurrency ?? safeNetProceeds;
  const committed = Number(Math.min(safeNetProceeds, maxAllocatable).toFixed(2));
  const remainingCash = Number(Math.max(0, safeNetProceeds - committed).toFixed(2));

  return {
    action: 'REINVEST_NET_PROCEEDS',
    selectedCandidateId: selected.candidateId,
    selectedCandidateName: selected.holdingName,
    allocatedNetProceedsCurrency: committed,
    unallocatedNetProceedsToCash: remainingCash,
    currency,
    rationale: `Allocating $${committed.toFixed(2)} net proceeds to ${selected.holdingName} (up to allocation deficit); retaining $${remainingCash.toFixed(2)} in cash reserves.`,
    candidateEvaluations: evaluations,
    cashPreservationRationale: remainingCash > 0 ? `Excess net proceeds of $${remainingCash.toFixed(2)} retained in cash to prevent over-allocating past target.` : undefined
  };
}

export function evaluateUnallocatedOpportunities(
  candidates?: ProfitRealizationEngineInput['reinvestmentCandidates'],
  portfolioTotalValue?: number
): UnallocatedCapitalOpportunity[] {
  if (!candidates || candidates.length === 0 || !portfolioTotalValue || !Number.isFinite(portfolioTotalValue) || portfolioTotalValue <= 0) return [];

  const opportunities: UnallocatedCapitalOpportunity[] = [];

  for (const cand of candidates) {
    const isTargetValid =
      typeof cand.targetAllocationPercent === 'number' &&
      Number.isFinite(cand.targetAllocationPercent) &&
      cand.targetAllocationPercent >= 0 &&
      cand.targetAllocationPercent <= 100;

    const isCurrentValid =
      typeof cand.currentAllocationPercent === 'number' &&
      Number.isFinite(cand.currentAllocationPercent) &&
      cand.currentAllocationPercent >= 0 &&
      cand.currentAllocationPercent <= 100;

    if (!isTargetValid || !isCurrentValid) continue;

    const deficitPercent = Math.max(0, cand.targetAllocationPercent - cand.currentAllocationPercent);
    if (deficitPercent > 0 && cand.thesisStatus === 'intact' && cand.valuationFavorable === true) {
      opportunities.push({
        candidateId: cand.candidateId,
        holdingName: cand.holdingName,
        assetCategory: cand.assetCategory,
        allocationDeficitCurrency: Number(((deficitPercent / 100) * portfolioTotalValue).toFixed(2)),
        rationale: `Underweight by ${deficitPercent.toFixed(2)}% with intact thesis and favorable valuation. Eligible for new cash deposits or idle cash independent of realized sales.`,
        eligibleForNewDepositsOrIdleCash: true
      });
    }
  }

  return opportunities;
}
