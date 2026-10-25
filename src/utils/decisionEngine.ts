/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DecisionOutcome,
  AssetCategory,
  VerificationStatus,
  FreshnessStatus,
  EvidenceQuality,
  EvidenceFinding
} from '../types/investment';
import { SYNTHETIC_EVIDENCE_FINDINGS } from '../data/syntheticPortfolio';

/**
 * Configurable freshness policy by source type and data category.
 * Resolves inconsistent flat day thresholds (such as 140 vs 180 days).
 */
export interface FreshnessPolicyRule {
  sourceType: string;
  maxFreshDays: number;
  maxAdequateDays: number;
  description: string;
}

export const FRESHNESS_POLICIES: Record<string, FreshnessPolicyRule> = {
  SEC_FILING_ANNUAL: {
    sourceType: 'SEC_FILING_ANNUAL',
    maxFreshDays: 365,
    maxAdequateDays: 455, // Annual cycle + 90 days statutory filing grace
    description: 'Audited annual reports (SEC Form 10-K). Fresh within 365 days, adequate up to 455 days.'
  },
  SEC_FILING_QUARTERLY: {
    sourceType: 'SEC_FILING_QUARTERLY',
    maxFreshDays: 95,
    maxAdequateDays: 135, // 90 days quarter + 45 days filing window
    description: 'Quarterly reviews (SEC Form 10-Q). Fresh within 95 days, adequate up to 135 days.'
  },
  KAP_DISCLOSURE: {
    sourceType: 'KAP_DISCLOSURE',
    maxFreshDays: 105,
    maxAdequateDays: 145, // Borsa Istanbul statutory period
    description: 'KAP public disclosure reports. Fresh within 105 days, adequate up to 145 days.'
  },
  TEFAS_FACTSHEET: {
    sourceType: 'TEFAS_FACTSHEET',
    maxFreshDays: 35,
    maxAdequateDays: 55, // Monthly fund portfolio distribution requirement
    description: 'TEFAS monthly mutual fund portfolio distribution reports. Fresh within 35 days, adequate up to 55 days.'
  },
  ONCHAIN_AUDIT: {
    sourceType: 'ONCHAIN_AUDIT',
    maxFreshDays: 365,
    maxAdequateDays: 730, // Major consensus client release cycles
    description: 'Bitcoin core consensus code audit. Valid across protocol release lifecycle.'
  },
  ONCHAIN_METRIC: {
    sourceType: 'ONCHAIN_METRIC',
    maxFreshDays: 30,
    maxAdequateDays: 60, // On-chain network flow metrics
    description: 'Dynamic on-chain address activity and supply distribution telemetry.'
  },
  CENTRAL_BANK_REPORT: {
    sourceType: 'CENTRAL_BANK_REPORT',
    maxFreshDays: 180,
    maxAdequateDays: 365, // BIS / Basel macro monitoring cycles
    description: 'Central bank / Basel Committee prudential standards.'
  },
  DEFAULT: {
    sourceType: 'DEFAULT',
    maxFreshDays: 90,
    maxAdequateDays: 135,
    description: 'Standard financial disclosure baseline.'
  }
};

/**
 * Computes deterministic freshness status based on source type policy and publication date.
 * - Removes hardcoded 2026-02-20 default: uses current runtime date when asOfDateStr is omitted.
 * - Rejects invalid dates.
 * - Flags publication dates in the future rather than marking them fresh.
 * - Preserves configurable source-specific freshness policies.
 */
export function determineFreshnessStatus(
  sourceType: string,
  publicationDateStr: string,
  asOfDateStr?: string
): FreshnessStatus {
  if (!publicationDateStr) return 'expired';

  const pubDate = new Date(publicationDateStr);
  const asOfDate = asOfDateStr ? new Date(asOfDateStr) : new Date();

  if (isNaN(pubDate.getTime()) || isNaN(asOfDate.getTime())) {
    return 'expired';
  }

  // Future publication dates must never be marked fresh or adequate
  if (pubDate.getTime() > asOfDate.getTime()) {
    return 'expired';
  }

  const diffMs = asOfDate.getTime() - pubDate.getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  const policy = FRESHNESS_POLICIES[sourceType] || FRESHNESS_POLICIES.DEFAULT;

  if (diffDays <= policy.maxFreshDays) {
    return 'fresh';
  }
  if (diffDays <= policy.maxAdequateDays) {
    return 'adequate';
  }
  return 'stale';
}

/**
 * Looks up an evidence record by ID.
 * - If customRecords is explicitly supplied, searches ONLY customRecords (never falls back to synthetic).
 * - If the requested ID is missing in customRecords, returns undefined.
 * - Uses the synthetic registry ONLY when caller explicitly selects synthetic/demo context and no custom registry is supplied.
 * - In real mode or when synthetic context is not explicitly selected, returns undefined when customRecords is missing.
 */
export function findEvidenceRecord(
  id: string,
  customRecords?: EvidenceFinding[],
  options?: { isSyntheticContext?: boolean }
): EvidenceFinding | undefined {
  if (customRecords !== undefined) {
    return customRecords.find(r => r.id === id);
  }

  if (options?.isSyntheticContext === true) {
    return SYNTHETIC_EVIDENCE_FINDINGS.find(r => r.id === id);
  }

  return undefined;
}

export interface ContextValidationResult {
  isValid: boolean;
  rejectionReason?: string;
}

/**
 * Validates whether an evidence finding actually confirms a thesis invalidation claim.
 * Under V4 rules:
 * - Bare boolean flags (supportsThesisInvalidation === true) are rejected if the claim does not affirm impairment.
 * - Negated statements ("did not breach", "no impairment") are rejected.
 * - Hypothetical / unconfirmed statements ("was possible", "might occur", "could breach") are rejected.
 * - Allegations, rumors, and denials ("denied the reported", "unconfirmed reports allege") are rejected.
 * - Relevant keywords in unrelated contexts (e.g. power grid defaults, software default settings) are rejected.
 * - Affirmative, verified statements of structural moat destruction, negative gross margin, or debt default are accepted.
 */
