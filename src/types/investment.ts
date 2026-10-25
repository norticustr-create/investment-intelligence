/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AssetCategory =
  | 'equity'
  | 'etf'
  | 'bitcoin'
  | 'turkish_equity'
  | 'turkish_fund';

export type DecisionOutcome =
  | 'HOLD'
  | 'INCREASE'
  | 'REDUCE'
  | 'SELL'
  | 'INSUFFICIENT_EVIDENCE';

export type EvidenceType =
  | 'verified_fact'       // Audited reports, regulatory filings (SEC 10-K, KAP, TEFAS)
  | 'model_interpretation' // DCF, multi-scenario projections, sensitivity analyses
  | 'conflicting_evidence' // Divergent analyst estimates, disputed margin guidance
  | 'stale_evidence';      // Overdue data (>180 days) lacking primary source confirmation

export type VerificationStatus =
  | 'verified_primary'       // Formally matched with primary statutory authority
  | 'unverified_third_party' // Third-party aggregator lacking primary verification
  | 'simulated_demonstration'; // Synthetic demonstration model for research terminal testing

export type FreshnessStatus = 'fresh' | 'adequate' | 'stale' | 'expired';

export type EvidenceQuality =
  | 'high_statutory'      // Audited reports, direct regulatory filings
  | 'moderate_analytical' // Sensitivities, model interpretations with dated inputs
  | 'conflicting'         // Disputed evidence, opposing regulatory findings
  | 'insufficient';       // Missing, stale, or unverified claims

export interface SourceDocument {
  id: string;
  title: string;
  sourceName: string; // e.g. "U.S. SEC EDGAR", "KAP Public Disclosure Platform", "TEFAS Platform"
  sourceType: 'SEC_FILING' | 'KAP_DISCLOSURE' | 'TEFAS_FACTSHEET' | 'ONCHAIN_AUDIT' | 'CENTRAL_BANK_REPORT' | 'ANNUAL_REPORT';
  identifier: string; // e.g. "SEC Form 10-K FY2025 (Acc: 0000950170-25-089123)"
  publicationDate: string; // YYYY-MM-DD
  reportingPeriod: string; // e.g. "FY 2025", "Q3 2025", "Monthly Dec 2025"
  dataTimestamp?: string;  // Explicit date when data point was recorded
  retrievalTimestamp?: string; // Date when data was retrieved / indexed
  url?: string;
  isAudited: boolean;
  verificationStatus: VerificationStatus;
  freshnessStatus: FreshnessStatus;
  isSyntheticDemonstration: boolean;
  notes?: string;
}

export type ClaimModality =
  | 'confirmed_fact'
  | 'negated'
  | 'hypothetical'
  | 'allegation_or_rumor'
  | 'denial_or_rebuttal';

export type ClaimScope =
  | 'holding_specific'
  | 'portfolio_specific'
  | 'macro_general'
  | 'unrelated';

export interface EvidenceFinding {
  id: string;
  holdingId: string;
  sourceDocId: string;
  claim: string;
  excerpt: string;
  type: EvidenceType;
  verificationStatus: VerificationStatus;
  freshnessStatus: FreshnessStatus;
  evidenceQuality: EvidenceQuality;
  confidenceNotes: string;
  lastVerifiedDate: string;
  dataTimestamp?: string;
  retrievalTimestamp?: string;
  isConflicting?: boolean;
  conflictDescription?: string;
  isSyntheticDemonstration: boolean;
  supportsThesisInvalidation?: boolean;
  supportsRiskConcern?: boolean;
  claimModality?: ClaimModality;
  claimScope?: ClaimScope;
}

export interface ValuationMetric {
  label: string;
  currentValue: string;
  historicalRangeOrBenchmark: string;
  context: string;
  isFavorable: boolean | null; // null = neutral or unknown
  dataTimestamp?: string;      // Dated input timestamp
  isSyntheticDemonstration?: boolean;
}

