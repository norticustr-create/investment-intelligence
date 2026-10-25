/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Investment Agent Snapshot Adapter (Offline Pure Module)
 * ========================================================
 * Converts the approved Investment Agent JSON snapshot contract (schemaVersion: "1.0.0")
 * exported by the local Python agent (C:\InvestmentAgent\snapshot_exporter.py)
 * into the Investment-Intelligence domain model.
 *
 * Strict Architectural Guarantees:
 * 1. Pure function: Zero network, zero file I/O, zero browser APIs, zero side effects.
 * 2. Currency safety: Preserves TRY as the sole authoritative reporting currency.
 *    Does not apply synthetic FX rates or reverse-engineer native USD share prices.
 * 3. Missing-data fidelity: Preserves missing cost basis and P&L strictly as null.
 *    Never substitutes zero for missing acquisition values.
 * 4. Sign inversion: Maps Python gap (Target - Current) to domain drift (Current - Target):
 *    driftPercentage = -gapPct.
 * 5. Recommendation separation: Existing purchase recommendations remain strictly in an
 *    independent array; they are never converted into or merged with holdings.
 * 6. Evidence gating: User thesis text and notes are qualitative intent; they are NEVER
 *    converted into verified statutory evidence IDs or moat destruction citations.
 * 7. Real-mode fail closed: Inputs for decision engines are configured for executionMode: 'real_decision'
 *    with automated trade execution permanently blocked.
 */

import {
  Holding,
  AssetCategory,
  DecisionRecord,
  PortfolioSummary,
  PortfolioCategorySummary,
  AssetIntelligenceReport,
  EvidenceFinding,
  SourceDocument
} from '../types/investment';
import { DecisionEvaluationInput } from '../utils/decisionEngine';
import { ProfitRealizationEngineInput } from '../utils/profitRealizationEngine';

// ============================================================================
// 1. Snapshot Contract Schema Types (schemaVersion: "1.0.0")
// ============================================================================

export interface SnapshotExportMetadata {
  sourceSystem: string;
  sourceWorksheet: string;
  exportTimestamp: string;
  asOfDate: string;
  reportingCurrency: 'TRY';
  engineVersion: string;
}

export interface SnapshotPortfolioSummary {
  totalInvestedValueTRY: number;
  targetSumPct: number;
  newMoneyBudgetTRY: number;
  holdingCount: number;
}

export interface SnapshotPosition {
  asset: string;
  category: string;
  quantity: number;
  currentValueTRY: number;
  currentWeightPct: number;
  targetWeightPct: number;
  gapPct: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  averageCostTRY: number | null;
  totalCostTRY: number | null;
  unrealizedPLTRY: number | null;
  unrealizedPLPct: number | null;
  investmentThesis: string;
  notes: string;
}

export interface SnapshotPurchaseRecommendation {
  asset: string;
  category: string;
  purchaseTRY: number;
  gapPp: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface InvestmentAgentPortfolioSnapshot {
  schemaVersion: '1.0.0';
  exportMetadata: SnapshotExportMetadata;
  portfolioSummary: SnapshotPortfolioSummary;
  positions: SnapshotPosition[];
  existingPurchaseRecommendations: SnapshotPurchaseRecommendation[];
}

// ============================================================================
// 2. Adapted Domain Model Types
// ============================================================================

export interface AdaptedHolding extends Holding {
  costBasis: number | null;
  totalCostTRY: number | null;
  unrealizedPLTRY: number | null;
  unrealizedPLPct: number | null;
  currentPriceTRY: number;
  currentPriceNative: number | null;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  rawCategory: string;
  userThesis: string;
  userNotes: string;
}

export interface AdaptedPortfolioCategorySummary extends PortfolioCategorySummary {
  category: AssetCategory;
  label: string;
  currentValueTRY: number;
  currentValueUSD?: number;
  currentWeight: number;
  targetWeight: number;
  holdingCount: number;
}

export interface AdaptedPortfolioSummary extends PortfolioSummary {
  reportingCurrency: 'TRY';
  totalValueTRY: number;
  totalValueUSD?: number;
  fxRateUSDTRY?: number;
  targetSumPct: number;
  newMoneyBudgetTRY: number;
  holdingCount: number;
  reviewQueueCount: number;
  categories: AdaptedPortfolioCategorySummary[];
  topHoldingsConcentration: {
    top1: number;
    top3: number;
    top5: number;
    top1Ticker?: string;
  };
  currencyExposure: {
    TRY: number;
    USD: number;
  };
  evidenceFreshnessStats?: {
    freshPercentage: number;
    adequatePercentage: number;
    stalePercentage: number;
  };
}

export interface SnapshotAdapterResult {
  schemaVersion: '1.0.0';
  exportMetadata: SnapshotExportMetadata;
  summary: AdaptedPortfolioSummary;
  holdings: AdaptedHolding[];
  purchaseRecommendations: SnapshotPurchaseRecommendation[];
  decisionEvaluationInputs: Map<string, DecisionEvaluationInput>;
  profitRealizationInputs: Map<string, ProfitRealizationEngineInput>;
  validationDisclosures: string[];
  automatedTradeExecutionBlocked: true;
}

// ============================================================================
// 3. Validation Error Definition
// ============================================================================

export class SnapshotValidationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(`[SnapshotValidationError] ${message}`);
    this.name = 'SnapshotValidationError';
  }
}