export function validateThesisInvalidationClaim(record: EvidenceFinding): ContextValidationResult {
  if (record.supportsThesisInvalidation === false) {
    return { isValid: false, rejectionReason: 'supportsThesisInvalidation is explicitly false.' };
  }

  // 1. Check structured claim metadata if present
  if (record.claimModality && record.claimModality !== 'confirmed_fact') {
    return {
      isValid: false,
      rejectionReason: `Claim modality is "${record.claimModality}". Only confirmed facts can support thesis invalidation.`
    };
  }
  if (record.claimScope && record.claimScope !== 'holding_specific') {
    return {
      isValid: false,
      rejectionReason: `Claim scope is "${record.claimScope}". Thesis invalidation requires holding-specific impairment.`
    };
  }

  const text = `${record.claim || ''} ${record.excerpt || ''}`.toLowerCase().trim();
  if (!text) {
    return { isValid: false, rejectionReason: 'Claim and excerpt text is empty.' };
  }

  // 2. Unrelated context check (e.g. power grid, utility, datacenter cooling, software parameters, campus cafeteria)
  const unrelatedPatterns = [
    /\b(?:power\s+grids?|utility\s+power|datacenter\s+architecture|software\s+default|default\s+settings?|default\s+route|default\s+font|default\s+parameter|default\s+value|security\s+breach|data\s+breach)\b/i,
    /\b(?:cafeteria|coffee|organic|food\s+service|campus\s+facility|meals|beverage|satisfaction\s+index|employee\s+survey)\b/i
  ];
  if (unrelatedPatterns.some(pattern => pattern.test(text))) {
    return {
      isValid: false,
      rejectionReason: 'Claim contains keyword in an unrelated technical or non-financial context.'
    };
  }

  // 3. Negation check (e.g. "did not breach", "no breach", "never breached", "not impaired")
  const negationPatterns = [
    /\b(?:did\s+not|does\s+not|has\s+not|have\s+not|was\s+not|were\s+not|is\s+not|are\s+not)\s+(?:breach|default|collapse|impair|trigger|enter|suffer)\b/i,
    /\b(?:no|zero|without|neither)\s+(?:covenant\s+breach|debt\s+default|breach|default|impairment|insolvency|collapse|obsolescence)\b/i,
    /\b(?:never|not\s+in)\s+(?:breach|default|violation)\b/i,
    /\bnot\s+(?:breached|impaired|collapsed|defaulted)\b/i,
    /\bfailed\s+to\s+find\s+any\s+(?:breach|default|impairment)\b/i
  ];
  if (negationPatterns.some(pattern => pattern.test(text))) {
    return {
      isValid: false,
      rejectionReason: 'Claim contains explicit negation of the impairment condition.'
    };
  }

  // 4. Hypothetical / speculative check (e.g. "was possible", "might occur", "could breach", "no breach has been confirmed")
  const hypotheticalPatterns = [
    /\b(?:was\s+possible|is\s+possible|could\s+be\s+possible|possibility\s+of)\b/i,
    /\b(?:might\s+(?:occur|breach|default|happen)|could\s+(?:occur|breach|default|happen|trigger))\b/i,
    /\b(?:potential|potentially|hypothetical|speculative|projected)\s+(?:covenant|breach|default|collapse|impairment|insolvency)\b/i,
    /\b(?:warned\s+that|warns\s+that).*?\b(?:possible|could|might)\b/i,
    /\b(?:no\s+breach\s+has\s+been\s+confirmed|has\s+not\s+(?:been\s+confirmed|occurred|materialized))\b/i,
    /\bif\s+.*?\b(?:might|could|would)\b/i,
    /\b(?:at\s+risk\s+of\s+potential)\b/i
  ];
  if (hypotheticalPatterns.some(pattern => pattern.test(text))) {
    return {
      isValid: false,
      rejectionReason: 'Claim represents a hypothetical or unmaterialized scenario.'
    };
  }

  // 5. Denial / rebuttal / unconfirmed rumor check (e.g. "denied the reported", "unconfirmed reports allege", "rumors")
  const denialAndAllegationPatterns = [
    /\b(?:denied|denies|rebutted|rebuts|refuted|refutes|dismissed|rejected)\s+(?:the\s+|reports\s+of\s+|claims\s+of\s+|allegations?\s+of\s+)?(?:reported\s+|alleged\s+)?(?:covenant|breach|default|impairment|insolvency|collapse|obsolescence)\b/i,
    /\b(?:unconfirmed|unsubstantiated|rumored|rumor|rumours|alleged|allegations?|allegedly|unverified\s+reports?)\b/i,
    /\b(?:disputed|disputes|dispute\s+over)\s+(?:the\s+|reported\s+|alleged\s+)?(?:covenant|breach|default|impairment|margin)\b/i
  ];
  if (denialAndAllegationPatterns.some(pattern => pattern.test(text))) {
    return {
      isValid: false,
      rejectionReason: 'Claim represents a denial, rebuttal, or unconfirmed rumor.'
    };
  }

  // 6. Affirmative financial impairment check
  const isAffirmativeImpairment =
    /\b(?:negative\s+gross\s+margin|gross\s+margin\s+(?:decreased\s+to\s+negative|collapsed\s+to\s+negative|inverted)|inversion\s+of\s+gross\s+margin)\b/i.test(text) ||
    /\b(?:breached\s+(?:its\s+)?(?:debt\s+|senior\s+|credit\s+)?covenant|covenant\s+breach|covenant\s+default|declared\s+covenant\s+default|forbearance\s+agreement\s+for\s+covenant\s+default)\b/i.test(text) ||
    /\b(?:inventory\s+obsolescence(?:\s+write-downs?)?|structural\s+economic\s+moat\s+destruction|permanent\s+loss\s+of\s+pricing\s+power|debt\s+covenant\s+defaults?)\b/i.test(text) ||
    /\b(?:entered\s+(?:into\s+)?senior\s+credit\s+covenant\s+breach)\b/i.test(text) ||
    /\b(?:senior\s+credit\s+facility\s+forced\s+strict\s+liquidity\s+covenants)\b/i.test(text) ||
    /\b(?:permanent\s+inversion\s+of\s+gross\s+margins)\b/i.test(text);

  if (!isAffirmativeImpairment) {
    return {
      isValid: false,
      rejectionReason: 'Claim does not affirmatively confirm material financial or economic moat impairment.'
    };
  }

  return { isValid: true };
}

export function doesEvidenceSupportInvalidation(record: EvidenceFinding): boolean {
  return validateThesisInvalidationClaim(record).isValid;
}

/**
 * Validates whether an evidence finding actually confirms a documented risk or concentration concern.
 * Under V4 rules:
 * - Bare boolean flags (supportsRiskConcern === true) are rejected if the claim does not affirm risk.
 * - Negated statements ("did not breach the mandate ceiling", "within mandate limits") are rejected.
 * - Hypothetical risk ("potential mandate ceiling breach is possible") is rejected.
 * - General market volatility or macroeconomic commentary without holding-specific or portfolio mandate breach is rejected.
 * - Price decline alone without independently documented risk concerns is rejected.
 * - Explicitly documented breaches of concentration, mandate, or single issuer ceilings are accepted.
 */
