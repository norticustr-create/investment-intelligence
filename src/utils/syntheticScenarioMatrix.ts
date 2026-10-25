/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DecisionOutcome,
  AssetCategory,
  EvidenceFinding
} from '../types/investment';
import {
  DecisionEvaluationInput,
  DecisionEvaluationResult,
  evaluateDecisionRules
} from './decisionEngine';

export interface SyntheticScenarioDefinition {
  id: string;
  categoryNumber: number;
  name: string;
  assetName: string;
  assetCategory: AssetCategory;
  description: string;
  expectedDecision: DecisionOutcome;
  expectedRationale: string;
  primaryRuleNumber: number;
  invariantsTested: string[];
  input: DecisionEvaluationInput;
}

export interface ScenarioTestResult {
  scenarioId: string;
  name: string;
  expectedDecision: DecisionOutcome;
  actualDecision: DecisionOutcome;
  matched: boolean;
  appliedRuleNumbers: number[];
  violationsPrevented: string[];
  rationale: string;
}

/**
 * Deterministic evidence findings created specifically for synthetic scenario matrix testing.
 * All records have explicit unique IDs, source document links, and full modality/scope attributes.
 */
export const SYNTHETIC_SCENARIO_EVIDENCE_RECORDS: EvidenceFinding[] = [
  // Sound MSFT finding
  {
    id: 'ev-scen-msft-sound',
    holdingId: 'h-scen-msft',
    sourceDocId: 'doc-scen-msft-10k',
    claim: 'Audited Form 10-K confirms enterprise commercial cloud revenue expanded 21% constant currency with 71% commercial gross margin.',
    excerpt: 'Commercial cloud gross margin was 71%, driven by continued efficiency gains across hyperscale cloud infrastructure.',
    type: 'verified_fact',
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'fresh',
    evidenceQuality: 'high_statutory',
    confidenceNotes: 'Synthetic simulation fixture: modeled after statutory SEC Form 10-K cloud disclosures for isolated testing.',
    lastVerifiedDate: '2026-02-01',
    isSyntheticDemonstration: true,
    claimModality: 'confirmed_fact',
    claimScope: 'holding_specific'
  },
  // Invalidation for SEDG: Confirmed gross margin collapse and covenant default
  {
    id: 'ev-scen-sedg-invalidated',
    holdingId: 'h-scen-sedg',
    sourceDocId: 'doc-scen-sedg-10k',
    claim: 'Audited Form 10-K confirms permanent inversion of gross margins to negative 8.2% and senior credit covenant default.',
    excerpt: 'Gross margin collapsed to negative 8.2% and company entered into senior credit covenant breach.',
    type: 'verified_fact',
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'fresh',
    evidenceQuality: 'high_statutory',
    confidenceNotes: 'Synthetic simulation fixture: modeled after statutory SEC Form 10-K filings to test structural moat invalidation logic.',
    lastVerifiedDate: '2026-02-01',
    isSyntheticDemonstration: true,
    supportsThesisInvalidation: true,
    claimModality: 'confirmed_fact',
    claimScope: 'holding_specific'
  },
  // Confirmed risk breach for BTC: Single-asset concentration exceeds statutory ceiling
  {
    id: 'ev-scen-btc-risk-breach',
    holdingId: 'h-scen-btc',
    sourceDocId: 'doc-scen-btc-audit',
    claim: 'The custodian audit confirmed that single-issuer concentration exceeds the defined 10% mandate ceiling.',
    excerpt: 'Custodian audit statement: concentration exceeds statutory single-asset risk ceiling of 10.0%.',
    type: 'verified_fact',
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'fresh',
    evidenceQuality: 'high_statutory',
    confidenceNotes: 'Synthetic simulation fixture: modeled after custodian compliance audit to test concentration ceiling breach logic.',
    lastVerifiedDate: '2026-02-01',
    isSyntheticDemonstration: true,
    supportsRiskConcern: true,
    claimModality: 'confirmed_fact',
    claimScope: 'holding_specific'
  },
  // Negated risk breach: Concentration did NOT breach mandate ceiling
  {
    id: 'ev-scen-negated-risk',
    holdingId: 'h-scen-neg-risk',
    sourceDocId: 'doc-scen-risk-audit-neg',
    claim: 'The compliance audit confirmed that position concentration did not breach the defined 10% mandate ceiling.',
    excerpt: 'Prudential review confirmed: position concentration did not breach the statutory mandate ceiling.',
    type: 'verified_fact',
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'fresh',
    evidenceQuality: 'high_statutory',
    confidenceNotes: 'Synthetic simulation fixture: compliance audit stating no breach occurred to test conservative negation gate.',
    lastVerifiedDate: '2026-02-01',
    isSyntheticDemonstration: true,
    supportsRiskConcern: true,
    claimModality: 'negated',
    claimScope: 'holding_specific'
  },
  // Stale evidence for TI2 Fund (>60 days old)
  {
    id: 'ev-scen-ti2-stale',
    holdingId: 'h-scen-ti2',
    sourceDocId: 'doc-scen-ti2-factsheet',
    claim: 'TEFAS monthly portfolio distribution sheet reflects historical asset weighting.',
    excerpt: 'Portfolio composition as of prior reporting period.',
    type: 'stale_evidence',
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'stale',
    evidenceQuality: 'insufficient',
    confidenceNotes: 'Synthetic simulation fixture: overdue monthly report exceeding freshness threshold (>60 days).',
    lastVerifiedDate: '2025-10-01',
    isSyntheticDemonstration: true,
    claimModality: 'confirmed_fact',
    claimScope: 'holding_specific'
  },
  // Conflicting evidence for Turkish Equity
  {
    id: 'ev-scen-conflict-1',
    holdingId: 'h-scen-turkish-conflict',
    sourceDocId: 'doc-scen-kap-dispute',
    claim: 'KAP disclosure claims domestic market share grew to 38.5%, while competitor regulatory filings claim severe retail channel share loss.',
    excerpt: 'Unresolved discrepancy in retail market share disclosures.',
    type: 'conflicting_evidence',
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'fresh',
    evidenceQuality: 'conflicting',
    confidenceNotes: 'Synthetic simulation fixture: unreconciled contradictory disclosures to test conflict gate.',
    lastVerifiedDate: '2026-02-01',
    isConflicting: true,
    isSyntheticDemonstration: true,
    claimModality: 'confirmed_fact',
    claimScope: 'holding_specific'
  },
  // Synthetic-only evidence (marked simulated_demonstration)
  {
    id: 'ev-scen-synthetic-demo',
    holdingId: 'h-scen-demo',
    sourceDocId: 'doc-scen-demo-synthetic',
    claim: 'Synthetic demonstration finding asserting structural moat collapse for simulation purposes.',
    excerpt: 'Simulated gross margin decreased to negative 12.0%.',
    type: 'verified_fact',
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'fresh',
    evidenceQuality: 'high_statutory',
    confidenceNotes: 'Synthetic simulation sandbox fixture.',
    lastVerifiedDate: '2026-02-01',
    isSyntheticDemonstration: true,
    supportsThesisInvalidation: true,
    claimModality: 'confirmed_fact',
    claimScope: 'holding_specific'
  },
  // Sound BIMAS finding for Turkish Equity
  {
    id: 'ev-scen-bimas-sound',
    holdingId: 'h-scen-bimas',
    sourceDocId: 'doc-scen-bimas-kap',
    claim: 'Audited KAP disclosure confirms retail square footage expanded 8.5% with positive same-store sales growth.',
    excerpt: 'KAP disclosure audited financial statements show robust store network economics.',
    type: 'verified_fact',
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'fresh',
    evidenceQuality: 'high_statutory',
    confidenceNotes: 'Synthetic simulation fixture: modeled after KAP regulatory disclosures to test sound Turkish equity fundamentals.',
    lastVerifiedDate: '2026-02-01',
    isSyntheticDemonstration: true,
    claimModality: 'confirmed_fact',
    claimScope: 'holding_specific'
  },
  // Sound VT finding for ETF
  {
    id: 'ev-scen-vt-sound',
    holdingId: 'h-scen-vt',
    sourceDocId: 'doc-scen-vt-prospectus',
    claim: 'Audited prospectus confirms global market-cap weighted index replication covering over 9,800 constituents with 0.07% expense ratio.',
    excerpt: 'Full physical replication of FTSE Global All Cap Index.',
    type: 'verified_fact',
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'fresh',
    evidenceQuality: 'high_statutory',
    confidenceNotes: 'Synthetic simulation fixture: modeled after statutory prospectus disclosures to test ETF holding fundamentals.',
    lastVerifiedDate: '2026-02-01',
    isSyntheticDemonstration: true,
    claimModality: 'confirmed_fact',
    claimScope: 'holding_specific'
  }
];