export interface DecisionRecord {
  outcome: DecisionOutcome;
  rationale: string;
  supportingEvidenceSummary: string[];
  counterarguments: string[];
  uncertaintyLevel: 'LOW' | 'MODERATE' | 'HIGH';
  uncertaintyExplanation: string;
  conditionsForChange: string[];
  ruleComplianceCheck: {
    rule1DefaultHoldChecked: boolean;
    rule2PriceDropNotTriggeredSell: boolean;
    rule3AllocationDriftNotSoleReason: boolean;
    rule4IncreaseTripleTestPassed?: boolean;
    rule5SellHighBarMoatBreak?: boolean;
    rule6EvidenceSufficiencyChecked: boolean;
  };
  lastReviewedDate: string;
  nextScheduledReviewDate: string;
}

export interface Holding {
  id: string;
  ticker: string;
  name: string;
  category: AssetCategory;
  currency: 'USD' | 'TRY' | 'EUR'; // Valuation/reporting denomination of currentPrice, costBasis, currentValue
  tradingCurrency?: 'USD' | 'TRY' | 'EUR'; // Native trading venue currency if different from valuation currency
  currentPriceNative?: number | null; // Native market price, strictly when reliably available
  currentPrice: number;
  costBasis: number | null; // Null when acquisition cost is untracked or unavailable
  sharesOrUnits: number;
  currentValue: number;
  currentWeight: number; // Percentage (e.g. 24.5)
  targetWeight: number;  // Percentage (e.g. 25.0)
  driftPercentage: number; // currentWeight - targetWeight
  reviewStatus: 'up_to_date' | 'review_required' | 'insufficient_evidence';
  reviewReason?: string;

  // Thesis details
  thesisTitle: string;
  thesisPremise: string;
  economicMoatDescription: string;
  investmentHorizonYears: number;
  capitalAllocationAssessment: string;

  // Valuation & Downside
  valuationSummary: string;
  metrics: ValuationMetric[];
  downsideScenario: string;

  // Evidence links
  supportingEvidenceIds: string[];
  counterevidenceIds: string[];
  missingInformation: string[];
  unresolvedQuestions: string[];

  // Primary decision
  decision: DecisionRecord;

  // AI Intelligence Report (Phase 7)
  intelligenceReport?: AssetIntelligenceReport;
}

export type DataSourceMode = 'synthetic_demonstration' | 'local_snapshot' | 'cloud_live';

export interface DataSourceMetadata {
  mode: DataSourceMode;
  label: string;
  description: string;
  sourceSystem?: string;
  sourceWorksheet?: string;
  asOfDate?: string;
  engineVersion?: string;
  reportingCurrency?: 'TRY' | 'USD';
}