export function validateRiskConcernClaim(record: EvidenceFinding): ContextValidationResult {
  if (record.supportsRiskConcern === false) {
    return { isValid: false, rejectionReason: 'supportsRiskConcern is explicitly false.' };
  }

  // 1. Check structured metadata
  if (record.claimModality && record.claimModality !== 'confirmed_fact') {
    return {
      isValid: false,
      rejectionReason: `Claim modality is "${record.claimModality}". Only confirmed facts can support risk reduction.`
    };
  }
  if (record.claimScope && (record.claimScope === 'macro_general' || record.claimScope === 'unrelated')) {
    return {
      isValid: false,
      rejectionReason: `Claim scope is "${record.claimScope}". Risk reduction requires holding-specific or portfolio-specific limits.`
    };
  }

  const text = `${record.claim || ''} ${record.excerpt || ''}`.toLowerCase().trim();
  if (!text) {
    return { isValid: false, rejectionReason: 'Claim and excerpt text is empty.' };
  }

  // 2. Unrelated / macro-general / stock-price-only check
  const macroOrPricePatterns = [
    /\b(?:broad\s+(?:stock\s+)?market\s+volatility|general\s+market\s+volatility|macroeconomic\s+uncertainty|global\s+markets\s+volatility)\b/i,
    /\b(?:cafeteria|coffee|organic|food\s+service|satisfaction\s+index|employee\s+survey)\b/i
  ];
  const isHoldingOrPortfolioSpecific =
    /\b(?:position|concentration|single\s+issuer|issuer\s+exposure|portfolio|mandate|weight|allocation|ceiling|overweight|exposure\s+limit|counterparty|derivative\s+ceiling)\b/i.test(text);

  if (macroOrPricePatterns.some(pattern => pattern.test(text)) && !isHoldingOrPortfolioSpecific) {
    return {
      isValid: false,
      rejectionReason: 'Claim describes general macroeconomic volatility without holding-specific or portfolio-specific mandate concern.'
    };
  }

  // Pure price decline without independent risk evidence
  const isPriceDropOnly =
    /\b(?:stock\s+price\s+declined|price\s+dropped|shares\s+fell)\b/i.test(text) &&
    !isHoldingOrPortfolioSpecific;
  if (isPriceDropOnly) {
    return {
      isValid: false,
      rejectionReason: 'Price decline alone does not constitute independent risk or concentration documentation.'
    };
  }

  // 3. Negation check (e.g. "did not breach the mandate ceiling", "within limits", "no ceiling breach", "no breach has been established", "no confirmed breach", "no documented breach", "breach was not found")
  const negationPatterns = [
    /\b(?:did\s+not|does\s+not|has\s+not|have\s+not|was\s+not|were\s+not|is\s+not|are\s+not)\s+(?:breach|exceed|violate)\s+(?:the\s+|a\s+|any\s+)?(?:statutory\s+|maximum\s+|defined\s+|mandated\s+)?(?:[\d.]+%?\s+)?(?:mandate|ceiling|limit|exposure)\b/i,
    /\b(?:no|there\s+is\s+no|there\s+was\s+no|zero|without\s+(?:any\s+)?)\s+(?:material\s+|actual\s+)?(?:confirmed|documented|verified|substantiated|established)?\s*(?:mandate\s+|ceiling\s+|limit\s+|concentration\s+|exposure\s+|derivative\s+|counterparty\s+)?breach\b/i,
    /\bno\s+breach\s+(?:has\s+been|was|is)\s+established\b/i,
    /\b(?:confirmed|documented|verified|alleged|reported|potential)?\s*breach\s+[^.!?]*\b(?:was\s+not|is\s+not|has\s+not\s+been|were\s+not|are\s+not)\s+(?:found|identified|established|detected|confirmed|substantiated|documented|observed)\b/i,
    /\b(?:confirmed|documented|verified|alleged|reported|potential)?\s*breach\s+[^.!?]*\bnot\s+found\b/i,
    /\b(?:remained|maintained|stayed)\s+within\s+(?:mandate|limit|ceiling|bounds)\b/i,
    /\bnot\s+(?:breached|exceeded|violated)\b/i
  ];
  if (negationPatterns.some(pattern => pattern.test(text))) {
    return {
      isValid: false,
      rejectionReason: 'Claim states that the risk or concentration limit was not breached or no breach has been established.'
    };
  }

  // 4. Hypothetical / speculative / unmaterialized check (e.g. "potential mandate ceiling breach is possible", "investigating a possible breach", "has not occurred")
  const hypotheticalPatterns = [
    /\b(?:potential|potentially|hypothetical|speculative|possible)\s+(?:mandate|ceiling|limit|concentration)\s+breach\b/i,
    /\b(?:is\s+possible|was\s+possible|might\s+occur|could\s+occur)\b/i,
    /\b(?:regulators\s+are\s+investigating|investigating\s+(?:a\s+)?possible\s+(?:mandate\s+)?breach)\b/i,
    /\b(?:if\s+.*?\b(?:continues|occurs|rallies)\b.*?\b(?:possible|could|might)\b)\b/i,
    /\b(?:has\s+not\s+(?:occurred|materialized|taken\s+place))\b/i
  ];
  if (hypotheticalPatterns.some(pattern => pattern.test(text))) {
    return {
      isValid: false,
      rejectionReason: 'Claim describes a hypothetical or unmaterialized risk concern.'
    };
  }

  // 5. Denial / dispute check
  const disputePatterns = [
    /\b(?:denied|denies|rebutted|rebuts|refuted|refutes|disputed|disputes)\s+(?:the\s+|reports\s+of\s+)?(?:concentration|ceiling|mandate)\s+breach\b/i,
    /\b(?:unconfirmed|unsubstantiated|rumored)\s+(?:risk|breach)\b/i
  ];
  if (disputePatterns.some(pattern => pattern.test(text))) {
    return {
      isValid: false,
      rejectionReason: 'Claim is disputed or unconfirmed.'
    };
  }

  // 6. Affirmative risk / concentration breach check
  // Each accepted pattern must describe an actual, materialized, holding-specific or portfolio-specific risk breach—
  // not a possible future risk, a preliminary recommendation, regulatory attention alone, or ceiling expansion with unverified counterparties.
  const isAffirmativeRiskBreach =
    /\b(?:breaches|breached|exceeds|exceeded|violated)\s+(?:the\s+|a\s+|an\s+)?(?:statutory\s+|maximum\s+|defined\s+|mandated\s+)?(?:[\d.]+%?\s+)?(?:single\s+issuer\s+(?:exposure\s+)?ceiling|single\s+issuer\s+(?:exposure\s+)?limit|risk\s+mandate\s+ceiling|mandate\s+ceiling|concentration\s+ceiling|exposure\s+ceiling|portfolio\s+limit|mandate\s+limit|concentration\s+limit|risk\s+limit|derivative\s+(?:exposure\s+)?(?:limit|ceiling)|counterparty\s+(?:exposure\s+)?(?:limit|ceiling))\b/i.test(text) ||
    /\b(?:position\s+concentration|concentration)\s+of\s+[\d.]+%?\s+(?:breaches|exceeds|violates)\b/i.test(text) ||
    /\b(?:concentration\s+exceeds\s+statutory\s+single-asset\s+risk\s+ceiling)\b/i.test(text) ||
    /\b(?:derivative|counterparty|single\s+issuer|issuer|position|portfolio)\s+(?:exposure|concentration)\s+(?:breaches|breached|exceeds|exceeded|violates|violated)\s+(?:the\s+|a\s+|an\s+)?(?:statutory\s+|maximum\s+|defined\s+|mandated\s+)?(?:[\d.]+%?\s+)?(?:limit|ceiling)\b/i.test(text) ||
    /\b(?:confirmed|documented)\s+(?:and\s+verified\s+)?breach\s+of\s+(?:a\s+|the\s+)?(?:defined\s+)?(?:concentration|mandate|risk|exposure|portfolio|derivative(?:\s+or\s+counterparty)?|counterparty)\s+(?:exposure\s+)?(?:limit|ceiling)\b/i.test(text) ||
    /\bbreach\s+of\s+(?:a\s+|the\s+)?(?:defined\s+)?(?:concentration|mandate|risk|exposure|portfolio|derivative(?:\s+or\s+counterparty)?|counterparty)\s+(?:exposure\s+)?(?:limit|ceiling)\s+(?:is|has\s+been)\s+(?:confirmed|documented)\b/i.test(text);

  if (!isAffirmativeRiskBreach) {
    const isUnverifiedCounterparty = /\bunverified\s+(?:otc\s+)?counterpart(?:y|ies)\b/i.test(text);
    return {
      isValid: false,
      rejectionReason: isUnverifiedCounterparty
        ? 'Claim describes unverified counterparties without independently confirming an actual, applicable mandate or concentration limit breach.'
        : 'Claim does not affirmatively confirm an actual, documented concentration, mandate, or portfolio risk breach.'
    };
  }

  return { isValid: true };
}

export function doesEvidenceSupportRisk(record: EvidenceFinding): boolean {
  return validateRiskConcernClaim(record).isValid;
}

export type DecisionExecutionMode = 'real_decision' | 'synthetic_simulation';

export interface ValuationAssessmentInput {
  isFavorable: boolean | null;
  inputTimestamp?: string;
  metricsCount?: number;
}

export interface DecisionEvaluationInput {
  holdingName: string;
  executionMode?: DecisionExecutionMode;
  assetCategory?: AssetCategory;
  thesisStatus: 'intact' | 'questionable' | 'materially_invalidated';
  evidenceQuality: 'verified_fresh' | 'adequate' | 'stale_or_missing' | 'conflicting';
  priceDrawdownPercent: number; // e.g. -35%
  allocationDriftPercent: number; // e.g. +4.2% or -3.5%

  // Valuation inputs (must be explicitly provided; never assumed true or zero)
  valuationFavorable?: boolean | null;
  valuationAssessment?: ValuationAssessmentInput;

  // Portfolio allocation & risk budget
  portfolioBudgetAvailable?: boolean;
  riskAssessmentSupportsIncrease?: boolean; // Must be explicitly true; undefined/null fails
  hasDocumentedRiskConcern?: boolean;      // Required for REDUCE outcome
  traceableRiskEvidenceIds?: string[];     // Traceable verified risk finding IDs

  // Thesis invalidation & verification safeguards
  verifiedMoatDestruction?: boolean;
  traceableEvidenceIds?: string[];
  evidenceVerificationStatus?: VerificationStatus;
  evidenceFreshnessStatus?: FreshnessStatus;
  hasUnresolvedCounterevidence?: boolean;
  structuralImpairmentRationale?: string;

  // Evidence registry & dates:
  evidenceRecords?: EvidenceFinding[];
  asOfDate?: string;
  allowSimulatedDemonstrationDraft?: boolean;
}

export interface DecisionEvaluationResult {
  outcome: DecisionOutcome;
  primaryRationale: string;
  appliedRules: {
    ruleNumber: number;
    ruleName: string;
    description: string;
    isKeyFactor: boolean;
  }[];
  violationsPrevented: string[];
  recommendedAction: string;
  isSimulatedDraft: boolean;
  missingDataReasons?: string[];
  reassessmentRequirements?: string[];
}