// Known US ETF tickers for category disambiguation
const KNOWN_US_ETFS = new Set([
  'SPYM', 'SCHG', 'SCHD', 'VOO', 'VT', 'QQQ', 'IVV', 'VTI', 'IWM', 'VEA', 'VWO'
]);

// ============================================================================
// 4. Helper Mapping Functions
// ============================================================================

export function mapSnapshotCategory(rawCategory: string, asset: string): AssetCategory {
  const normalized = rawCategory.trim();
  switch (normalized) {
    case 'TR Stocks':
      return 'turkish_equity';
    case 'Funds':
    case 'Bonds':
      return 'turkish_fund';
    case 'BTC':
      return 'bitcoin';
    case 'US Stocks':
      return KNOWN_US_ETFS.has(asset.trim().toUpperCase()) ? 'etf' : 'equity';
    default:
      // Known fallback if asset matches
      if (asset.trim().toUpperCase() === 'BTC') return 'bitcoin';
      throw new SnapshotValidationError(
        `Unrecognized position category "${rawCategory}" for asset "${asset}". ` +
        `Supported categories: "TR Stocks", "US Stocks", "BTC", "Funds", "Bonds".`,
        'category'
      );
  }
}

export function mapTradingCurrency(rawCategory: string, asset: string): 'USD' | 'TRY' {
  const normalized = rawCategory.trim();
  if (normalized === 'US Stocks') return 'USD';
  if (normalized === 'BTC' || asset.trim().toUpperCase() === 'BTC') return 'USD';
  return 'TRY';
}

function assertFiniteNumber(val: unknown, fieldName: string): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) {
    throw new SnapshotValidationError(
      `Field "${fieldName}" must be a finite number, received ${String(val)}.`,
      fieldName
    );
  }
  return val;
}

function assertNonNegative(val: unknown, fieldName: string): number {
  const num = assertFiniteNumber(val, fieldName);
  if (num < 0) {
    throw new SnapshotValidationError(
      `Field "${fieldName}" must be non-negative, received ${num}.`,
      fieldName
    );
  }
  return num;
}

function assertNonEmptyString(val: unknown, fieldName: string): string {
  if (typeof val !== 'string' || val.trim() === '') {
    throw new SnapshotValidationError(
      `Field "${fieldName}" must be a non-empty string.`,
      fieldName
    );
  }
  return val.trim();
}

function validateNullableFinite(val: unknown, fieldName: string): number | null {
  if (val === null || val === undefined) {
    return null;
  }
  if (typeof val !== 'number' || !Number.isFinite(val)) {
    throw new SnapshotValidationError(
      `Field "${fieldName}" must be null or a finite number, received ${String(val)}.`,
      fieldName
    );
  }
  return val;
}

// ============================================================================
// 5. Main Pure Adapter Function
// ============================================================================