export interface SnapshotPurchaseRecommendation {
  asset: string;
  category: string;
  purchaseTRY: number;
  gapPp: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

// ============================================================================
// AI Asset Intelligence Types (Phase 7)
// ============================================================================

export type HealthStatus = 'EXCELLENT' | 'SOUND' | 'WATCHLIST' | 'CRITICAL';
export type ThesisStatus = 'intact' | 'questionable' | 'materially_invalidated';
export type UncertaintyLevel = 'LOW' | 'MODERATE' | 'HIGH';
export type FindingMateriality = 'HIGH' | 'MEDIUM' | 'LOW' | 'NOISE';
export type ThesisImpact = 'SUPPORTS_THESIS' | 'NEUTRAL' | 'CHALLENGES_THESIS' | 'INVALIDATES_THESIS';

export interface AnalyzedFinding {
  id: string; // finding-{sha256[:16]}
  holding_id: string; // ticker
  source_doc_id: string; // doc-{sha256[:16]}
  claim: string;
  excerpt: string;
  type: 'verified_fact' | 'model_interpretation' | 'conflicting_evidence' | 'stale_evidence';
  verification_status: 'verified_primary' | 'unverified_third_party';
  evidence_quality: 'high_statutory' | 'moderate_analytical' | 'conflicting' | 'insufficient';
  materiality: FindingMateriality;
  thesis_impact: ThesisImpact;
  supports_moat_destruction: boolean;
  explanation: string;
  source_url: string;
  source_title: string;
}

export interface AssetIntelligenceReport {
  asset: string;
  as_of_date: string;
  thesis_evaluated: string;
  overall_health: HealthStatus;
  thesis_status: ThesisStatus;
  review_required: boolean;
  review_reason: string | null;
  uncertainty_level: UncertaintyLevel;
  uncertainty_explanation: string;
  suggested_action: 'HOLD' | 'INCREASE' | 'REDUCE' | 'SELL' | 'INSUFFICIENT_EVIDENCE';
  findings: AnalyzedFinding[];
  unresolved_questions: string[];
  automated_execution_blocked: true;
  documents_analyzed: number;
  generation_timestamp: string;
  model_version: string;
}

export interface IntelligenceApiResponse {
  status: 'success' | 'error';
  as_of_date: string;
  cached: boolean;
  cache_expires_at: string | null;
  data_source: string;
  user: string;
  reports: Record<string, AssetIntelligenceReport>;
  documents_ingested: number;
  sources_contacted: string[];
  errors: string[];
  automated_execution_blocked: true;
}

export type PortfolioSessionState =
  | {
      mode: 'synthetic_demonstration';
      dataSource: DataSourceMetadata;
      holdings: Holding[];
      summary: PortfolioSummary;
      purchaseRecommendations: SnapshotPurchaseRecommendation[];
      validationDisclosures?: string[];
      provenanceFilename?: undefined;
      authenticatedUserEmail?: undefined;
      intelligenceReports?: Record<string, AssetIntelligenceReport>;
      intelligenceLoading?: boolean;
      intelligenceError?: string | null;
      intelligenceCached?: boolean;
      intelligenceAsOfDate?: string;
      liveEvidenceFindings?: EvidenceFinding[];
      liveSourceDocuments?: SourceDocument[];
    }
  | {
      mode: 'local_snapshot';
      dataSource: DataSourceMetadata;
      holdings: Holding[];
      summary: PortfolioSummary;
      purchaseRecommendations: SnapshotPurchaseRecommendation[];
      validationDisclosures: string[];
      provenanceFilename: string;
      authenticatedUserEmail?: undefined;
      intelligenceReports?: Record<string, AssetIntelligenceReport>;
      intelligenceLoading?: boolean;
      intelligenceError?: string | null;
      intelligenceCached?: boolean;
      intelligenceAsOfDate?: string;
      liveEvidenceFindings?: EvidenceFinding[];
      liveSourceDocuments?: SourceDocument[];
    }
  | {
      mode: 'cloud_live';
      dataSource: DataSourceMetadata;
      holdings: Holding[];
      summary: PortfolioSummary;
      purchaseRecommendations: SnapshotPurchaseRecommendation[];
      validationDisclosures: string[];
      provenanceFilename?: undefined;
      authenticatedUserEmail?: string;
      intelligenceReports?: Record<string, AssetIntelligenceReport>;
      intelligenceLoading?: boolean;
      intelligenceError?: string | null;
      intelligenceCached?: boolean;
      intelligenceAsOfDate?: string;
      liveEvidenceFindings?: EvidenceFinding[];
      liveSourceDocuments?: SourceDocument[];
    };

export const DEFAULT_SYNTHETIC_DATA_SOURCE: DataSourceMetadata = {
  mode: 'synthetic_demonstration',
  label: 'SYNTHETIC DEMONSTRATION DATA',
  description: 'All holdings, financial metrics, and filings are realistic synthetic models illustrating long-term decision-support protocols.',
  reportingCurrency: 'USD'
};

export interface PortfolioCategorySummary {
  category: AssetCategory;
  label: string;
  currentValueTRY: number;
  currentValueUSD?: number;
  currentWeight: number;
  targetWeight: number;
  holdingCount: number;
}

export interface PortfolioSummary {
  reportingCurrency: 'TRY' | 'USD';
  totalValueTRY: number;
  totalValueUSD?: number;
  fxRateUSDTRY?: number;
  targetSumPct?: number;
  newMoneyBudgetTRY?: number;
  holdingCount?: number;
  categories: PortfolioCategorySummary[];
  topHoldingsConcentration: {
    top1: number;
    top3: number;
    top5: number;
    top1Ticker?: string;
  };
  currencyExposure: {
    USD: number;
    TRY: number;
  };
  reviewQueueCount: number;
  evidenceFreshnessStats?: {
    freshPercentage: number;
    adequatePercentage: number;
    stalePercentage: number;
  };
}