/**
 * Deterministic decision rule evaluator implementing the Investment Intelligence core principles:
 * - Rule 1: HOLD is default when evidence does not justify a change.
 * - Rule 2: Price drop or unrealized loss alone never triggers SELL.
 * - Rule 3: Allocation drift alone never triggers SELL, and drift alone cannot force REDUCE without documented, traceable risk concerns.
 * - Rule 4: INCREASE requires thesis quality, portfolio allocation, and valuation to be considered together with dated, non-future inputs and explicit positive risk budget. If any input is missing, stale, or conflicting, return INSUFFICIENT_EVIDENCE.
 * - Rule 5: SELL requires strong, verified, traceable primary evidence that materially invalidates the long-term thesis. A raw Boolean flag or synthetic-only evidence is rejected for real decisions.
 * - Rule 6: Missing, stale, or conflicting evidence forces INSUFFICIENT_EVIDENCE with explicit missing-data reasons.
 * - V3 Safeguards:
 *   1. Synthetic/demo evidence must never authorize a real SELL decision. Simulated testing is explicitly isolated.
 *   2. Custom registries are searched strictly without silent fallback to synthetic fixtures.
 *   3. Evidence support boolean flags alone are not trusted; claims must document substantive impairment or risk.
 *   4. Fail closed if execution mode cannot be determined safely.
 */