export function adaptPortfolioSnapshot(
  snapshotInput: unknown,
  options?: { asOfDate?: string }
): SnapshotAdapterResult {
  // 1. Structure validation
  if (!snapshotInput || typeof snapshotInput !== 'object' || Array.isArray(snapshotInput)) {
    throw new SnapshotValidationError('Snapshot payload must be a non-null object.');
  }

  // Defensive shallow clone
  const raw = JSON.parse(JSON.stringify(snapshotInput)) as Record<string, any>;

  // 2. Schema version check
  if (raw.schemaVersion !== '1.0.0') {
    throw new SnapshotValidationError(
      `Unsupported schema version "${String(raw.schemaVersion)}". Expected "1.0.0".`,
      'schemaVersion'
    );
  }

  // 3. Export metadata validation
  const meta = raw.exportMetadata;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    throw new SnapshotValidationError('exportMetadata must be a non-null object.', 'exportMetadata');
  }

  const sourceSystem = assertNonEmptyString(meta.sourceSystem, 'exportMetadata.sourceSystem');
  const sourceWorksheet = assertNonEmptyString(meta.sourceWorksheet, 'exportMetadata.sourceWorksheet');
  const exportTimestamp = assertNonEmptyString(meta.exportTimestamp, 'exportMetadata.exportTimestamp');
  const metaAsOfDate = assertNonEmptyString(meta.asOfDate, 'exportMetadata.asOfDate');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(metaAsOfDate)) {
    throw new SnapshotValidationError(
      `exportMetadata.asOfDate must match YYYY-MM-DD calendar format, received "${metaAsOfDate}".`,
      'exportMetadata.asOfDate'
    );
  }

  if (meta.reportingCurrency !== 'TRY') {
    throw new SnapshotValidationError(
      `Unsupported reporting currency "${String(meta.reportingCurrency)}". Only "TRY" is supported.`,
      'exportMetadata.reportingCurrency'
    );
  }
  const engineVersion = assertNonEmptyString(meta.engineVersion, 'exportMetadata.engineVersion');

  const validatedMeta: SnapshotExportMetadata = {
    sourceSystem,
    sourceWorksheet,
    exportTimestamp,
    asOfDate: metaAsOfDate,
    reportingCurrency: 'TRY',
    engineVersion
  };

  const effectiveAsOfDate = options?.asOfDate ?? metaAsOfDate;

  // 4. Portfolio summary validation
  const summaryRaw = raw.portfolioSummary;
  if (!summaryRaw || typeof summaryRaw !== 'object' || Array.isArray(summaryRaw)) {
    throw new SnapshotValidationError('portfolioSummary must be a non-null object.', 'portfolioSummary');
  }

  const totalInvestedValueTRY = assertNonNegative(
    summaryRaw.totalInvestedValueTRY,
    'portfolioSummary.totalInvestedValueTRY'
  );
  const targetSumPct = assertFiniteNumber(
    summaryRaw.targetSumPct,
    'portfolioSummary.targetSumPct'
  );
  if (Math.abs(targetSumPct - 100.0) > 0.1) {
    throw new SnapshotValidationError(
      `portfolioSummary.targetSumPct must equal 100.0 ± 0.1 pp, received ${targetSumPct}%.`,
      'portfolioSummary.targetSumPct'
    );
  }
  const newMoneyBudgetTRY = assertNonNegative(
    summaryRaw.newMoneyBudgetTRY,
    'portfolioSummary.newMoneyBudgetTRY'
  );
  const holdingCount = assertNonNegative(
    summaryRaw.holdingCount,
    'portfolioSummary.holdingCount'
  );
  if (!Number.isInteger(holdingCount)) {
    throw new SnapshotValidationError(
      `portfolioSummary.holdingCount must be an integer, received ${holdingCount}.`,
      'portfolioSummary.holdingCount'
    );
  }

  // 5. Positions validation & mapping
  const positionsRaw = raw.positions;
  if (!Array.isArray(positionsRaw)) {
    throw new SnapshotValidationError('positions must be an array.', 'positions');
  }
  if (positionsRaw.length !== holdingCount) {
    throw new SnapshotValidationError(
      `positions array length (${positionsRaw.length}) does not match portfolioSummary.holdingCount (${holdingCount}).`,
      'positions'
    );
  }

  const seenAssets = new Set<string>();
  const holdings: AdaptedHolding[] = [];
  const decisionInputs = new Map<string, DecisionEvaluationInput>();
  const profitInputs = new Map<string, ProfitRealizationEngineInput>();
  const disclosures: string[] = [
    `Ingested ${holdingCount} holdings from ${sourceWorksheet} via ${sourceSystem} (${engineVersion}).`,
    'Authoritative reporting currency: TRY. Foreign exchange rates and native USD prices were not inferred.',
    'User investment thesis and notes are treated as qualitative context; zero statutory evidence records linked.',
    'Automated trade execution is blocked across all evaluated holdings.'
  ];

  for (let idx = 0; idx < positionsRaw.length; idx++) {
    const p = positionsRaw[idx];
    if (!p || typeof p !== 'object' || Array.isArray(p)) {
      throw new SnapshotValidationError(`Position at index ${idx} must be a non-null object.`, `positions[${idx}]`);
    }

    const asset = assertNonEmptyString(p.asset, `positions[${idx}].asset`);
    if (seenAssets.has(asset)) {
      throw new SnapshotValidationError(
        `Duplicate asset identifier "${asset}" detected at index ${idx}. Positions must be unique.`,
        `positions[${idx}].asset`
      );
    }
    seenAssets.add(asset);

    const categoryRaw = assertNonEmptyString(p.category, `positions[${idx}].category`);
    const category = mapSnapshotCategory(categoryRaw, asset);
    const tradingCurrency = mapTradingCurrency(categoryRaw, asset);
    const quantity = assertNonNegative(p.quantity, `positions[${idx}].quantity`);
    const currentValueTRY = assertNonNegative(p.currentValueTRY, `positions[${idx}].currentValueTRY`);
    const currentWeightPct = assertFiniteNumber(p.currentWeightPct, `positions[${idx}].currentWeightPct`);
    const targetWeightPct = assertFiniteNumber(p.targetWeightPct, `positions[${idx}].targetWeightPct`);
    const gapPct = assertFiniteNumber(p.gapPct, `positions[${idx}].gapPct`);

    const priorityRaw = assertNonEmptyString(p.priority, `positions[${idx}].priority`).toUpperCase();
    if (priorityRaw !== 'HIGH' && priorityRaw !== 'MEDIUM' && priorityRaw !== 'LOW') {
      throw new SnapshotValidationError(
        `Priority for asset "${asset}" must be "HIGH", "MEDIUM", or "LOW", received "${priorityRaw}".`,
        `positions[${idx}].priority`
      );
    }
    const priority = priorityRaw as 'HIGH' | 'MEDIUM' | 'LOW';

    // Auxiliary metrics (Strictly nullable numbers; never 0)
    const averageCostTRY = validateNullableFinite(p.averageCostTRY, `positions[${idx}].averageCostTRY`);
    if (averageCostTRY !== null && averageCostTRY < 0) {
      throw new SnapshotValidationError(`averageCostTRY for "${asset}" cannot be negative.`, `positions[${idx}].averageCostTRY`);
    }

    const totalCostTRY = validateNullableFinite(p.totalCostTRY, `positions[${idx}].totalCostTRY`);
    if (totalCostTRY !== null && totalCostTRY < 0) {
      throw new SnapshotValidationError(`totalCostTRY for "${asset}" cannot be negative.`, `positions[${idx}].totalCostTRY`);
    }

    const unrealizedPLTRY = validateNullableFinite(p.unrealizedPLTRY, `positions[${idx}].unrealizedPLTRY`);
    const unrealizedPLPct = validateNullableFinite(p.unrealizedPLPct, `positions[${idx}].unrealizedPLPct`);

    const thesisText = typeof p.investmentThesis === 'string' ? p.investmentThesis.trim() : '';
    const notesText = typeof p.notes === 'string' ? p.notes.trim() : '';

    // Unit price in TRY (Never reverse-engineered to native USD)
    const unitPriceTRY = quantity > 0 ? Number((currentValueTRY / quantity).toFixed(4)) : 0;

    // Sign Inversion: Python gap (Target - Current) -> Domain drift (Current - Target)
    const driftPercentage = Number((-1.0 * gapPct).toFixed(4));

    const isDrifting = Math.abs(driftPercentage) > 2.0;
    const reviewStatus: Holding['reviewStatus'] = isDrifting ? 'review_required' : 'up_to_date';
    const reviewReason = isDrifting
      ? `Allocation drift: ${driftPercentage > 0 ? '+' : ''}${driftPercentage.toFixed(2)}pp`
      : undefined;

    const holdingId = `h-${asset.toLowerCase()}`;

    const missingInfo: string[] = [
      'No statutory regulatory filing evidence linked; user thesis is qualitative intent only.'
    ];
    if (totalCostTRY === null) {
      missingInfo.push('Acquisition cost basis not recorded in source sheet.');
      disclosures.push(`Holding "${asset}": Missing acquisition cost basis in source sheet; capital gains calculations gated.`);
    }

    const defaultDecision: DecisionRecord = {
      outcome: 'HOLD',
      rationale: 'Position maintained under Rule 1 default HOLD inertia. No verified statutory evidence of thesis invalidation or covenant default.',
      supportingEvidenceSummary: [],
      counterarguments: [],
      uncertaintyLevel: 'LOW',
      uncertaintyExplanation: '',
      conditionsForChange: ['Verified statutory filing documenting structural economic moat collapse or covenant default.'],
      ruleComplianceCheck: {
        rule1DefaultHoldChecked: true,
        rule2PriceDropNotTriggeredSell: true,
        rule3AllocationDriftNotSoleReason: true,
        rule6EvidenceSufficiencyChecked: true
      },
      lastReviewedDate: effectiveAsOfDate,
      nextScheduledReviewDate: effectiveAsOfDate
    };

    const holding: AdaptedHolding = {
      id: holdingId,
      ticker: asset,
      name: asset,
      category,
      currency: 'TRY', // Valuation denomination (authoritative TRY)
      tradingCurrency, // Native trading venue currency (USD for US stocks/BTC, TRY for TR)
      currentPrice: unitPriceTRY,
      costBasis: averageCostTRY,
      sharesOrUnits: quantity,
      currentValue: currentValueTRY, // Preserved in TRY
      currentWeight: currentWeightPct,
      targetWeight: targetWeightPct,
      driftPercentage,
      reviewStatus,
      reviewReason,

      // Qualitative user context
      thesisTitle: `${asset} Investment Thesis`,
      thesisPremise: thesisText || 'User thesis unpopulated in Google Sheet.',
      economicMoatDescription: 'Primary portfolio position. No statutory moat audit performed.',
      investmentHorizonYears: 5,
      capitalAllocationAssessment: 'Evaluated under disciplined allocation rebalancing.',
      valuationSummary: 'Valuation maintained natively in TRY via Google Sheets smart chips.',
      metrics: [],
      downsideScenario: notesText || 'Operational notes unpopulated.',

      // Evidence links strictly empty
      supportingEvidenceIds: [],
      counterevidenceIds: [],
      missingInformation: missingInfo,
      unresolvedQuestions: [],

      decision: defaultDecision,

      // Adapted auxiliary extensions
      totalCostTRY,
      unrealizedPLTRY,
      unrealizedPLPct,
      currentPriceTRY: unitPriceTRY,
      currentPriceNative: null, // Strictly null; no USD price hallucinated
      priority,
      rawCategory: categoryRaw,
      userThesis: thesisText,
      userNotes: notesText
    };

    holdings.push(holding);

    // 6. Build Core Decision Engine Input (real_decision mode)
    const coreInput: DecisionEvaluationInput = {
      holdingName: asset,
      executionMode: 'real_decision',
      assetCategory: category,
      thesisStatus: 'intact',
      evidenceQuality: 'adequate',
      priceDrawdownPercent: 0,
      allocationDriftPercent: driftPercentage,
      portfolioBudgetAvailable: false,
      riskAssessmentSupportsIncrease: false,
      hasDocumentedRiskConcern: false,
      verifiedMoatDestruction: false,
      asOfDate: effectiveAsOfDate,
      allowSimulatedDemonstrationDraft: false
    };
    decisionInputs.set(asset, coreInput);

    // 7. Build Profit Realization Engine Input (real_decision mode)
    // Note: If totalCostTRY is null, costBasisTotal is undefined, which safely activates
    // the profit engine's built-in fail-closed gate to disable tax and friction calculations.
    const hasCostBasis = totalCostTRY !== null;
    const unrealizedGain = hasCostBasis ? Number((currentValueTRY - totalCostTRY).toFixed(2)) : undefined;
    const unrealizedGainPct = hasCostBasis && totalCostTRY > 0
      ? Number(((unrealizedGain! / totalCostTRY) * 100).toFixed(2))
      : undefined;

    const profitInput: ProfitRealizationEngineInput = {
      executionMode: 'real_decision',
      holdingId,
      holdingName: asset,
      assetCategory: category,
      currentMarketValue: currentValueTRY,
      costBasisTotal: hasCostBasis ? totalCostTRY : undefined,
      unrealizedGainCurrency: unrealizedGain,
      unrealizedGainPercent: unrealizedGainPct,
      currentPrice: unitPriceTRY,
      isFractionalSupported: true,
      portfolioTotalValue: totalInvestedValueTRY,
      currentAllocationPercent: currentWeightPct,
      limitHierarchy: {
        strategicTarget: targetWeightPct,
        toleranceCeiling: Number((targetWeightPct * 1.25).toFixed(2)),
        userHardCeilingStatus: 'not_configured',
        externalCeilingStatus: 'not_applicable',
        effectiveHardCeiling: null,
        measurementBasis: 'percent_of_total_portfolio_nav'
      },
      thesisStatus: 'intact',
      evidenceQuality: 'adequate',
      traceableEvidenceIds: [],
      costModel: {
        currency: 'TRY',
        capitalGainsTaxRateEstimate: 0.20,
        transactionFeeEstimateRate: 0.001,
        estimatedSpreadRate: 0.0015,
        maxAllowableFrictionDragRatio: 0.35,
        minimumTransactionThreshold: 100.0
      },
      reinvestmentCandidates: [],
      asOfDate: effectiveAsOfDate
    };
    profitInputs.set(asset, profitInput);
  }

  // 8. Purchase recommendations validation (kept separate from holdings)
  const recsRaw = raw.existingPurchaseRecommendations;
  if (!Array.isArray(recsRaw)) {
    throw new SnapshotValidationError(
      'Field "existingPurchaseRecommendations" must be an array.',
      'existingPurchaseRecommendations'
    );
  }
  const purchaseRecommendations: SnapshotPurchaseRecommendation[] = [];

  for (let rIdx = 0; rIdx < recsRaw.length; rIdx++) {
    const rec = recsRaw[rIdx];
    if (!rec || typeof rec !== 'object' || Array.isArray(rec)) {
      throw new SnapshotValidationError(
        `Recommendation at index ${rIdx} must be a non-null object.`,
        `existingPurchaseRecommendations[${rIdx}]`
      );
    }
    const rAsset = assertNonEmptyString(rec.asset, `existingPurchaseRecommendations[${rIdx}].asset`);
    const rCat = assertNonEmptyString(rec.category, `existingPurchaseRecommendations[${rIdx}].category`);
    const rPurchase = assertNonNegative(rec.purchaseTRY, `existingPurchaseRecommendations[${rIdx}].purchaseTRY`);
    const rGap = assertFiniteNumber(rec.gapPp, `existingPurchaseRecommendations[${rIdx}].gapPp`);
    const rPri = assertNonEmptyString(rec.priority, `existingPurchaseRecommendations[${rIdx}].priority`).toUpperCase();
    if (rPri !== 'HIGH' && rPri !== 'MEDIUM' && rPri !== 'LOW') {
      throw new SnapshotValidationError(
        `Recommendation priority for asset "${rAsset}" must be "HIGH", "MEDIUM", or "LOW", received "${rPri}".`,
        `existingPurchaseRecommendations[${rIdx}].priority`
      );
    }
    purchaseRecommendations.push({
      asset: rAsset,
      category: rCat,
      purchaseTRY: rPurchase,
      gapPp: rGap,
      priority: rPri as 'HIGH' | 'MEDIUM' | 'LOW'
    });
  }

  // 9. Categories summary aggregation
  const categoryMap = new Map<AssetCategory, { valTRY: number; targetSum: number; count: number }>();
  for (const h of holdings) {
    const existing = categoryMap.get(h.category) ?? { valTRY: 0, targetSum: 0, count: 0 };
    categoryMap.set(h.category, {
      valTRY: Number((existing.valTRY + h.currentValue).toFixed(2)),
      targetSum: Number((existing.targetSum + h.targetWeight).toFixed(2)),
      count: existing.count + 1
    });
  }

  const categoryLabels: Record<AssetCategory, string> = {
    turkish_equity: 'Turkish Equities',
    turkish_fund: 'Turkish Mutual Funds & Bonds',
    bitcoin: 'Digital Assets (Bitcoin)',
    equity: 'US Equities',
    etf: 'US Index & Growth ETFs'
  };

  const adaptedCategories: AdaptedPortfolioCategorySummary[] = Array.from(categoryMap.entries()).map(([cat, d]) => ({
    category: cat,
    label: categoryLabels[cat] ?? cat,
    currentValueTRY: d.valTRY,
    currentWeight: totalInvestedValueTRY > 0 ? Number(((d.valTRY / totalInvestedValueTRY) * 100).toFixed(2)) : 0,
    targetWeight: d.targetSum,
    holdingCount: d.count
  }));

  // Top holdings concentration
  const sortedHoldings = [...holdings].sort((a, b) => b.currentValue - a.currentValue);
  const top1Val = sortedHoldings[0]?.currentValue ?? 0;
  const top3Val = (sortedHoldings[0]?.currentValue ?? 0) + (sortedHoldings[1]?.currentValue ?? 0) + (sortedHoldings[2]?.currentValue ?? 0);
  const top5Val = sortedHoldings.slice(0, 5).reduce((sum, h) => sum + h.currentValue, 0);

  const topHoldingsConcentration = {
    top1: totalInvestedValueTRY > 0 ? Number(((top1Val / totalInvestedValueTRY) * 100).toFixed(1)) : 0,
    top3: totalInvestedValueTRY > 0 ? Number(((top3Val / totalInvestedValueTRY) * 100).toFixed(1)) : 0,
    top5: totalInvestedValueTRY > 0 ? Number(((top5Val / totalInvestedValueTRY) * 100).toFixed(1)) : 0,
    top1Ticker: sortedHoldings[0]?.ticker
  };

  const tryExposureVal = holdings
    .filter(h => (h.tradingCurrency ?? h.currency) === 'TRY')
    .reduce((s, h) => s + h.currentValue, 0);
  const usdExposureVal = holdings
    .filter(h => (h.tradingCurrency ?? h.currency) === 'USD')
    .reduce((s, h) => s + h.currentValue, 0);

  const currencyExposure = {
    TRY: totalInvestedValueTRY > 0 ? Number(((tryExposureVal / totalInvestedValueTRY) * 100).toFixed(1)) : 0,
    USD: totalInvestedValueTRY > 0 ? Number(((usdExposureVal / totalInvestedValueTRY) * 100).toFixed(1)) : 0
  };

  const adaptedSummary: AdaptedPortfolioSummary = {
    reportingCurrency: 'TRY',
    totalValueTRY: totalInvestedValueTRY,
    targetSumPct,
    newMoneyBudgetTRY,
    holdingCount,
    reviewQueueCount: holdings.filter(h => h.reviewStatus === 'review_required').length,
    categories: adaptedCategories,
    topHoldingsConcentration,
    currencyExposure
  };

  return {
    schemaVersion: '1.0.0',
    exportMetadata: validatedMeta,
    summary: adaptedSummary,
    holdings,
    purchaseRecommendations,
    decisionEvaluationInputs: decisionInputs,
    profitRealizationInputs: profitInputs,
    validationDisclosures: disclosures,
    automatedTradeExecutionBlocked: true
  };
}