/**
 * The 13 core required scenario definitions comprising the deterministic synthetic scenario matrix.
 */
export const SYNTHETIC_SCENARIO_MATRIX: SyntheticScenarioDefinition[] = [
  // 1. A sound long-term thesis with a temporary price decline.
  {
    id: 'SCEN-01-SOUND-THESIS-PRICE-DECLINE',
    categoryNumber: 1,
    name: 'Sound Long-Term Thesis with Temporary Price Decline',
    assetName: 'Microsoft Corporation (MSFT)',
    assetCategory: 'equity',
    description: 'Holding experiences a -28% market drawdown while enterprise cloud fundamentals and audited filings remain fully intact.',
    expectedDecision: 'HOLD',
    expectedRationale: 'Rule 1 & Rule 2: Fundamental thesis remains intact despite temporary price decline. Market price drawdowns alone NEVER trigger SELL or REDUCE.',
    primaryRuleNumber: 2,
    invariantsTested: ['Invariant 1: Price drops alone never trigger SELL or REDUCE', 'Invariant 5: SELL requires verified thesis invalidation'],
    input: {
      holdingName: 'Microsoft Corporation (MSFT)',
      executionMode: 'synthetic_simulation',
      assetCategory: 'equity',
      thesisStatus: 'intact',
      evidenceQuality: 'verified_fresh',
      priceDrawdownPercent: -28.0,
      allocationDriftPercent: 0.0,
      portfolioBudgetAvailable: false,
      traceableEvidenceIds: ['ev-scen-msft-sound'],
      evidenceRecords: SYNTHETIC_SCENARIO_EVIDENCE_RECORDS
    }
  },

  // 2. A profitable asset at its target allocation.
  {
    id: 'SCEN-02-PROFITABLE-AT-TARGET-ALLOCATION',
    categoryNumber: 2,
    name: 'Profitable Asset at Target Allocation',
    assetName: 'Vanguard Total World Stock ETF (VT)',
    assetCategory: 'etf',
    description: 'Holding has accumulated +45% unrealized gains and currently rests precisely on target allocation (0% drift). Thesis is stable.',
    expectedDecision: 'HOLD',
    expectedRationale: 'Rule 1: Profitable compounding asset at target weight requires no modification. Profit alone never triggers SELL.',
    primaryRuleNumber: 1,
    invariantsTested: ['Invariant 3: Profit alone never triggers SELL', 'Rule 1 Default HOLD inertia'],
    input: {
      holdingName: 'Vanguard Total World Stock ETF (VT)',
      executionMode: 'synthetic_simulation',
      assetCategory: 'etf',
      thesisStatus: 'intact',
      evidenceQuality: 'verified_fresh',
      priceDrawdownPercent: 45.0, // Significant unrealized profit
      allocationDriftPercent: 0.0,
      portfolioBudgetAvailable: false,
      traceableEvidenceIds: ['ev-scen-vt-sound'],
      evidenceRecords: SYNTHETIC_SCENARIO_EVIDENCE_RECORDS
    }
  },

  // 3. A profitable asset materially above its target allocation.
  {
    id: 'SCEN-03-PROFITABLE-MATERIALLY-ABOVE-TARGET',
    categoryNumber: 3,
    name: 'Profitable Asset Materially Above Target Allocation',
    assetName: 'Bitcoin (BTC)',
    assetCategory: 'bitcoin',
    description: 'Holding has appreciated +85% creating +7.5% overweight allocation drift, but without documented risk breach. Safeguard 2 prevents premature trim.',
    expectedDecision: 'HOLD',
    expectedRationale: 'Rule 3 & Safeguard 2: Position drifted +7.5% above target, but drift alone does NOT force an automatic reduction without documented, traceable risk concerns.',
    primaryRuleNumber: 3,
    invariantsTested: ['Invariant 2: Allocation drift alone never triggers SELL', 'Invariant 6: REDUCE requires verified risk breach'],
    input: {
      holdingName: 'Bitcoin (BTC)',
      executionMode: 'synthetic_simulation',
      assetCategory: 'bitcoin',
      thesisStatus: 'intact',
      evidenceQuality: 'verified_fresh',
      priceDrawdownPercent: 85.0,
      allocationDriftPercent: 7.5,
      hasDocumentedRiskConcern: false,
      portfolioBudgetAvailable: false,
      traceableEvidenceIds: ['ev-scen-msft-sound'],
      evidenceRecords: SYNTHETIC_SCENARIO_EVIDENCE_RECORDS
    }
  },

  // 4. An overweight asset with no verified thesis deterioration.
  {
    id: 'SCEN-04-OVERWEIGHT-WITHOUT-THESIS-DETERIORATION',
    categoryNumber: 4,
    name: 'Overweight Asset with No Verified Thesis Deterioration',
    assetName: 'BİM Birleşik Mağazalar (BIMAS.IS)',
    assetCategory: 'turkish_equity',
    description: 'Turkish equity holding is +5.0% overweight, thesis is fully intact, and no risk concern or covenant breach exists.',
    expectedDecision: 'HOLD',
    expectedRationale: 'Rule 3: Overweight allocation drift triggers a portfolio review flag, but never an automatic SELL or ungrounded REDUCE.',
    primaryRuleNumber: 3,
    invariantsTested: ['Invariant 2: Allocation drift alone never triggers SELL', 'Invariant 6: REDUCE requires verified risk breach'],
    input: {
      holdingName: 'BİM Birleşik Mağazalar (BIMAS.IS)',
      executionMode: 'synthetic_simulation',
      assetCategory: 'turkish_equity',
      thesisStatus: 'intact',
      evidenceQuality: 'verified_fresh',
      priceDrawdownPercent: 12.0,
      allocationDriftPercent: 5.0,
      hasDocumentedRiskConcern: false,
      portfolioBudgetAvailable: false,
      traceableEvidenceIds: ['ev-scen-bimas-sound'],
      evidenceRecords: SYNTHETIC_SCENARIO_EVIDENCE_RECORDS
    }
  },

  // 5. A verified material long-term thesis invalidation.
  {
    id: 'SCEN-05-VERIFIED-MATERIAL-THESIS-INVALIDATION',
    categoryNumber: 5,
    name: 'Verified Material Long-Term Thesis Invalidation',
    assetName: 'SolarEdge Technologies (SEDG)',
    assetCategory: 'equity',
    description: 'Audited Form 10-K confirms permanent inversion of gross margins to negative and debt covenant breach with verified primary statutory evidence.',
    expectedDecision: 'SELL',
    expectedRationale: 'Rule 5: Audited statutory disclosures confirm permanent structural economic moat destruction and debt covenant breach. High-bar met for disciplined exit draft.',
    primaryRuleNumber: 5,
    invariantsTested: ['Invariant 5: SELL requires verified thesis invalidation', 'Rule 5 high-bar moat destruction check'],
    input: {
      holdingName: 'SolarEdge Technologies (SEDG)',
      executionMode: 'synthetic_simulation',
      assetCategory: 'equity',
      thesisStatus: 'materially_invalidated',
      evidenceQuality: 'verified_fresh',
      evidenceVerificationStatus: 'simulated_demonstration',
      evidenceFreshnessStatus: 'fresh',
      priceDrawdownPercent: -62.0,
      allocationDriftPercent: -3.0,
      verifiedMoatDestruction: true,
      traceableEvidenceIds: ['ev-scen-sedg-invalidated'],
      evidenceRecords: SYNTHETIC_SCENARIO_EVIDENCE_RECORDS,
      structuralImpairmentRationale: 'Audited Form 10-K filing confirms structural moat collapse with permanent negative gross margins.'
    }
  },

  // 6. A verified holding-specific or portfolio-specific risk concern.
  {
    id: 'SCEN-06-VERIFIED-RISK-CONCERN-BREACH',
    categoryNumber: 6,
    name: 'Verified Holding-Specific Risk Concern Breach',
    assetName: 'Bitcoin (BTC)',
    assetCategory: 'bitcoin',
    description: 'Holding is +6.0% overweight and verified statutory custodian audit explicitly confirms single-asset concentration exceeds statutory 10% risk ceiling.',
    expectedDecision: 'REDUCE',
    expectedRationale: 'Rule 3: Position weight exceeds target allocation and concentration limits, accompanied by verified, traceable risk documentation confirming mandate ceiling breach.',
    primaryRuleNumber: 3,
    invariantsTested: ['Invariant 6: REDUCE requires verified risk breach', 'Rule 3 disciplined risk rebalancing'],
    input: {
      holdingName: 'Bitcoin (BTC)',
      executionMode: 'synthetic_simulation',
      assetCategory: 'bitcoin',
      thesisStatus: 'intact',
      evidenceQuality: 'verified_fresh',
      priceDrawdownPercent: 70.0,
      allocationDriftPercent: 6.0,
      hasDocumentedRiskConcern: true,
      traceableRiskEvidenceIds: ['ev-scen-btc-risk-breach'],
      evidenceRecords: SYNTHETIC_SCENARIO_EVIDENCE_RECORDS
    }
  },

  // 7. Missing, stale, conflicting, or unverified evidence (Sub-cases 7a-7d).
  {
    id: 'SCEN-07A-STALE-EVIDENCE',
    categoryNumber: 7,
    name: 'Missing, Stale, Conflicting: Stale Regulatory Evidence',
    assetName: 'İş Portföy Fonu (TI2)',
    assetCategory: 'turkish_fund',
    description: 'Primary source factsheet exceeds freshness threshold (>60 days), preventing capital modification.',
    expectedDecision: 'INSUFFICIENT_EVIDENCE',
    expectedRationale: 'Rule 6: Primary source documentation is stale or missing. System strictly refuses to guess forward metrics or force conviction on outdated data.',
    primaryRuleNumber: 6,
    invariantsTested: ['Invariant 4: Increase blocked on stale evidence', 'Rule 6 Evidence Freshness Guard'],
    input: {
      holdingName: 'İş Portföy Fonu (TI2)',
      executionMode: 'synthetic_simulation',
      assetCategory: 'turkish_fund',
      thesisStatus: 'intact',
      evidenceQuality: 'stale_or_missing',
      evidenceFreshnessStatus: 'stale',
      priceDrawdownPercent: 4.0,
      allocationDriftPercent: -3.0,
      portfolioBudgetAvailable: true,
      valuationFavorable: true,
      traceableEvidenceIds: ['ev-scen-ti2-stale'],
      evidenceRecords: SYNTHETIC_SCENARIO_EVIDENCE_RECORDS
    }
  },
  {
    id: 'SCEN-07B-CONFLICTING-EVIDENCE',
    categoryNumber: 7,
    name: 'Missing, Stale, Conflicting: Unresolved Contradictory Filings',
    assetName: 'Contradictory Disclosure Corp',
    assetCategory: 'turkish_equity',
    description: 'Opposing regulatory disclosures present un-reconciled statements regarding retail market share and margins.',
    expectedDecision: 'INSUFFICIENT_EVIDENCE',
    expectedRationale: 'Rule 6: Conflicting evidence between public disclosures prevents high-confidence decision. No portfolio action allowed until resolved.',
    primaryRuleNumber: 6,
    invariantsTested: ['Rule 6 Conflicting Evidence Guard', 'Invariant 5: SELL blocked on conflicting evidence'],
    input: {
      holdingName: 'Contradictory Disclosure Corp',
      executionMode: 'synthetic_simulation',
      assetCategory: 'turkish_equity',
      thesisStatus: 'materially_invalidated',
      evidenceQuality: 'conflicting',
      hasUnresolvedCounterevidence: true,
      priceDrawdownPercent: -25.0,
      allocationDriftPercent: -2.0,
      traceableEvidenceIds: ['ev-scen-conflict-1'],
      evidenceRecords: SYNTHETIC_SCENARIO_EVIDENCE_RECORDS
    }
  },
  {
    id: 'SCEN-07C-UNINDEXED-MISSING-EVIDENCE',
    categoryNumber: 7,
    name: 'Missing, Stale, Conflicting: Unindexed Evidence Citation',
    assetName: 'Ghost Citation Corp',
    assetCategory: 'equity',
    description: 'Attempted SELL citing evidence ID "ev-phantom-citation" which is missing from the evidence registry.',
    expectedDecision: 'INSUFFICIENT_EVIDENCE',
    expectedRationale: 'Rule 5: Traceable evidence ID was not found in the verified evidence registry. Traceability validation failed under Rule 5.',
    primaryRuleNumber: 5,
    invariantsTested: ['Invariant 5: SELL requires verified thesis invalidation', 'Traceability existence gate'],
    input: {
      holdingName: 'Ghost Citation Corp',
      executionMode: 'synthetic_simulation',
      assetCategory: 'equity',
      thesisStatus: 'materially_invalidated',
      evidenceQuality: 'verified_fresh',
      priceDrawdownPercent: -30.0,
      allocationDriftPercent: -1.0,
      traceableEvidenceIds: ['ev-phantom-citation'],
      evidenceRecords: SYNTHETIC_SCENARIO_EVIDENCE_RECORDS
    }
  },
  {
    id: 'SCEN-07D-UNVERIFIED-THIRD-PARTY-IN-REAL-MODE',
    categoryNumber: 7,
    name: 'Missing, Stale, Conflicting: Unverified Third-Party Status in Real Mode',
    assetName: 'Blog Aggregator Corp',
    assetCategory: 'equity',
    description: 'Thesis invalidation supported only by unverified third-party aggregator in real decision mode.',
    expectedDecision: 'INSUFFICIENT_EVIDENCE',
    expectedRationale: 'Rule 5: Evidence record lacks verified_primary status. Only verified_primary statutory evidence satisfies SELL criteria in real decision mode.',
    primaryRuleNumber: 5,
    invariantsTested: ['Invariant 5: SELL requires verified thesis invalidation', 'Statutory Verification Status Gate'],
    input: {
      holdingName: 'Blog Aggregator Corp',
      executionMode: 'real_decision',
      assetCategory: 'equity',
      thesisStatus: 'materially_invalidated',
      evidenceQuality: 'verified_fresh',
      priceDrawdownPercent: -40.0,
      allocationDriftPercent: -2.0,
      traceableEvidenceIds: ['ev-scen-unverified-3p'],
      evidenceRecords: [
        {
          id: 'ev-scen-unverified-3p',
          holdingId: 'h-blog',
          sourceDocId: 'doc-blog-1',
          claim: 'Debt covenant default declared in market gossip blog.',
          excerpt: 'Debt covenant breach occurred according to industry rumors.',
          type: 'verified_fact',
          verificationStatus: 'unverified_third_party',
          freshnessStatus: 'fresh',
          evidenceQuality: 'insufficient',
          confidenceNotes: 'Unverified blog note.',
          lastVerifiedDate: '2026-02-01',
          isSyntheticDemonstration: false,
          supportsThesisInvalidation: true
        }
      ]
    }
  },

  // 8. A strong thesis with insufficient valuation support for increasing.
  {
    id: 'SCEN-08-STRONG-THESIS-UNFAVORABLE-VALUATION',
    categoryNumber: 8,
    name: 'Strong Thesis with Insufficient Valuation Support (Unfavorable Multiples)',
    assetName: 'Microsoft Corporation (MSFT)',
    assetCategory: 'equity',
    description: 'Thesis is fully intact and portfolio budget exists, but current valuation multiples are extended (isFavorable: false). Engine preserves capital and defaults to HOLD.',
    expectedDecision: 'HOLD',
    expectedRationale: 'Rule 4: While investment thesis is intact, valuation is not favorable (extended multiples). Under Rule 4, INCREASE requires favorable valuation support; engine defaults to disciplined HOLD.',
    primaryRuleNumber: 4,
    invariantsTested: ['Invariant 4: INCREASE requires favorable valuation support', 'Rule 1 Default HOLD inertia'],
    input: {
      holdingName: 'Microsoft Corporation (MSFT)',
      executionMode: 'synthetic_simulation',
      assetCategory: 'equity',
      thesisStatus: 'intact',
      evidenceQuality: 'verified_fresh',
      priceDrawdownPercent: -2.0,
      allocationDriftPercent: -4.5,
      portfolioBudgetAvailable: true,
      valuationAssessment: {
        isFavorable: false, // Valuation multiples are extended
        inputTimestamp: '2026-02-10',
        metricsCount: 3
      },
      riskAssessmentSupportsIncrease: true,
      traceableEvidenceIds: ['ev-scen-msft-sound'],
      evidenceRecords: SYNTHETIC_SCENARIO_EVIDENCE_RECORDS
    }
  },

  // 9. An asset below target allocation but with a weak thesis.
  {
    id: 'SCEN-09-UNDERWEIGHT-WITH-WEAK-THESIS',
    categoryNumber: 9,
    name: 'Asset Below Target Allocation with Weak / Questionable Thesis',
    assetName: 'Turnaround Hopeful Corp',
    assetCategory: 'equity',
    description: 'Position is underweight (-5.0%) and valuation looks cheap, but fundamental business thesis is questionable. Engine rejects INCREASE and maintains disciplined HOLD.',
    expectedDecision: 'HOLD',
    expectedRationale: 'Rule 4: INCREASE is strictly forbidden when investment thesis is questionable or unconvincing, regardless of underweight status or low valuation multiples.',
    primaryRuleNumber: 4,
    invariantsTested: ['Invariant 4: INCREASE requires positive thesis quality', 'Rule 1 Default HOLD inertia'],
    input: {
      holdingName: 'Turnaround Hopeful Corp',
      executionMode: 'synthetic_simulation',
      assetCategory: 'equity',
      thesisStatus: 'questionable', // Weak thesis!
      evidenceQuality: 'verified_fresh',
      priceDrawdownPercent: -35.0,
      allocationDriftPercent: -5.0,
      portfolioBudgetAvailable: true,
      valuationAssessment: {
        isFavorable: true,
        inputTimestamp: '2026-02-10',
        metricsCount: 2
      },
      riskAssessmentSupportsIncrease: true,
      traceableEvidenceIds: ['ev-scen-msft-sound'],
      evidenceRecords: SYNTHETIC_SCENARIO_EVIDENCE_RECORDS
    }
  },

  // 10. A proposed increase where valuation evidence is missing.
  {
    id: 'SCEN-10-PROPOSED-INCREASE-MISSING-VALUATION',
    categoryNumber: 10,
    name: 'Proposed Increase Where Valuation Evidence Is Missing',
    assetName: 'BİM Birleşik Mağazalar (BIMAS.IS)',
    assetCategory: 'turkish_equity',
    description: 'Thesis is intact and capital budget is available (-4.0% drift), but valuation metrics are unpopulated. Engine halts and returns INSUFFICIENT_EVIDENCE.',
    expectedDecision: 'INSUFFICIENT_EVIDENCE',
    expectedRationale: 'Rule 4: Mandatory valuation metrics or dated valuation assessments are missing. Under Rule 4, an INCREASE cannot be recommended without favorable, dated valuation evidence.',
    primaryRuleNumber: 4,
    invariantsTested: ['Invariant 4: INCREASE requires favorable valuation support', 'Rule 4 Valuation Input Requirement Gate'],
    input: {
      holdingName: 'BİM Birleşik Mağazalar (BIMAS.IS)',
      executionMode: 'synthetic_simulation',
      assetCategory: 'turkish_equity',
      thesisStatus: 'intact',
      evidenceQuality: 'verified_fresh',
      priceDrawdownPercent: -5.0,
      allocationDriftPercent: -4.0,
      portfolioBudgetAvailable: true,
      valuationFavorable: undefined, // Missing valuation assessment
      valuationAssessment: undefined,
      traceableEvidenceIds: ['ev-scen-bimas-sound'],
      evidenceRecords: SYNTHETIC_SCENARIO_EVIDENCE_RECORDS
    }
  },

  // 11. A scenario where an apparent risk breach is explicitly negated.
  {
    id: 'SCEN-11-RISK-BREACH-EXPLICITLY-NEGATED',
    categoryNumber: 11,
    name: 'Apparent Risk Breach Is Explicitly Negated',
    assetName: 'Prudential Compliance Portfolio',
    assetCategory: 'etf',
    description: 'Holding is +5.5% overweight and a risk concern is asserted, but the cited audit report explicitly states the mandate ceiling was NOT breached. Engine rejects REDUCE.',
    expectedDecision: 'INSUFFICIENT_EVIDENCE',
    expectedRationale: 'Rule 3 & V4.3 Negation Gate: Evidence explicitly confirms the limit was not breached. Negated claims cannot substantiate REDUCE.',
    primaryRuleNumber: 3,
    invariantsTested: ['Invariant 6: REDUCE requires verified risk breach', 'Invariant 8: Negated and hypothetical risks fail closed'],
    input: {
      holdingName: 'Prudential Compliance Portfolio',
      executionMode: 'synthetic_simulation',
      assetCategory: 'etf',
      thesisStatus: 'intact',
      evidenceQuality: 'verified_fresh',
      priceDrawdownPercent: 15.0,
      allocationDriftPercent: 5.5,
      hasDocumentedRiskConcern: true,
      traceableRiskEvidenceIds: ['ev-scen-negated-risk'],
      evidenceRecords: SYNTHETIC_SCENARIO_EVIDENCE_RECORDS
    }
  },

  // 12. A scenario where a risk breach is positively confirmed.
  {
    id: 'SCEN-12-RISK-BREACH-POSITIVELY-CONFIRMED',
    categoryNumber: 12,
    name: 'Risk Breach Is Positively Confirmed',
    assetName: 'High Concentration Asset',
    assetCategory: 'bitcoin',
    description: 'Holding is +6.5% overweight and independent custodian audit explicitly confirms single-issuer concentration exceeds the defined 10% mandate ceiling.',
    expectedDecision: 'REDUCE',
    expectedRationale: 'Rule 3: Position weight exceeds target allocation and concentration limits, accompanied by verified, traceable risk documentation confirming an actual limit breach.',
    primaryRuleNumber: 3,
    invariantsTested: ['Invariant 6: REDUCE requires verified risk breach', 'Rule 3 Disciplined Risk Rebalancing'],
    input: {
      holdingName: 'High Concentration Asset',
      executionMode: 'synthetic_simulation',
      assetCategory: 'bitcoin',
      thesisStatus: 'intact',
      evidenceQuality: 'verified_fresh',
      priceDrawdownPercent: 60.0,
      allocationDriftPercent: 6.5,
      hasDocumentedRiskConcern: true,
      traceableRiskEvidenceIds: ['ev-scen-btc-risk-breach'],
      evidenceRecords: SYNTHETIC_SCENARIO_EVIDENCE_RECORDS
    }
  },

  // 13. Mixed portfolios containing US stocks, Turkish stocks, ETFs, funds, and BTC (Multi-asset composition).
  // 13a: US Equity
  {
    id: 'SCEN-13A-MIXED-PORTFOLIO-US-EQUITY',
    categoryNumber: 13,
    name: 'Mixed Portfolio: US Equity (MSFT)',
    assetName: 'Microsoft Corporation (MSFT)',
    assetCategory: 'equity',
    description: 'Component of a multi-asset allocation. Intact cloud thesis, moderate drawdown -16%, verified fresh 10-K disclosures.',
    expectedDecision: 'HOLD',
    expectedRationale: 'Rule 1 & Rule 2: Core long-term holding with intact economic moat remains on hold through cyclical market drawdowns.',
    primaryRuleNumber: 1,
    invariantsTested: ['Invariant 1: Price drops alone never trigger SELL or REDUCE', 'Mixed portfolio support'],
    input: {
      holdingName: 'Microsoft Corporation (MSFT)',
      executionMode: 'synthetic_simulation',
      assetCategory: 'equity',
      thesisStatus: 'intact',
      evidenceQuality: 'verified_fresh',
      priceDrawdownPercent: -16.0,
      allocationDriftPercent: 0.5,
      portfolioBudgetAvailable: false,
      traceableEvidenceIds: ['ev-scen-msft-sound'],
      evidenceRecords: SYNTHETIC_SCENARIO_EVIDENCE_RECORDS
    }
  },
  // 13b: Turkish Equity
  {
    id: 'SCEN-13B-MIXED-PORTFOLIO-TURKISH-EQUITY',
    categoryNumber: 13,
    name: 'Mixed Portfolio: Turkish Equity (BIMAS.IS)',
    assetName: 'BİM Birleşik Mağazalar (BIMAS.IS)',
    assetCategory: 'turkish_equity',
    description: 'Component of a multi-asset allocation. Underweight (-3.5%), budget available, favorable dated valuation multiples, positive risk assessment -> INCREASE.',
    expectedDecision: 'INCREASE',
    expectedRationale: 'Rule 4 Triple-Test: Intact Turkish equity thesis, underweight allocation, favorable dated valuation multiples (2026-02-10), and explicit positive risk-budget clearance.',
    primaryRuleNumber: 4,
    invariantsTested: ['Invariant 4: INCREASE requires positive thesis + allocation + favorable valuation', 'Mixed portfolio support'],
    input: {
      holdingName: 'BİM Birleşik Mağazalar (BIMAS.IS)',
      executionMode: 'synthetic_simulation',
      assetCategory: 'turkish_equity',
      thesisStatus: 'intact',
      evidenceQuality: 'verified_fresh',
      priceDrawdownPercent: -4.0,
      allocationDriftPercent: -3.5,
      portfolioBudgetAvailable: true,
      valuationAssessment: {
        isFavorable: true,
        inputTimestamp: '2026-02-10',
        metricsCount: 2
      },
      riskAssessmentSupportsIncrease: true,
      traceableEvidenceIds: ['ev-scen-bimas-sound'],
      evidenceRecords: SYNTHETIC_SCENARIO_EVIDENCE_RECORDS
    }
  },
  // 13c: Global ETF
  {
    id: 'SCEN-13C-MIXED-PORTFOLIO-GLOBAL-ETF',
    categoryNumber: 13,
    name: 'Mixed Portfolio: Global ETF (VT)',
    assetName: 'Vanguard Total World Stock ETF (VT)',
    assetCategory: 'etf',
    description: 'Component of a multi-asset allocation. Overweight (+5.2%) due to global market rally, thesis intact, NO risk concern documented.',
    expectedDecision: 'HOLD',
    expectedRationale: 'Rule 3 & Safeguard 2: Core index foundation drifted above target, but drift alone does not force reduction without documented risk breach.',
    primaryRuleNumber: 3,
    invariantsTested: ['Invariant 2: Allocation drift alone never triggers SELL', 'Invariant 6: REDUCE requires verified risk breach', 'Mixed portfolio support'],
    input: {
      holdingName: 'Vanguard Total World Stock ETF (VT)',
      executionMode: 'synthetic_simulation',
      assetCategory: 'etf',
      thesisStatus: 'intact',
      evidenceQuality: 'verified_fresh',
      priceDrawdownPercent: 22.0,
      allocationDriftPercent: 5.2,
      hasDocumentedRiskConcern: false,
      portfolioBudgetAvailable: false,
      traceableEvidenceIds: ['ev-scen-vt-sound'],
      evidenceRecords: SYNTHETIC_SCENARIO_EVIDENCE_RECORDS
    }
  },
  // 13d: Turkish Mutual Fund
  {
    id: 'SCEN-13D-MIXED-PORTFOLIO-TURKISH-FUND',
    categoryNumber: 13,
    name: 'Mixed Portfolio: Turkish Mutual Fund (TI2)',
    assetName: 'İş Portföy Fonu (TI2)',
    assetCategory: 'turkish_fund',
    description: 'Component of a multi-asset allocation. Monthly portfolio distribution factsheet is stale (>60 days overdue) -> INSUFFICIENT_EVIDENCE.',
    expectedDecision: 'INSUFFICIENT_EVIDENCE',
    expectedRationale: 'Rule 6: TEFAS monthly portfolio distribution sheet exceeds freshness policy thresholds. System refuses to guess portfolio composition.',
    primaryRuleNumber: 6,
    invariantsTested: ['Rule 6 Evidence Freshness Guard', 'Mixed portfolio support'],
    input: {
      holdingName: 'İş Portföy Fonu (TI2)',
      executionMode: 'synthetic_simulation',
      assetCategory: 'turkish_fund',
      thesisStatus: 'intact',
      evidenceQuality: 'stale_or_missing',
      evidenceFreshnessStatus: 'stale',
      priceDrawdownPercent: 5.0,
      allocationDriftPercent: -2.0,
      portfolioBudgetAvailable: true,
      traceableEvidenceIds: ['ev-scen-ti2-stale'],
      evidenceRecords: SYNTHETIC_SCENARIO_EVIDENCE_RECORDS
    }
  },
  // 13e: Bitcoin
  {
    id: 'SCEN-13E-MIXED-PORTFOLIO-BITCOIN',
    categoryNumber: 13,
    name: 'Mixed Portfolio: Bitcoin (BTC)',
    assetName: 'Bitcoin (BTC)',
    assetCategory: 'bitcoin',
    description: 'Component of a multi-asset allocation. Significant price surge pushes allocation +6.5% overweight and independent audit confirms single-asset concentration exceeds 10% ceiling -> REDUCE.',
    expectedDecision: 'REDUCE',
    expectedRationale: 'Rule 3: Verified single-asset concentration breach warrants disciplined partial rebalancing trim back to policy limits.',
    primaryRuleNumber: 3,
    invariantsTested: ['Invariant 6: REDUCE requires verified risk breach', 'Mixed portfolio support'],
    input: {
      holdingName: 'Bitcoin (BTC)',
      executionMode: 'synthetic_simulation',
      assetCategory: 'bitcoin',
      thesisStatus: 'intact',
      evidenceQuality: 'verified_fresh',
      priceDrawdownPercent: 75.0,
      allocationDriftPercent: 6.5,
      hasDocumentedRiskConcern: true,
      traceableRiskEvidenceIds: ['ev-scen-btc-risk-breach'],
      evidenceRecords: SYNTHETIC_SCENARIO_EVIDENCE_RECORDS
    }
  }
];

/**
 * Runs evaluation on all matrix scenarios and returns an auditable summary report.
 */
export function evaluateSyntheticScenarioMatrix(): ScenarioTestResult[] {
  return SYNTHETIC_SCENARIO_MATRIX.map(scenario => {
    const result = evaluateDecisionRules(scenario.input);
    const matched = result.outcome === scenario.expectedDecision;
    return {
      scenarioId: scenario.id,
      name: scenario.name,
      expectedDecision: scenario.expectedDecision,
      actualDecision: result.outcome,
      matched,
      appliedRuleNumbers: result.appliedRules.map(r => r.ruleNumber),
      violationsPrevented: result.violationsPrevented,
      rationale: result.primaryRationale
    };
  });
}