export function evaluateDecisionRules(input: DecisionEvaluationInput): DecisionEvaluationResult {
  const violationsPrevented: string[] = [];
  const appliedRules: DecisionEvaluationResult['appliedRules'] = [];
  const asOfDate = input.asOfDate ? new Date(input.asOfDate) : new Date();

  // =========================================================================
  // V3 SAFEGUARD: Execution Mode Determination & Fail Closed
  // =========================================================================
  // 1. Unrecognized or invalid execution mode fails closed
  if (
    input.executionMode !== undefined &&
    input.executionMode !== 'real_decision' &&
    input.executionMode !== 'synthetic_simulation'
  ) {
    return {
      outcome: 'INSUFFICIENT_EVIDENCE',
      primaryRationale: `Execution mode "${input.executionMode}" is invalid. The engine cannot safely determine the execution context and must fail closed under V3 safety requirements.`,
      appliedRules: [{
        ruleNumber: 6,
        ruleName: 'Execution Mode Fail-Closed Gate',
        description: 'Execution mode cannot be determined safely. The engine fails closed.',
        isKeyFactor: true
      }],
      violationsPrevented: ['V3 Safety Enforced: Invalid execution mode failed closed to prevent unverified decision.'],
      recommendedAction: 'Specify a valid executionMode ("real_decision" or "synthetic_simulation").',
      isSimulatedDraft: true,
      missingDataReasons: ['Execution mode cannot be determined safely.']
    };
  }

  // 2. Demo flag cannot silently bypass real-mode verification
  if (input.executionMode === 'real_decision' && input.allowSimulatedDemonstrationDraft === true) {
    return {
      outcome: 'INSUFFICIENT_EVIDENCE',
      primaryRationale: 'Conflicting execution mode parameters: allowSimulatedDemonstrationDraft is strictly prohibited in real_decision mode. A demo flag cannot bypass real-mode evidence verification.',
      appliedRules: [{
        ruleNumber: 5,
        ruleName: 'Demo Flag Bypass Rejection Gate',
        description: 'allowSimulatedDemonstrationDraft was supplied in real_decision mode. The engine strictly rejects demo flags in real decision contexts.',
        isKeyFactor: true
      }],
      violationsPrevented: ['V3 Safety Enforced: Demo flag attempted to bypass real decision mode; failed closed to INSUFFICIENT_EVIDENCE.'],
      recommendedAction: 'Remove allowSimulatedDemonstrationDraft flag when evaluating real decisions.',
      isSimulatedDraft: true,
      missingDataReasons: ['Conflicting execution mode configuration: demo flag in real decision mode.']
    };
  }

  // 3. Ambiguous execution mode: demo flag without explicit synthetic_simulation mode
  if (input.executionMode === undefined && input.allowSimulatedDemonstrationDraft === true) {
    return {
      outcome: 'INSUFFICIENT_EVIDENCE',
      primaryRationale: 'Execution mode cannot be determined safely: allowSimulatedDemonstrationDraft was set without explicit executionMode="synthetic_simulation". The engine fails closed to prevent unverified bypass.',
      appliedRules: [{
        ruleNumber: 6,
        ruleName: 'Execution Mode Ambiguity Gate',
        description: 'Demo flag provided without explicit synthetic_simulation execution mode. Failed closed.',
        isKeyFactor: true
      }],
      violationsPrevented: ['V3 Safety Enforced: Ambiguous execution mode with demo flag failed closed.'],
      recommendedAction: 'Explicitly set executionMode: "synthetic_simulation" to test synthetic scenarios.',
      isSimulatedDraft: true,
      missingDataReasons: ['Execution mode was not explicitly designated as synthetic_simulation.']
    };
  }

  const isSyntheticSimulation = input.executionMode === 'synthetic_simulation';
  const isRealDecisionMode = input.executionMode === 'real_decision' || (input.executionMode === undefined && !input.allowSimulatedDemonstrationDraft);

  // =========================================================================
  // SAFEGUARD 1: Check for Conflicting Evidence or Stale/Missing Primary Data
  // =========================================================================
  if (input.evidenceQuality === 'conflicting' || input.hasUnresolvedCounterevidence === true) {
    appliedRules.push({
      ruleNumber: 6,
      ruleName: 'Conflicting Evidence Guard',
      description: 'Disclosures or regulatory filings contain un-reconciled contradictory claims regarding business operations.',
      isKeyFactor: true
    });

    if (input.priceDrawdownPercent < -15) {
      violationsPrevented.push(`Rule 2 & 6 Enforced: Position fell ${input.priceDrawdownPercent.toFixed(1)}%, but conflicting filings exist. Engine strictly prohibited a panic SELL.`);
    }
    if (input.thesisStatus === 'materially_invalidated') {
      violationsPrevented.push('Safeguard 5 Enforced: Thesis invalidation was claimed, but conflicting evidence exists. Outcome was prevented from defaulting to SELL.');
    }

    return {
      outcome: 'INSUFFICIENT_EVIDENCE',
      primaryRationale: 'Conflicting evidence between public disclosures prevents high-confidence decision. Under Rule 6, no portfolio action (Increase, Reduce, or Sell) may be concluded until conflicting claims are verified or officially resolved.',
      appliedRules,
      violationsPrevented,
      recommendedAction: 'Place holding in research review queue. Reconcile contradictory disclosures against next audited statutory filing.',
      isSimulatedDraft: true,
      missingDataReasons: [
        'Conflicting disclosures between management reporting and independent regulatory inquiries.',
        'Lack of independent audit reconciliation resolving contradictory claims.'
      ],
      reassessmentRequirements: [
        'Obtain next statutory audited filing (SEC 10-K or KAP disclosure) addressing the disputed items.',
        'Verify regulatory inquiry resolution before altering capital commitment.'
      ]
    };
  }

  if (input.evidenceQuality === 'stale_or_missing' || input.evidenceFreshnessStatus === 'stale' || input.evidenceFreshnessStatus === 'expired') {
    appliedRules.push({
      ruleNumber: 6,
      ruleName: 'Evidence Freshness & Sufficiency Guard',
      description: 'Statutory documents are missing or exceed configured age policy thresholds for their source type.',
      isKeyFactor: true
    });

    if (input.priceDrawdownPercent < -15) {
      violationsPrevented.push(`Rule 2 & 6 Enforced: Position declined ${input.priceDrawdownPercent.toFixed(1)}%, but primary data is stale. Engine refused to force an emotional exit.`);
    }

    return {
      outcome: 'INSUFFICIENT_EVIDENCE',
      primaryRationale: 'Primary source documentation is stale or missing. Under Rule 6, the system strictly refuses to fabricate facts, guess forward metrics, or force a conviction outcome on outdated data.',
      appliedRules,
      violationsPrevented,
      recommendedAction: 'Suspend position modifications. Request fresh statutory reporting period disclosures or fund distribution factsheets.',
      isSimulatedDraft: true,
      missingDataReasons: [
        'Primary source filing exceeds freshness policy limits for this asset category.',
        'Recent quarterly or monthly portfolio attribution is missing from public disclosure archives.'
      ],
      reassessmentRequirements: [
        'Acquire updated regulatory filings (e.g., latest TEFAS monthly portfolio report or audited 10-Q/10-K).',
        'Verify that counterparty and derivatives exposure details are fully disclosed.'
      ]
    };
  }

  // =========================================================================
  // SAFEGUARD 2: SELL Evaluation (Rule 5 & Strict Traceability Validation)
  // =========================================================================
  if (input.thesisStatus === 'materially_invalidated') {
    const hasTraceableEvidence = Array.isArray(input.traceableEvidenceIds) && input.traceableEvidenceIds.length > 0;

    // Check 1: Must have traceable evidence IDs
    if (!hasTraceableEvidence) {
      appliedRules.push({
        ruleNumber: 5,
        ruleName: 'Evidentiary Traceability Gate (Boolean Flag Rejection)',
        description: 'Thesis invalidation was asserted, but verifiable, traceable evidence citations are absent. A Boolean flag alone is rejected.',
        isKeyFactor: true
      });

      violationsPrevented.push('Safeguard 7 Enforced: A Boolean verification flag was passed without traceable supporting evidence. The engine refused to trigger SELL.');

      return {
        outcome: 'INSUFFICIENT_EVIDENCE',
        primaryRationale: 'Thesis invalidation was asserted, but traceable empirical evidence citations are absent. Rule 5 strictly forbids concluding a SELL on unverified assertions or bare Boolean flags without traceable statutory citations.',
        appliedRules,
        violationsPrevented,
        recommendedAction: 'Hold position in review status. Require traceable primary filing accession records before considering an exit.',
        isSimulatedDraft: true,
        missingDataReasons: [
          'Traceable primary filing citations (accession numbers, verified audit statements) are absent.',
          'Claimed moat invalidation lacks corroborating primary source documents.'
        ],
        reassessmentRequirements: [
          'Submit primary source accession records documenting structural margin collapse or debt covenant default.',
          'Verify that the impairment is irreversible and not temporary cyclical weakness.'
        ]
      };
    }

    // Check 2: Validate every traceable evidence ID against an existing evidence record
    for (const evidenceId of input.traceableEvidenceIds!) {
      const record = findEvidenceRecord(evidenceId, input.evidenceRecords, { isSyntheticContext: isSyntheticSimulation });

      if (!record) {
        appliedRules.push({
          ruleNumber: 5,
          ruleName: 'Evidence Record Existence Gate',
          description: `Traceable evidence ID "${evidenceId}" was not found in the verified evidence registry.`,
          isKeyFactor: true
        });

        violationsPrevented.push(`Rule 5 Enforced: Attempted SELL with nonexistent evidence ID "${evidenceId}" was rejected.`);

        return {
          outcome: 'INSUFFICIENT_EVIDENCE',
          primaryRationale: `Traceable evidence ID "${evidenceId}" was not found in the verified evidence registry. Traceability validation failed under Rule 5.`,
          appliedRules,
          violationsPrevented,
          recommendedAction: 'Audit evidence registry. Verify that referenced source citations are indexed.',
          isSimulatedDraft: true,
          missingDataReasons: [
            `Nonexistent or unindexed evidence ID: ${evidenceId}. Traceability validation failed.`
          ],
          reassessmentRequirements: [
            'Provide verified accession citation indexed in statutory filing database.'
          ]
        };
      }

      // Check 3: Synthetic evidence must NEVER authorize real SELL decisions
      const isRecordSynthetic =
        record.isSyntheticDemonstration === true ||
        record.verificationStatus === 'simulated_demonstration' ||
        input.evidenceVerificationStatus === 'simulated_demonstration';

      if (isRecordSynthetic && !isSyntheticSimulation) {
        appliedRules.push({
          ruleNumber: 5,
          ruleName: 'Synthetic Evidence Rejection Gate (Real Mode)',
          description: `Linked evidence (${record.id}) is marked as simulated demonstration data. Synthetic-only evidence cannot authorize a real SELL decision.`,
          isKeyFactor: true
        });

        violationsPrevented.push('Rule 5 & V3 Safety Enforced: Synthetic evidence was strictly prohibited from authorizing a real SELL decision. SELL attempted with synthetic-only evidence was rejected.');

        return {
          outcome: 'INSUFFICIENT_EVIDENCE',
          primaryRationale: `Linked evidence record ${record.id} is marked as simulated demonstration data. Under Rule 5 and V3 Safety Hardening, synthetic/demo evidence must never authorize a SELL decision in real decision mode.`,
          appliedRules,
          violationsPrevented,
          recommendedAction: 'Acquire real-world audited statutory disclosures. Synthetic test fixtures cannot substantiate capital liquidation.',
          isSimulatedDraft: true,
          missingDataReasons: [
            `Linked evidence record ${record.id} is synthetic demonstration data, not a verified statutory filing.`
          ],
          reassessmentRequirements: [
            'Submit primary audited statutory filing (e.g. SEC Form 10-K or KAP disclosure) with verified_primary status.'
          ]
        };
      }

      // Check 4: Evidence claim must actually support the thesis-invalidating claim (do not trust flag alone)
      if (!doesEvidenceSupportInvalidation(record)) {
        appliedRules.push({
          ruleNumber: 5,
          ruleName: 'Thesis Invalidation Relevance Gate',
          description: `Traceable evidence record ${record.id} does not substantiate structural thesis invalidation.`,
          isKeyFactor: true
        });

        violationsPrevented.push('Rule 5 Enforced: SELL attempted with evidence that does not support the claimed thesis invalidation was rejected.');

        return {
          outcome: 'INSUFFICIENT_EVIDENCE',
          primaryRationale: `Traceable evidence record ${record.id} ("${record.claim.substring(0, 80)}...") does not support the claimed thesis invalidation. Under Rule 5 and V3 safety rules, evidence flags alone are insufficient; the claim must document permanent moat destruction or financial failure.`,
          appliedRules,
          violationsPrevented,
          recommendedAction: 'Re-evaluate thesis invalidation claim. The cited evidence does not document structural business impairment.',
          isSimulatedDraft: true,
          missingDataReasons: [
            `Linked evidence record ${record.id} fails to substantiate thesis invalidation or structural economic moat destruction.`
          ],
          reassessmentRequirements: [
            'Provide primary source citations proving irreversible gross margin collapse or debt covenant default.'
          ]
        };
      }

      // Check 5: Verification status requirement in real mode
      if (isRealDecisionMode && record.verificationStatus !== 'verified_primary') {
        appliedRules.push({
          ruleNumber: 5,
          ruleName: 'Statutory Verification Status Gate',
          description: `Evidence record ${record.id} lacks verified_primary status.`,
          isKeyFactor: true
        });

        return {
          outcome: 'INSUFFICIENT_EVIDENCE',
          primaryRationale: `Traceable evidence record ${record.id} has verification status '${record.verificationStatus}'. Only verified_primary statutory evidence satisfies SELL criteria in real decision mode.`,
          appliedRules,
          violationsPrevented,
          recommendedAction: 'Verify citation against official SEC EDGAR or KAP repository.',
          isSimulatedDraft: true,
          missingDataReasons: [`Evidence record ${record.id} lacks verified_primary status.`]
        };
      }

      // Check 6: Freshness of evidence record
      if (record.freshnessStatus === 'stale' || record.freshnessStatus === 'expired') {
        appliedRules.push({
          ruleNumber: 5,
          ruleName: 'Evidence Freshness Gate',
          description: `Traceable evidence record ${record.id} is stale or expired.`,
          isKeyFactor: true
        });

        return {
          outcome: 'INSUFFICIENT_EVIDENCE',
          primaryRationale: `Traceable evidence record ${record.id} is stale or expired under configured freshness policy. Current statutory disclosures are required to justify a thesis-invalidating exit.`,
          appliedRules,
          violationsPrevented,
          recommendedAction: 'Retrieve most recent filing period disclosure.',
          isSimulatedDraft: true,
          missingDataReasons: [`Evidence record ${record.id} exceeds freshness policy limits.`]
        };
      }

      // Check 7: Conflicting claims on evidence record
      if (record.isConflicting === true || record.type === 'conflicting_evidence') {
        appliedRules.push({
          ruleNumber: 5,
          ruleName: 'Evidence Conflict Gate',
          description: `Traceable evidence record ${record.id} contains unresolved conflicting claims.`,
          isKeyFactor: true
        });

        return {
          outcome: 'INSUFFICIENT_EVIDENCE',
          primaryRationale: `Traceable evidence record ${record.id} contains unresolved conflicting claims. Rule 6 forbids concluding SELL on unresolved conflicting claims.`,
          appliedRules,
          violationsPrevented,
          recommendedAction: 'Reconcile conflicting disclosures before concluding thesis invalidation.',
          isSimulatedDraft: true,
          missingDataReasons: [`Evidence record ${record.id} is marked as conflicting.`]
        };
      }
    }

    // High-bar satisfied: Verified structural failure with traceable valid evidence
    appliedRules.push({
      ruleNumber: 5,
      ruleName: 'Structural Thesis Invalidation (High-Bar Met)',
      description: 'Audited statutory filings provide traceable empirical proof that the core economic moat is permanently compromised.',
      isKeyFactor: true
    });

    if (input.priceDrawdownPercent < -20) {
      violationsPrevented.push(`Rule 2 Enforced: Position has an unrealized loss of ${input.priceDrawdownPercent.toFixed(1)}%, but SELL draft was justified STRICTLY by audited structural moat failure, never by price action alone.`);
    }

    // Explicitly isolate synthetic simulation from real investment recommendation
    if (isSyntheticSimulation) {
      return {
        outcome: 'SELL',
        primaryRationale: '[SIMULATED SCENARIO ONLY — NOT A REAL INVESTMENT RECOMMENDATION] ' +
          (input.structuralImpairmentRationale ||
            'Audited disclosures demonstrate structural moat destruction. Evaluated under isolated synthetic simulation scenario testing.'),
        appliedRules: [
          ...appliedRules,
          {
            ruleNumber: 5,
            ruleName: 'Isolated Synthetic Scenario Simulation',
            description: 'Evaluated strictly in isolated synthetic simulation mode. This is a demonstration sandbox outcome, not a real investment recommendation.',
            isKeyFactor: true
          }
        ],
        violationsPrevented,
        recommendedAction: 'SIMULATED SCENARIO ONLY: This is a sandbox demonstration for testing decision logic. Never use as an investment recommendation or execute market orders.',
        isSimulatedDraft: true
      };
    }

    return {
      outcome: 'SELL',
      primaryRationale: input.structuralImpairmentRationale ||
        'Traceable, audited statutory filings confirm permanent destruction of the core economic moat. In accordance with Rule 5, capital must be protected through a disciplined exit draft regardless of prior cost basis.',
      appliedRules,
      violationsPrevented,
      recommendedAction: 'Simulated decision draft requiring fiduciary human review. The terminal never executes automated market orders.',
      isSimulatedDraft: true
    };
  }

  // =========================================================================
  // SAFEGUARD 3: Price Drop & Allocation Drift Guards (Rule 2 & Rule 3)
  // =========================================================================
  if (input.priceDrawdownPercent < -15 && input.thesisStatus === 'intact') {
    violationsPrevented.push(`Rule 2 Enforced: Position price declined ${input.priceDrawdownPercent.toFixed(1)}%, but fundamental thesis remains intact. Market price declines alone NEVER justify a SELL.`);
  }

  if (Math.abs(input.allocationDriftPercent) > 3.0 && input.thesisStatus === 'intact') {
    violationsPrevented.push(`Rule 3 Enforced: Allocation drifted by ${input.allocationDriftPercent > 0 ? '+' : ''}${input.allocationDriftPercent.toFixed(1)}%, but allocation drift alone NEVER triggers a SELL.`);
  }

  // =========================================================================
  // SAFEGUARD 4: INCREASE Triple-Test Evaluation (Rule 4)
  // =========================================================================
  const isConsideringIncrease =
    input.thesisStatus === 'intact' &&
    input.portfolioBudgetAvailable === true;

  // Validate valuation inputs strictly
  if (isConsideringIncrease) {
    // 1. Valuation assessment presence
    if (!input.valuationAssessment && (input.valuationFavorable === undefined || input.valuationFavorable === null)) {
      appliedRules.push({
        ruleNumber: 4,
        ruleName: 'Valuation Input Requirement Gate',
        description: 'Thesis is intact, but valuation assessment is missing. Rule 4 forbids increasing without validated valuation.',
        isKeyFactor: true
      });

      return {
        outcome: 'INSUFFICIENT_EVIDENCE',
        primaryRationale: 'While investment thesis appears intact, mandatory valuation metrics or dated valuation assessments are missing. Under Rule 4, an INCREASE cannot be recommended without favorable, dated valuation evidence.',
        appliedRules,
        violationsPrevented: ['Safeguard 3 Enforced: Missing valuation data prevented an ungrounded INCREASE recommendation.'],
        recommendedAction: 'Retain holding at current allocation. Update valuation model with latest audited earnings multiples before reassessing an increase.',
        isSimulatedDraft: true,
        missingDataReasons: [
          'Dated valuation multiples (e.g. Forward P/E, EV/EBITDA, or FCF yield) are absent from analysis.',
          'Historical fair value benchmark comparison is unpopulated.'
        ],
        reassessmentRequirements: [
          'Input current valuation metrics benchmarked against historical 5-year ranges.',
          'Confirm valuation provides an adequate margin of safety before capital deployment.'
        ]
      };
    }

    // 2. Validate valuation assessment details if provided
    if (input.valuationAssessment) {
      // 2a. Timestamp validation
      if (!input.valuationAssessment.inputTimestamp || input.valuationAssessment.inputTimestamp.trim() === '') {
        appliedRules.push({
          ruleNumber: 4,
          ruleName: 'Valuation Timestamp Gate',
          description: 'Valuation assessment input timestamp is missing or empty.',
          isKeyFactor: true
        });

        violationsPrevented.push('Rule 4 Enforced: INCREASE attempted with missing valuation timestamp was rejected.');

        return {
          outcome: 'INSUFFICIENT_EVIDENCE',
          primaryRationale: 'Valuation assessment is invalid because inputTimestamp is missing or empty. A dated valuation timestamp is mandatory under Rule 4.',
          appliedRules,
          violationsPrevented,
          recommendedAction: 'Record an explicit publication timestamp for the valuation model inputs.',
          isSimulatedDraft: true,
          missingDataReasons: ['Valuation assessment input timestamp is missing or empty.'],
          reassessmentRequirements: ['Provide dated valuation inputs from a verified reporting period.']
        };
      }

      const valTimestamp = new Date(input.valuationAssessment.inputTimestamp);
      if (isNaN(valTimestamp.getTime())) {
        appliedRules.push({
          ruleNumber: 4,
          ruleName: 'Valuation Timestamp Validity Gate',
          description: 'Valuation assessment input timestamp is an invalid date string.',
          isKeyFactor: true
        });

        return {
          outcome: 'INSUFFICIENT_EVIDENCE',
          primaryRationale: 'Valuation assessment input timestamp is an invalid date string. Rule 4 requires a valid, parseable timestamp.',
          appliedRules,
          violationsPrevented,
          recommendedAction: 'Format valuation timestamp as a valid ISO 8601 date string.',
          isSimulatedDraft: true,
          missingDataReasons: ['Valuation assessment input timestamp is invalid.']
        };
      }

      // 2b. Future-dated timestamp rejection
      if (valTimestamp.getTime() > asOfDate.getTime()) {
        appliedRules.push({
          ruleNumber: 4,
          ruleName: 'Future-Dated Valuation Gate',
          description: 'Valuation timestamp is future-dated relative to the assessment date.',
          isKeyFactor: true
        });

        violationsPrevented.push('Rule 4 Enforced: INCREASE attempted with future-dated valuation inputs was rejected.');

        return {
          outcome: 'INSUFFICIENT_EVIDENCE',
          primaryRationale: `Valuation assessment contains a future-dated timestamp (${input.valuationAssessment.inputTimestamp}). Rule 4 strictly rejects future-dated valuation inputs.`,
          appliedRules,
          violationsPrevented,
          recommendedAction: 'Replace future-dated inputs with current or historical audited multiples.',
          isSimulatedDraft: true,
          missingDataReasons: [
            `Valuation timestamp (${input.valuationAssessment.inputTimestamp}) is dated in the future relative to the assessment date (${asOfDate.toISOString().split('T')[0]}).`
          ],
          reassessmentRequirements: [
            'Use historical or contemporaneous valuation metrics grounded in verified statutory filings.'
          ]
        };
      }

      // 2c. Required valuation metrics count
      const metricsCount = input.valuationAssessment.metricsCount ?? 0;
      if (metricsCount <= 0) {
        appliedRules.push({
          ruleNumber: 4,
          ruleName: 'Valuation Metrics Requirement Gate',
          description: 'Valuation assessment lacks required valuation metrics count.',
          isKeyFactor: true
        });

        violationsPrevented.push('Rule 4 Enforced: INCREASE attempted without required valuation metrics was rejected.');

        return {
          outcome: 'INSUFFICIENT_EVIDENCE',
          primaryRationale: 'Valuation assessment lacks required valuation metrics. Rule 4 requires dated valuation multiples (P/E, EV/EBITDA, or FCF yield).',
          appliedRules,
          violationsPrevented,
          recommendedAction: 'Populate at least one valuation metric with historical context.',
          isSimulatedDraft: true,
          missingDataReasons: ['Valuation metrics count is 0 or unpopulated. At least one dated valuation metric is required.'],
          reassessmentRequirements: ['Supply current multiples benchmarked against historical averages.']
        };
      }
    } else if (input.valuationFavorable === true) {
      // Raw boolean without valuationAssessment object
      appliedRules.push({
        ruleNumber: 4,
        ruleName: 'Valuation Object Requirement Gate',
        description: 'Raw boolean valuationFavorable was provided without valuation assessment timestamp and metrics.',
        isKeyFactor: true
      });

      return {
        outcome: 'INSUFFICIENT_EVIDENCE',
        primaryRationale: 'Valuation assessment object with inputTimestamp and valuation metrics is missing. Raw boolean valuationFavorable is insufficient under Rule 4.',
        appliedRules,
        violationsPrevented: ['Rule 4 Enforced: Raw boolean valuation without dated metrics was rejected.'],
        recommendedAction: 'Provide structured valuationAssessment with inputTimestamp and metricsCount.',
        isSimulatedDraft: true,
        missingDataReasons: [
          'Valuation assessment input timestamp is missing or empty.',
          'Valuation metrics count is unpopulated.'
        ]
      };
    }

    // 3. Risk-budget assessment check: must be explicitly true; undefined/null fails
    const isValuationFavorable =
      input.valuationAssessment?.isFavorable === true || input.valuationFavorable === true;

    if (isValuationFavorable) {
      if (input.riskAssessmentSupportsIncrease === undefined || input.riskAssessmentSupportsIncrease === null) {
        appliedRules.push({
          ruleNumber: 4,
          ruleName: 'Risk-Budget Assessment Gate',
          description: 'Explicit positive risk-budget assessment is missing or unverified (undefined).',
          isKeyFactor: true
        });

        violationsPrevented.push('Rule 4 Enforced: INCREASE attempted with missing risk-budget assessment was rejected.');

        return {
          outcome: 'INSUFFICIENT_EVIDENCE',
          primaryRationale: 'Explicit positive risk-budget assessment is missing (undefined). Rule 4 requires an explicit positive risk assessment before approving INCREASE.',
          appliedRules,
          violationsPrevented,
          recommendedAction: 'Perform formal risk-budget check to confirm position addition remains within mandate concentration limits.',
          isSimulatedDraft: true,
          missingDataReasons: [
            'Explicit positive risk-budget assessment (riskAssessmentSupportsIncrease) is missing or undefined.'
          ],
          reassessmentRequirements: [
            'Perform explicit risk-budget assessment to confirm position expansion does not breach concentration limits.'
          ]
        };
      }
    }
  }

  // Check complete Triple-Test for INCREASE
  const isValuationExplicitlyFavorable =
    input.valuationAssessment?.isFavorable === true ||
    (input.valuationAssessment === undefined && input.valuationFavorable === true);

  const hasValidValuationAssessment =
    input.valuationAssessment !== undefined &&
    Boolean(input.valuationAssessment.inputTimestamp) &&
    !isNaN(new Date(input.valuationAssessment.inputTimestamp!).getTime()) &&
    new Date(input.valuationAssessment.inputTimestamp!).getTime() <= asOfDate.getTime() &&
    (input.valuationAssessment.metricsCount ?? 0) > 0;

  if (
    input.thesisStatus === 'intact' &&
    (hasValidValuationAssessment || input.valuationFavorable === true) &&
    isValuationExplicitlyFavorable &&
    input.portfolioBudgetAvailable === true &&
    input.riskAssessmentSupportsIncrease === true &&
    (input.evidenceQuality === 'verified_fresh' || input.evidenceQuality === 'adequate')
  ) {
    appliedRules.push({
      ruleNumber: 4,
      ruleName: 'Triple-Test Expansion Condition (All Criteria Met)',
      description: 'All mandatory conditions satisfied: 1) Verified intact thesis, 2) Portfolio risk budget available, 3) Favorable dated valuation with valid timestamp and metrics, 4) Explicit positive risk assessment.',
      isKeyFactor: true
    });

    return {
      outcome: 'INCREASE',
      primaryRationale: 'High thesis conviction coincides with favorable valuation multiples, fresh statutory evidence, dated valuation inputs, and available portfolio risk budget below target weight.',
      appliedRules,
      violationsPrevented,
      recommendedAction: 'Simulated decision draft: Consider committing an additional capital tranche during regular rebalancing window.',
      isSimulatedDraft: true
    };
  }

  // =========================================================================
  // SAFEGUARD 5: REDUCE Evaluation (Rule 3 & Safeguard 2)
  // =========================================================================
  // Allocation drift may trigger a review but must NOT automatically force a reduction.
  // Requires documented position-size, concentration, or risk concerns supported by traceable evidence!
  if (input.allocationDriftPercent > 3.0 && input.thesisStatus === 'intact') {
    const hasRiskConcernAsserted =
      input.hasDocumentedRiskConcern === true ||
      (Array.isArray(input.traceableRiskEvidenceIds) && input.traceableRiskEvidenceIds.length > 0);

    if (hasRiskConcernAsserted) {
      // 1. A Boolean hasDocumentedRiskConcern alone must NOT prove that a risk concern is documented
      if (!Array.isArray(input.traceableRiskEvidenceIds) || input.traceableRiskEvidenceIds.length === 0) {
        appliedRules.push({
          ruleNumber: 3,
          ruleName: 'Traceable Risk Evidence Gate',
          description: 'Boolean risk concern flag was provided without traceable risk evidence records.',
          isKeyFactor: true
        });

        violationsPrevented.push('Rule 3 Enforced: REDUCE attempted with a Boolean risk flag but no risk evidence was rejected.');

        return {
          outcome: 'INSUFFICIENT_EVIDENCE',
          primaryRationale: 'A Boolean risk concern flag alone does not prove that a risk concern is documented. Rule 3 requires an existing, traceable risk record with appropriate statutory verification and freshness.',
          appliedRules,
          violationsPrevented,
          recommendedAction: 'Document traceable risk finding in research archive before initiating position trim.',
          isSimulatedDraft: true,
          missingDataReasons: [
            'Traceable risk evidence records (traceableRiskEvidenceIds) are missing. A boolean flag alone is rejected.'
          ],
          reassessmentRequirements: [
            'Provide traceable primary risk documentation supporting the concentration or fundamental risk concern.'
          ]
        };
      }

      // 2. Validate every traceable risk evidence record
      for (const riskEvidenceId of input.traceableRiskEvidenceIds) {
        const record = findEvidenceRecord(riskEvidenceId, input.evidenceRecords, { isSyntheticContext: isSyntheticSimulation });

        if (!record) {
          appliedRules.push({
            ruleNumber: 3,
            ruleName: 'Risk Evidence Existence Gate',
            description: `Traceable risk evidence ID "${riskEvidenceId}" was not found in the verified evidence registry.`,
            isKeyFactor: true
          });

          violationsPrevented.push(`Rule 3 Enforced: REDUCE attempted with nonexistent risk evidence ID "${riskEvidenceId}" was rejected.`);

          return {
            outcome: 'INSUFFICIENT_EVIDENCE',
            primaryRationale: `Traceable risk evidence ID "${riskEvidenceId}" was not found in the verified evidence registry. Traceability validation failed under Rule 3.`,
            appliedRules,
            violationsPrevented,
            recommendedAction: 'Verify that referenced risk citation is indexed in the evidence explorer.',
            isSimulatedDraft: true,
            missingDataReasons: [`Nonexistent risk evidence ID: ${riskEvidenceId}.`]
          };
        }

        // Synthetic check: synthetic evidence cannot authorize real REDUCE decisions
        const isSynthetic =
          record.isSyntheticDemonstration === true ||
          record.verificationStatus === 'simulated_demonstration';

        if (isSynthetic && !isSyntheticSimulation) {
          appliedRules.push({
            ruleNumber: 3,
            ruleName: 'Synthetic Risk Evidence Rejection Gate',
            description: `Risk evidence record ${record.id} is synthetic demonstration data.`,
            isKeyFactor: true
          });

          violationsPrevented.push('Rule 3 Enforced: REDUCE attempted with synthetic-only risk evidence was rejected.');

          return {
            outcome: 'INSUFFICIENT_EVIDENCE',
            primaryRationale: `Risk evidence record ${record.id} is synthetic demonstration data. Under Rule 3, synthetic-only risk evidence cannot satisfy real-world verification for REDUCE.`,
            appliedRules,
            violationsPrevented,
            recommendedAction: 'Link verified statutory risk report (e.g. BIS prudential guideline or 10-Q risk factors).',
            isSimulatedDraft: true,
            missingDataReasons: [`Risk evidence record ${record.id} is synthetic demonstration data.`]
          };
        }

        // Freshness check
        if (record.freshnessStatus === 'stale' || record.freshnessStatus === 'expired') {
          appliedRules.push({
            ruleNumber: 3,
            ruleName: 'Risk Evidence Freshness Gate',
            description: `Traceable risk evidence record ${record.id} is stale or expired.`,
            isKeyFactor: true
          });

          violationsPrevented.push('Rule 3 Enforced: REDUCE attempted with stale risk evidence was rejected.');

          return {
            outcome: 'INSUFFICIENT_EVIDENCE',
            primaryRationale: `Traceable risk evidence record ${record.id} is stale or expired under configured freshness policy. Current verified risk evidence is required for REDUCE.`,
            appliedRules,
            violationsPrevented,
            recommendedAction: 'Obtain current risk assessment before reducing portfolio exposure.',
            isSimulatedDraft: true,
            missingDataReasons: [`Risk evidence record ${record.id} exceeds freshness thresholds.`]
          };
        }

        // Conflict check
        if (record.isConflicting === true || record.type === 'conflicting_evidence') {
          appliedRules.push({
            ruleNumber: 3,
            ruleName: 'Risk Evidence Conflict Gate',
            description: `Risk evidence record ${record.id} contains unresolved conflicting claims.`,
            isKeyFactor: true
          });

          return {
            outcome: 'INSUFFICIENT_EVIDENCE',
            primaryRationale: `Risk evidence contains un-reconciled conflicting claims. Cannot execute REDUCE on conflicting evidence.`,
            appliedRules,
            violationsPrevented,
            recommendedAction: 'Resolve contradictory risk estimates before resizing position.',
            isSimulatedDraft: true,
            missingDataReasons: ['Conflicting risk claims exist regarding this holding.']
          };
        }

        // Verification check in real mode
        if (isRealDecisionMode && record.verificationStatus !== 'verified_primary') {
          appliedRules.push({
            ruleNumber: 3,
            ruleName: 'Risk Statutory Verification Gate',
            description: `Risk evidence record ${record.id} lacks verified_primary status from a statutory authority.`,
            isKeyFactor: true
          });

          return {
            outcome: 'INSUFFICIENT_EVIDENCE',
            primaryRationale: `Risk evidence record ${record.id} lacks verified_primary status from a statutory authority.`,
            appliedRules,
            violationsPrevented,
            recommendedAction: 'Verify citation against official regulator or custodian statement.',
            isSimulatedDraft: true,
            missingDataReasons: ['Risk evidence lacks verified_primary status.']
          };
        }

        // Supports risk concern check (underlying claim must substantiate risk)
        if (!doesEvidenceSupportRisk(record)) {
          appliedRules.push({
            ruleNumber: 3,
            ruleName: 'Risk Evidence Relevance Gate',
            description: `Traceable evidence record ${record.id} does not support documented risk concern.`,
            isKeyFactor: true
          });

          return {
            outcome: 'INSUFFICIENT_EVIDENCE',
            primaryRationale: `Traceable evidence record ${record.id} does not support documented risk concern. Under Rule 3 and V3 safety rules, evidence flags alone are insufficient; the claim must document concentration or risk.`,
            appliedRules,
            violationsPrevented,
            recommendedAction: 'Provide citation specifically addressing concentration or fundamental risk.',
            isSimulatedDraft: true,
            missingDataReasons: [
              `Evidence record ${record.id} fails to substantiate risk or concentration concern (${validateRiskConcernClaim(record).rejectionReason || 'ungrounded'}).`
            ]
          };
        }
      }

      // Validated risk evidence confirms REDUCE
      appliedRules.push({
        ruleNumber: 3,
        ruleName: 'Disciplined Risk Rebalancing (Verified Traceable Risk Concern)',
        description: 'Position weight drifted significantly above mandate threshold and verified traceable risk evidence substantiates rebalancing.',
        isKeyFactor: true
      });

      return {
        outcome: 'REDUCE',
        primaryRationale: 'Position weight exceeds target allocation and concentration limits, accompanied by verified, traceable risk documentation. Disciplined rebalancing trim is warranted to restore risk budget.',
        appliedRules,
        violationsPrevented,
        recommendedAction: isSyntheticSimulation
          ? 'SIMULATED SCENARIO ONLY: Partial rebalancing trim demonstrated for testing purposes.'
          : 'Simulated decision draft: Partial rebalancing trim to restore weight to target allocation band. Retain core holding.',
        isSimulatedDraft: true
      };
    } else {
      // Drift alone without documented risk concern triggers a REVIEW flag, NOT automatic REDUCE!
      violationsPrevented.push(`Safeguard 2 Enforced: Position has drifted +${input.allocationDriftPercent.toFixed(1)}%, but drift alone does NOT force an automatic reduction without documented risk concerns.`);
    }
  }

  // =========================================================================
  // SAFEGUARD 6: Default Baseline HOLD (Rule 1)
  // =========================================================================
  appliedRules.push({
    ruleNumber: 1,
    ruleName: 'Default Inertia / HOLD Baseline',
    description: 'Evidence does not warrant an active portfolio change. Long-term compounding proceeds undisturbed.',
    isKeyFactor: true
  });

  return {
    outcome: 'HOLD',
    primaryRationale: 'Evidence confirms thesis stability. No compelling condition exists to increase, reduce, or exit. HOLD is the disciplined default.',
    appliedRules,
    violationsPrevented,
    recommendedAction: 'Maintain current allocation. Re-verify evidence at next scheduled quarterly review.',
    isSimulatedDraft: true
  };
}