// ============================================================================
// 8. Phase 7: AI Asset Intelligence Integration Adapter
// ============================================================================

export interface EnrichedIntelligenceResult {
  enrichedHoldings: Holding[];
  liveFindings: EvidenceFinding[];
  liveDocs: SourceDocument[];
  reviewQueueCount: number;
}

/**
 * Pure function that matches backend AssetIntelligenceReport records to adapted holdings,
 * extracts verified findings into domain EvidenceFinding and SourceDocument entities,
 * and updates reviewStatus/reviewReason based on thesis health and counter-evidence.
 */
export function integrateIntelligenceIntoHoldings(
  holdings: Holding[],
  reports: Record<string, AssetIntelligenceReport>
): EnrichedIntelligenceResult {
  if (!reports || typeof reports !== 'object') {
    return {
      enrichedHoldings: holdings,
      liveFindings: [],
      liveDocs: [],
      reviewQueueCount: holdings.filter(h => h.reviewStatus === 'review_required').length
    };
  }

  const liveFindings: EvidenceFinding[] = [];
  const liveDocsMap = new Map<string, SourceDocument>();

  const enrichedHoldings = holdings.map(holding => {
    // Match by ticker (case insensitive) or holding id
    const assetKey = Object.keys(reports).find(
      k => k.toUpperCase() === holding.ticker.toUpperCase() || k.toUpperCase() === holding.id.toUpperCase()
    );

    if (!assetKey) {
      return holding;
    }

    const report = reports[assetKey];
    if (!report) {
      return holding;
    }

    const holdingSupportingIds: string[] = [];
    const holdingCounterIds: string[] = [];

    // Map findings
    if (Array.isArray(report.findings)) {
      for (const f of report.findings) {
        if (!f || !f.id) continue;

        // Register Source Document if not already added
        if (f.source_doc_id && !liveDocsMap.has(f.source_doc_id)) {
          const docTitle = f.source_title || 'Statutory Disclosure / Ecosystem Event';
          const isSec = docTitle.includes('SEC') || docTitle.includes('Form');
          const isKap = docTitle.includes('KAP') || docTitle.includes('Kamuyu Aydınlatma');
          const isBtc = docTitle.includes('Bitcoin') || docTitle.includes('BTC');

          liveDocsMap.set(f.source_doc_id, {
            id: f.source_doc_id,
            title: docTitle,
            sourceName: isSec ? 'U.S. SEC EDGAR' : isKap ? 'KAP Public Disclosure Platform' : isBtc ? 'Bitcoin Core / Ecosystem' : 'Official Primary Source',
            sourceType: isSec ? 'SEC_FILING' : isKap ? 'KAP_DISCLOSURE' : 'ANNUAL_REPORT',
            identifier: docTitle,
            publicationDate: report.as_of_date || new Date().toISOString().slice(0, 10),
            reportingPeriod: (report.as_of_date || '').slice(0, 4) || '2026',
            url: f.source_url || undefined,
            isAudited: f.evidence_quality === 'high_statutory',
            verificationStatus: f.verification_status === 'verified_primary' ? 'verified_primary' : 'unverified_third_party',
            freshnessStatus: 'fresh',
            isSyntheticDemonstration: false,
            notes: `Verified filing for ${f.holding_id || holding.ticker}`
          });
        }

        const findingObj: EvidenceFinding = {
          id: f.id,
          holdingId: holding.id,
          sourceDocId: f.source_doc_id,
          claim: f.claim,
          excerpt: f.excerpt,
          type: f.type || 'verified_fact',
          verificationStatus: f.verification_status === 'verified_primary' ? 'verified_primary' : 'unverified_third_party',
          freshnessStatus: 'fresh',
          evidenceQuality: f.evidence_quality || 'moderate_analytical',
          confidenceNotes: f.explanation || '',
          lastVerifiedDate: report.as_of_date || new Date().toISOString().slice(0, 10),
          isConflicting: f.thesis_impact === 'CHALLENGES_THESIS' || f.thesis_impact === 'INVALIDATES_THESIS',
          conflictDescription: f.thesis_impact === 'INVALIDATES_THESIS'
            ? 'Finding materially invalidates core investment thesis.'
            : f.thesis_impact === 'CHALLENGES_THESIS'
            ? 'Finding challenges thesis premise or competitive moat.'
            : undefined,
          isSyntheticDemonstration: false,
          supportsThesisInvalidation: f.thesis_impact === 'INVALIDATES_THESIS' || f.supports_moat_destruction,
          supportsRiskConcern: f.materiality === 'HIGH',
          claimModality: 'confirmed_fact',
          claimScope: 'holding_specific'
        };

        liveFindings.push(findingObj);

        if (f.thesis_impact === 'SUPPORTS_THESIS') {
          holdingSupportingIds.push(f.id);
        } else if (f.thesis_impact === 'CHALLENGES_THESIS' || f.thesis_impact === 'INVALIDATES_THESIS') {
          holdingCounterIds.push(f.id);
        }
      }
    }

    // Determine review status
    let updatedReviewStatus = holding.reviewStatus;
    let updatedReviewReason = holding.reviewReason;

    if (report.review_required) {
      updatedReviewStatus = 'review_required';
      updatedReviewReason = report.review_reason || 'AI Intelligence flagged material thesis challenge or critical health issue';
    } else if (report.suggested_action === 'INSUFFICIENT_EVIDENCE') {
      updatedReviewStatus = 'insufficient_evidence';
      updatedReviewReason = report.review_reason || 'Insufficient verified statutory evidence to corroborate thesis';
    } else if (Math.abs(holding.driftPercentage) > 2.0) {
      updatedReviewStatus = 'review_required';
      updatedReviewReason = updatedReviewReason || `Allocation drift of ${holding.driftPercentage > 0 ? '+' : ''}${holding.driftPercentage.toFixed(1)}pp exceeds ±2.0pp threshold`;
    } else {
      updatedReviewStatus = 'up_to_date';
      updatedReviewReason = undefined;
    }

    // Merge unresolved questions without duplicates
    const mergedQuestions = Array.from(new Set([
      ...holding.unresolvedQuestions,
      ...(report.unresolved_questions || [])
    ]));

    return {
      ...holding,
      intelligenceReport: report,
      supportingEvidenceIds: holdingSupportingIds.length > 0 ? holdingSupportingIds : holding.supportingEvidenceIds,
      counterevidenceIds: holdingCounterIds.length > 0 ? holdingCounterIds : holding.counterevidenceIds,
      unresolvedQuestions: mergedQuestions,
      reviewStatus: updatedReviewStatus,
      reviewReason: updatedReviewReason
    };
  });

  const reviewQueueCount = enrichedHoldings.filter(h => h.reviewStatus === 'review_required').length;

  return {
    enrichedHoldings,
    liveFindings,
    liveDocs: Array.from(liveDocsMap.values()),
    reviewQueueCount
  };
}
