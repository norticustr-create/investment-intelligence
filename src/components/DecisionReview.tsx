/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Holding, DecisionOutcome, SourceDocument } from '../types/investment';
import { SYNTHETIC_SOURCE_DOCUMENTS, SYNTHETIC_EVIDENCE_FINDINGS, SYNTHETIC_USD_TRY_RATE } from '../data/syntheticPortfolio';
import { DecisionEvaluationInput } from '../utils/decisionEngine';
import {
  evaluateInvestmentOrchestration,
  InvestmentOrchestratorInput,
  InvestmentOrchestratorResult
} from '../utils/investmentOrchestrator';
import { ProfitRealizationEngineInput } from '../utils/profitRealizationEngine';
import {
  Compass,
  CheckCircle2,
  AlertOctagon,
  AlertTriangle,
  HelpCircle,
  TrendingDown,
  ArrowRight,
  ShieldCheck,
  Scale,
  Sliders,
  RotateCcw,
  Coins,
  Percent,
  Lock,
  Info
} from 'lucide-react';

interface DecisionReviewProps {
  holdings: Holding[];
  onSelectHoldingForResearch: (holdingId: string) => void;
  onInspectDocument: (doc: SourceDocument) => void;
}

const formatCurrencyAmount = (
  value: number | null | undefined,
  currencyCode?: string | null
): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'N/A';
  }

  const formattedNum = value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  if (!currencyCode || typeof currencyCode !== 'string' || !currencyCode.trim()) {
    return `${formattedNum} (Currency unspecified)`;
  }

  const normalized = currencyCode.trim().toUpperCase();
  if (normalized === 'UNSPECIFIED' || normalized === 'UNKNOWN') {
    return `${formattedNum} (Currency unspecified)`;
  }

  switch (normalized) {
    case 'USD':
      return `$${formattedNum}`;
    case 'TRY':
      return `₺${formattedNum}`;
    case 'EUR':
      return `€${formattedNum}`;
    case 'GBP':
      return `£${formattedNum}`;
    default:
      return `${formattedNum} ${normalized}`;
  }
};

export const DecisionReview: React.FC<DecisionReviewProps> = ({
  holdings,
  onSelectHoldingForResearch,
  onInspectDocument
}) => {
  const [filterOutcome, setFilterOutcome] = useState<string>('all');
  const [selectedSimulatorHoldingId, setSelectedSimulatorHoldingId] = useState<string>(() => holdings[0]?.id || '');

  // Interactive Simulator State
  const [simThesisStatus, setSimThesisStatus] = useState<'intact' | 'questionable' | 'materially_invalidated'>('intact');
  const [simEvidenceQuality, setSimEvidenceQuality] = useState<'verified_fresh' | 'adequate' | 'stale_or_missing' | 'conflicting'>('verified_fresh');
  const [simPriceDrawdown, setSimPriceDrawdown] = useState<number>(-5);
  const [simAllocationDrift, setSimAllocationDrift] = useState<number>(0.2);
  const [simValuationFavorable, setSimValuationFavorable] = useState<boolean>(true);
  const [simPortfolioBudgetAvailable, setSimPortfolioBudgetAvailable] = useState<boolean>(false);
  const [simVerifiedMoatDestruction, setSimVerifiedMoatDestruction] = useState<boolean>(false);
  const [simHasTraceableEvidence, setSimHasTraceableEvidence] = useState<boolean>(true);
  const [simHasRiskConcern, setSimHasRiskConcern] = useState<boolean>(false);

  const activeSimulatorHolding = holdings.find(h => h.id === selectedSimulatorHoldingId) || holdings[0];

  // Load selected holding into simulator
  const handleLoadHoldingIntoSimulator = (h: Holding) => {
    setSelectedSimulatorHoldingId(h.id);
    const hasCostBasis = h.costBasis !== null && h.costBasis > 0;
    const pnl = hasCostBasis ? ((h.currentPrice - h.costBasis!) / h.costBasis!) * 100 : 0;
    setSimPriceDrawdown(pnl < 0 ? parseFloat(pnl.toFixed(1)) : 0);
    setSimAllocationDrift(h.driftPercentage);
    setSimValuationFavorable(h.decision.outcome === 'INCREASE');
    setSimPortfolioBudgetAvailable(h.driftPercentage < 0);
    setSimVerifiedMoatDestruction(h.decision.outcome === 'SELL');
    setSimThesisStatus(h.decision.outcome === 'SELL' ? 'materially_invalidated' : 'intact');
    setSimEvidenceQuality(h.decision.outcome === 'INSUFFICIENT_EVIDENCE' ? 'stale_or_missing' : 'verified_fresh');
    setSimHasTraceableEvidence(true);
    setSimHasRiskConcern(h.decision.outcome === 'REDUCE');
  };

  if (!holdings || holdings.length === 0 || !activeSimulatorHolding) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-12 text-center text-slate-400">
        <p className="text-base font-medium text-slate-300">No holdings available for decision review.</p>
        <p className="text-xs text-slate-500 mt-1">Please load a portfolio to inspect stewardship decisions.</p>
      </div>
    );
  }

  // Coordinated evaluation derivation
  const targetWeight = activeSimulatorHolding.targetWeight;
  const toleranceCeiling = Number((targetWeight * 1.25).toFixed(2)); // 25% relative tolerance over target
  const simulatedCurrentWeight = Math.max(0, Math.min(100, Number((targetWeight + simAllocationDrift).toFixed(2))));

  // Normalized portfolio value calculation
  const allSameCurrency = holdings.every(h => h.currency === activeSimulatorHolding.currency);
  const totalPortfolioValueUSD = holdings.reduce((sum, h) => {
    return sum + (h.currency === 'USD' ? h.currentValue : h.currentValue / SYNTHETIC_USD_TRY_RATE);
  }, 0);
  const portfolioTotalValue = allSameCurrency
    ? holdings.reduce((sum, h) => sum + h.currentValue, 0)
    : activeSimulatorHolding.currency === 'TRY'
    ? totalPortfolioValueUSD * SYNTHETIC_USD_TRY_RATE
    : totalPortfolioValueUSD;

  const hasCostBasis = activeSimulatorHolding.costBasis !== null && activeSimulatorHolding.costBasis >= 0;
  const costBasisTotal = hasCostBasis
    ? Number((activeSimulatorHolding.costBasis! * activeSimulatorHolding.sharesOrUnits).toFixed(2))
    : undefined;
  const currentMarketValue = activeSimulatorHolding.currentValue;
  const unrealizedGainCurrency = (hasCostBasis && costBasisTotal !== undefined)
    ? Number((currentMarketValue - costBasisTotal).toFixed(2))
    : undefined;
  const unrealizedGainPercent = (hasCostBasis && costBasisTotal !== undefined && costBasisTotal > 0)
    ? Number(((unrealizedGainCurrency! / costBasisTotal) * 100).toFixed(2))
    : undefined;

  const simulationInput: DecisionEvaluationInput = {
    holdingName: activeSimulatorHolding.name,
    thesisStatus: simThesisStatus,
    evidenceQuality: simEvidenceQuality,
    priceDrawdownPercent: simPriceDrawdown,
    allocationDriftPercent: simAllocationDrift,
    valuationFavorable: simValuationFavorable,
    valuationAssessment: {
      isFavorable: simValuationFavorable,
      inputTimestamp: '2026-02-15T00:00:00Z',
      metricsCount: activeSimulatorHolding.metrics?.length || 2
    },
    portfolioBudgetAvailable: simPortfolioBudgetAvailable,
    riskAssessmentSupportsIncrease: true,
    verifiedMoatDestruction: simVerifiedMoatDestruction,
    traceableEvidenceIds: simHasTraceableEvidence ? activeSimulatorHolding.supportingEvidenceIds : [],
    evidenceVerificationStatus: 'simulated_demonstration',
    hasDocumentedRiskConcern: simHasRiskConcern,
    traceableRiskEvidenceIds: simHasRiskConcern
      ? (activeSimulatorHolding.counterevidenceIds?.length > 0 ? activeSimulatorHolding.counterevidenceIds : activeSimulatorHolding.supportingEvidenceIds)
      : [],
    structuralImpairmentRationale: activeSimulatorHolding.decision.rationale,
    executionMode: 'synthetic_simulation',
    allowSimulatedDemonstrationDraft: true,
    asOfDate: '2026-02-20'
  };

  const profitRealizationInput: ProfitRealizationEngineInput = {
    executionMode: 'synthetic_simulation',
    holdingId: activeSimulatorHolding.id,
    holdingName: activeSimulatorHolding.name,
    assetCategory: activeSimulatorHolding.category,
    currentMarketValue,
    costBasisTotal,
    unrealizedGainCurrency,
    unrealizedGainPercent,
    currentPrice: activeSimulatorHolding.currentPrice,
    isFractionalSupported: true,
    portfolioTotalValue: Number(portfolioTotalValue.toFixed(2)),
    currentAllocationPercent: simulatedCurrentWeight,
    limitHierarchy: {
      strategicTarget: targetWeight,
      toleranceCeiling,
      userHardCeilingStatus: 'not_configured',
      externalCeilingStatus: 'not_applicable',
      effectiveHardCeiling: null,
      measurementBasis: 'percent_of_total_portfolio_nav'
    },
    thesisStatus: simThesisStatus,
    evidenceQuality: simEvidenceQuality,
    traceableEvidenceIds: simHasTraceableEvidence ? activeSimulatorHolding.supportingEvidenceIds : [],
    valuationFavorable: simValuationFavorable,
    valuationAssessmentTimestamp: '2026-02-15T00:00:00Z',
    valuationMetrics: activeSimulatorHolding.metrics,
    hasDocumentedRiskConcern: simHasRiskConcern,
    traceableRiskEvidenceIds: simHasRiskConcern
      ? (activeSimulatorHolding.counterevidenceIds?.length > 0 ? activeSimulatorHolding.counterevidenceIds : activeSimulatorHolding.supportingEvidenceIds)
      : [],
    costModel: {
      capitalGainsTaxRateEstimate: 0.20,
      transactionFeeEstimateRate: 0.001,
      estimatedSpreadRate: 0.0015,
      maxAllowableFrictionDragRatio: 0.35,
      minimumTransactionThreshold: 100.0,
      currency: activeSimulatorHolding.currency
    },
    reinvestmentCandidates: [],
    asOfDate: '2026-02-20'
  };

  const orchestrationInput: InvestmentOrchestratorInput = {
    evaluationId: `eval-sim-${activeSimulatorHolding.id}`,
    asOfDate: '2026-02-20',
    decisionInput: simulationInput,
    profitRealizationInput
  };

  const orchestrationResult: InvestmentOrchestratorResult | null = evaluateInvestmentOrchestration(orchestrationInput);

  const simResult = orchestrationResult?.coreDecision ?? null;
  const realizationResult = orchestrationResult?.profitRealization ?? null;
  const coordination = orchestrationResult?.coordination ?? null;

  // Determine explicit reliable currency for advisory profit-realization & reinvestment display
  const advisoryCurrency =
    activeSimulatorHolding?.currency && typeof activeSimulatorHolding.currency === 'string' && activeSimulatorHolding.currency.trim()
      ? activeSimulatorHolding.currency.trim()
      : (realizationResult?.suggestedAmount?.currency && typeof realizationResult.suggestedAmount.currency === 'string' && realizationResult.suggestedAmount.currency.trim())
      ? realizationResult.suggestedAmount.currency.trim()
      : null;

  const reinvestmentCurrency =
    realizationResult?.reinvestmentAssessment?.currency && typeof realizationResult.reinvestmentAssessment.currency === 'string' && realizationResult.reinvestmentAssessment.currency.trim()
      ? realizationResult.reinvestmentAssessment.currency.trim()
      : advisoryCurrency;

  const filteredHoldings = filterOutcome === 'all'
    ? holdings
    : holdings.filter(h => h.decision.outcome === filterOutcome);

  // Outcome statistics
  const outcomeCounts: Record<DecisionOutcome, number> = {
    HOLD: holdings.filter(h => h.decision.outcome === 'HOLD').length,
    INCREASE: holdings.filter(h => h.decision.outcome === 'INCREASE').length,
    REDUCE: holdings.filter(h => h.decision.outcome === 'REDUCE').length,
    SELL: holdings.filter(h => h.decision.outcome === 'SELL').length,
    INSUFFICIENT_EVIDENCE: holdings.filter(h => h.decision.outcome === 'INSUFFICIENT_EVIDENCE').length
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header & Framework Intro */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
        <div className="max-w-4xl space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <Compass className="w-4 h-4" />
            <span>Fiduciary Decision Framework</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Systematic Decision Review & Governance
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Every position in the portfolio is evaluated against 5 immutable outcomes. Emotional reactions to market price fluctuations are explicitly blocked by rule.
          </p>
        </div>

        {/* 5-Outcome Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6">
          <button
            onClick={() => setFilterOutcome('HOLD')}
            className={`p-3 rounded border text-left transition-colors ${
              filterOutcome === 'HOLD'
                ? 'border-slate-500 bg-slate-800 text-white'
                : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'
            }`}
          >
            <div className="text-[11px] font-mono text-slate-400">DEFAULT OUTCOME</div>
            <div className="text-base font-bold font-mono text-white mt-0.5">HOLD</div>
            <div className="text-xs text-slate-400 mt-1 font-mono">{outcomeCounts.HOLD} Positions</div>
          </button>

          <button
            onClick={() => setFilterOutcome('INCREASE')}
            className={`p-3 rounded border text-left transition-colors ${
              filterOutcome === 'INCREASE'
                ? 'border-emerald-500 bg-emerald-950/40 text-white'
                : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'
            }`}
          >
            <div className="text-[11px] font-mono text-emerald-400">TRIPLE TEST</div>
            <div className="text-base font-bold font-mono text-emerald-300 mt-0.5">INCREASE</div>
            <div className="text-xs text-slate-400 mt-1 font-mono">{outcomeCounts.INCREASE} Positions</div>
          </button>

          <button
            onClick={() => setFilterOutcome('REDUCE')}
            className={`p-3 rounded border text-left transition-colors ${
              filterOutcome === 'REDUCE'
                ? 'border-amber-500 bg-amber-950/40 text-white'
                : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'
            }`}
          >
            <div className="text-[11px] font-mono text-amber-400">REBALANCE TRIM</div>
            <div className="text-base font-bold font-mono text-amber-300 mt-0.5">REDUCE</div>
            <div className="text-xs text-slate-400 mt-1 font-mono">{outcomeCounts.REDUCE} Positions</div>
          </button>

          <button
            onClick={() => setFilterOutcome('SELL')}
            className={`p-3 rounded border text-left transition-colors ${
              filterOutcome === 'SELL'
                ? 'border-rose-500 bg-rose-950/40 text-white'
                : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'
            }`}
          >
            <div className="text-[11px] font-mono text-rose-400">MOAT DESTROYED</div>
            <div className="text-base font-bold font-mono text-rose-300 mt-0.5">SELL</div>
            <div className="text-xs text-slate-400 mt-1 font-mono">{outcomeCounts.SELL} Positions</div>
          </button>

          <button
            onClick={() => setFilterOutcome('INSUFFICIENT_EVIDENCE')}
            className={`p-3 rounded border text-left transition-colors ${
              filterOutcome === 'INSUFFICIENT_EVIDENCE'
                ? 'border-purple-500 bg-purple-950/40 text-white'
                : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'
            }`}
          >
            <div className="text-[11px] font-mono text-purple-400">DATA GAP GUARD</div>
            <div className="text-base font-bold font-mono text-purple-300 mt-0.5">INSUFFICIENT</div>
            <div className="text-xs text-slate-400 mt-1 font-mono">{outcomeCounts.INSUFFICIENT_EVIDENCE} Positions</div>
          </button>
        </div>

        {filterOutcome !== 'all' && (
          <div className="mt-3 flex items-center justify-end">
            <button
              onClick={() => setFilterOutcome('all')}
              className="text-xs text-slate-400 hover:text-white underline"
            >
              Show all outcomes ({holdings.length})
            </button>
          </div>
        )}
      </div>

      {/* Decision Cards List */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">
            Position Decision Dossiers ({filteredHoldings.length})
          </h2>
          <div className="text-xs text-slate-400">
            Click "Load in Rule Simulator" to test stress scenarios
          </div>
        </div>

        <div className="space-y-6">
          {filteredHoldings.map(h => {
            const isHold = h.decision.outcome === 'HOLD';
            const isIncrease = h.decision.outcome === 'INCREASE';
            const isReduce = h.decision.outcome === 'REDUCE';
            const isSell = h.decision.outcome === 'SELL';
            const isInsufficient = h.decision.outcome === 'INSUFFICIENT_EVIDENCE';

            return (
              <div
                key={h.id}
                className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 space-y-5"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg font-bold text-white">{h.ticker}</span>
                      <span className="text-slate-400 text-sm">·</span>
                      <span className="text-slate-300 font-medium text-sm">{h.name}</span>
                      <span className="text-slate-500 text-xs capitalize">({h.category.replace('_', ' ')})</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Reviewed: <span className="font-mono text-slate-300">{h.decision.lastReviewedDate}</span> · Next Audit: <span className="font-mono text-slate-300">{h.decision.nextScheduledReviewDate}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`px-3 py-1.5 rounded font-mono font-bold text-xs tracking-wider uppercase ${
                      isHold ? 'bg-slate-800 text-slate-100 border border-slate-700' :
                      isIncrease ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' :
                      isReduce ? 'bg-amber-950 text-amber-300 border border-amber-700' :
                      isSell ? 'bg-rose-950 text-rose-300 border border-rose-700' :
                      'bg-purple-950 text-purple-300 border border-purple-700'
                    }`}>
                      {h.decision.outcome}
                    </span>

                    <button
                      onClick={() => handleLoadHoldingIntoSimulator(h)}
                      className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 flex items-center gap-1 transition-colors"
                      title="Test this holding in the interactive rule simulator"
                    >
                      <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Simulate Rules</span>
                    </button>
                  </div>
                </div>

                {/* Core Rationale */}
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Governing Rationale
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed bg-slate-900/80 p-4 rounded border border-slate-800">
                    {h.decision.rationale}
                  </p>
                </div>

                {/* Evidence & Counterarguments Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Supporting Evidence */}
                  <div className="rounded border border-slate-800 bg-slate-900/60 p-4 space-y-2">
                    <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Supporting Evidence
                    </div>
                    <ul className="space-y-1.5 text-xs text-slate-300 list-disc pl-4 font-sans">
                      {h.decision.supportingEvidenceSummary.map((item, idx) => (
                        <li key={idx} className="leading-relaxed">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Counterarguments & Risks */}
                  <div className="rounded border border-slate-800 bg-slate-900/60 p-4 space-y-2">
                    <div className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Counterarguments & Residual Risks
                    </div>
                    <ul className="space-y-1.5 text-xs text-slate-300 list-disc pl-4 font-sans">
                      {h.decision.counterarguments.map((item, idx) => (
                        <li key={idx} className="leading-relaxed">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Uncertainty & Changing Conditions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 rounded border border-slate-800/80 bg-slate-900/30 space-y-1">
                    <div className="text-slate-400 font-semibold flex items-center gap-2">
                      <span>Uncertainty Assessment:</span>
                      <span className={`font-mono font-bold ${
                        h.decision.uncertaintyLevel === 'LOW' ? 'text-emerald-400' :
                        h.decision.uncertaintyLevel === 'MODERATE' ? 'text-amber-400' :
                        'text-rose-400'
                      }`}>
                        {h.decision.uncertaintyLevel}
                      </span>
                    </div>
                    <p className="text-slate-400 leading-relaxed">
                      {h.decision.uncertaintyExplanation}
                    </p>
                  </div>

                  <div className="p-3 rounded border border-slate-800/80 bg-slate-900/30 space-y-1">
                    <div className="text-slate-400 font-semibold">Conditions That Would Change Decision</div>
                    <ul className="space-y-1 text-slate-300 list-disc pl-4">
                      {h.decision.conditionsForChange.map((cond, idx) => (
                        <li key={idx} className="leading-relaxed">
                          {cond}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Rule Compliance Proof Strip */}
                <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="flex items-center gap-1 text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Rule 1 (Default Hold)
                    </span>
                    <span className="flex items-center gap-1 text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Rule 2 (Price Drop Alone ≠ Sell)
                    </span>
                    <span className="flex items-center gap-1 text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Rule 3 (Drift Alone ≠ Sell)
                    </span>
                    <span className="flex items-center gap-1 text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Rule 6 (Evidence Sufficiency)
                    </span>
                  </div>

                  <button
                    onClick={() => onSelectHoldingForResearch(h.id)}
                    className="text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
                  >
                    <span>View Primary Research Dossier</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Decision Rule Protocol Simulator */}
      <div className="rounded-lg border border-emerald-900/50 bg-slate-900/70 p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <Scale className="w-4 h-4" />
              <span>Interactive Rule Verification Engine</span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">
              Stress-Test Rules Against Hypothetical Conditions
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Demonstrate how the engine prevents irrational emotional behaviors (e.g. panic selling on a 50% price drop or forcing a guess when evidence is missing).
            </p>
          </div>

          <button
            onClick={() => handleLoadHoldingIntoSimulator(activeSimulatorHolding)}
            className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 rounded border border-slate-700 flex items-center gap-1.5 self-start shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Baseline</span>
          </button>
        </div>

        {/* Simulator Controls & Output Split */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          {/* Controls Column */}
          <div className="space-y-4 rounded-md border border-slate-800 bg-slate-950/60 p-4 text-xs">
            <div className="font-semibold text-slate-200 border-b border-slate-800 pb-2">
              Hypothetical Market & Research Conditions for: <span className="text-emerald-400 font-mono">{activeSimulatorHolding.ticker}</span>
            </div>

            {/* Condition 1: Thesis Status */}
            <div>
              <label className="block text-slate-400 font-medium mb-1">
                Core Long-Term Thesis Status:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    setSimThesisStatus('intact');
                    setSimVerifiedMoatDestruction(false);
                  }}
                  className={`py-1.5 px-2 rounded border font-medium ${
                    simThesisStatus === 'intact'
                      ? 'border-emerald-500 bg-emerald-950/50 text-white'
                      : 'border-slate-800 bg-slate-900 text-slate-400'
                  }`}
                >
                  Intact & Solvent
                </button>
                <button
                  onClick={() => setSimThesisStatus('questionable')}
                  className={`py-1.5 px-2 rounded border font-medium ${
                    simThesisStatus === 'questionable'
                      ? 'border-amber-500 bg-amber-950/50 text-white'
                      : 'border-slate-800 bg-slate-900 text-slate-400'
                  }`}
                >
                  Questionable
                </button>
                <button
                  onClick={() => {
                    setSimThesisStatus('materially_invalidated');
                    setSimVerifiedMoatDestruction(true);
                  }}
                  className={`py-1.5 px-2 rounded border font-medium ${
                    simThesisStatus === 'materially_invalidated'
                      ? 'border-rose-500 bg-rose-950/50 text-white'
                      : 'border-slate-800 bg-slate-900 text-slate-400'
                  }`}
                >
                  Invalidated Moat
                </button>
              </div>
            </div>

            {/* Condition 2: Evidence Freshness & Quality */}
            <div>
              <label className="block text-slate-400 font-medium mb-1">
                Statutory Evidence Quality:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSimEvidenceQuality('verified_fresh')}
                  className={`py-1.5 px-2 rounded border font-medium ${
                    simEvidenceQuality === 'verified_fresh'
                      ? 'border-emerald-500 bg-emerald-950/50 text-white'
                      : 'border-slate-800 bg-slate-900 text-slate-400'
                  }`}
                >
                  Fresh & Audited
                </button>
                <button
                  onClick={() => setSimEvidenceQuality('stale_or_missing')}
                  className={`py-1.5 px-2 rounded border font-medium ${
                    simEvidenceQuality === 'stale_or_missing'
                      ? 'border-purple-500 bg-purple-950/50 text-white'
                      : 'border-slate-800 bg-slate-900 text-slate-400'
                  }`}
                >
                  Stale (&gt;140d) / Missing
                </button>
              </div>
            </div>

            {/* Condition 3: Price Drawdown Slider */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-slate-300 font-medium">
                <span>Simulated Market Price Drawdown:</span>
                <span className={`font-mono font-bold ${simPriceDrawdown < -20 ? 'text-rose-400' : 'text-slate-300'}`}>
                  {simPriceDrawdown}%
                  {activeSimulatorHolding.costBasis === null && simPriceDrawdown === 0 && (
                    <span className="text-[10px] text-slate-500 font-normal ml-1.5 font-sans">
                      (Baseline · Basis Untracked)
                    </span>
                  )}
                </span>
              </div>
              <input
                type="range"
                min="-75"
                max="25"
                step="5"
                value={simPriceDrawdown}
                onChange={(e) => setSimPriceDrawdown(parseInt(e.target.value))}
                className="w-full accent-emerald-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>-75% Crash</span>
                <span>0% Par</span>
                <span>+25% Rally</span>
              </div>
            </div>

            {/* Condition 3b: Allocation Drift Slider (25% Relative Tolerance Benchmark) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-slate-300 font-medium">
                <span>Simulated Allocation Drift (Target {targetWeight.toFixed(1)}%):</span>
                <span className={`font-mono font-bold ${simAllocationDrift > (targetWeight * 0.25) ? 'text-amber-400' : 'text-slate-300'}`}>
                  {simAllocationDrift >= 0 ? `+${simAllocationDrift.toFixed(1)}` : simAllocationDrift.toFixed(1)}% (Curr: {simulatedCurrentWeight.toFixed(1)}%)
                </span>
              </div>
              <input
                type="range"
                min="-10"
                max="20"
                step="0.5"
                value={simAllocationDrift}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setSimAllocationDrift(val);
                  setSimPortfolioBudgetAvailable(val < 0);
                }}
                className="w-full accent-emerald-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>-10% Underweight</span>
                <span>0% Target ({targetWeight.toFixed(1)}%)</span>
                <span>+20% Overweight (Tolerance Ceiling: {toleranceCeiling.toFixed(1)}%)</span>
              </div>
            </div>

            {/* Condition 4: Valuation & Portfolio Budget Toggles */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={simValuationFavorable}
                  onChange={(e) => setSimValuationFavorable(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0"
                />
                <span>Valuation Favorable (Cheap)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={simPortfolioBudgetAvailable}
                  onChange={(e) => setSimPortfolioBudgetAvailable(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0"
                />
                <span>Under Target Weight (Room to Add)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={simHasTraceableEvidence}
                  onChange={(e) => setSimHasTraceableEvidence(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0"
                />
                <span>Traceable Evidence Linked (Safeguard 7)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={simHasRiskConcern}
                  onChange={(e) => setSimHasRiskConcern(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0"
                />
                <span>Documented Risk Concern (Safeguard 2)</span>
              </label>
            </div>
          </div>

          {/* Engine Output Column */}
          <div className="rounded-md border border-slate-800 bg-slate-950/60 p-4 space-y-4">
            {!simResult ? (
              <div className="rounded-md border border-rose-900/50 bg-rose-950/20 p-5 space-y-3">
                <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                  <AlertOctagon className="w-4 h-4" />
                  <span>Orchestrated Decision Unavailable</span>
                </div>
                <p className="text-xs text-rose-200 leading-relaxed">
                  The coordinated multi-engine evaluation could not be completed for {activeSimulatorHolding.name}.
                  Automated fallback is strictly blocked to maintain engine coordination integrity.
                </p>
                {coordination?.errors && coordination.errors.length > 0 && (
                  <ul className="text-xs text-rose-300 list-disc pl-4 space-y-1">
                    {coordination.errors.map((err, idx) => (
                      <li key={idx}>[{err.engine}] {err.message}</li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <>
                {/* Header & Primary Core Decision Badge */}
                <div className="border-b border-slate-800 pb-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-400">Deterministic Coordinated Engine Output</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        SYNTHETIC DEMONSTRATION DATA
                      </span>
                    </div>
                    <span className={`px-2.5 py-1 rounded font-mono font-bold text-xs uppercase ${
                      simResult.outcome === 'HOLD' ? 'bg-slate-800 text-white' :
                      simResult.outcome === 'INCREASE' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                      simResult.outcome === 'SELL' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                      simResult.outcome === 'INSUFFICIENT_EVIDENCE' ? 'bg-purple-950 text-purple-300 border border-purple-800' :
                      'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}>
                      {simResult.outcome}
                    </span>
                  </div>

                  {/* Coordinated Precedence & Relationship Indicators */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-mono">
                    <span className={`px-2 py-0.5 rounded border ${
                      coordination?.precedenceApplied
                        ? 'bg-amber-950/40 text-amber-300 border-amber-700/60'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}>
                      Precedence: {coordination?.precedenceApplied ? `Core ${simResult.outcome} Governs Portfolio Action` : 'Core Outcome Primary'}
                    </span>
                    {coordination?.decisionComparison && (
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                        Relationship: {coordination.decisionComparison.relationship.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>

                  {coordination?.warnings && coordination.warnings.length > 0 && (
                    <div className="text-[11px] text-amber-400/90 bg-amber-950/20 p-2 rounded border border-amber-900/40 space-y-0.5">
                      {coordination.warnings.map((w, idx) => (
                        <div key={idx}>⚠️ {w}</div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Primary Rationale */}
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-slate-400">Core Decision Rationale:</div>
                  <p className="text-xs text-slate-200 leading-relaxed bg-slate-900 p-3 rounded border border-slate-800">
                    {simResult.primaryRationale}
                  </p>
                </div>

                {/* Missing Data Reasons & Reassessment Requirements */}
                {simResult.missingDataReasons && simResult.missingDataReasons.length > 0 && (
                  <div className="rounded border border-purple-900/50 bg-purple-950/20 p-3 space-y-2">
                    <div className="text-xs font-semibold text-purple-300">
                      Missing Data Identified:
                    </div>
                    <ul className="text-xs text-purple-200/90 list-disc pl-4 space-y-1">
                      {simResult.missingDataReasons.map((reason, idx) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>
                    {simResult.reassessmentRequirements && (
                      <div className="pt-1.5 border-t border-purple-900/40 text-xs text-slate-400">
                        <span className="font-semibold text-purple-300">Evidence Needed to Reassess: </span>
                        {simResult.reassessmentRequirements.join(' ')}
                      </div>
                    )}
                  </div>
                )}

                {/* Behavioral Violations Prevented */}
                {simResult.violationsPrevented.length > 0 && (
                  <div className="rounded border border-amber-900/50 bg-amber-950/20 p-3 space-y-1">
                    <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                      Emotional Error Prevented by Code:
                    </div>
                    {simResult.violationsPrevented.map((v, idx) => (
                      <p key={idx} className="text-xs text-amber-200/90 leading-relaxed font-sans">
                        {v}
                      </p>
                    ))}
                  </div>
                )}

                {/* Rules Applied */}
                <div className="space-y-1.5 text-xs">
                  <div className="text-[11px] font-semibold text-slate-400">Applied Principles:</div>
                  {simResult.appliedRules.map(r => (
                    <div key={r.ruleNumber} className="flex items-start gap-2 text-slate-300">
                      <span className="font-mono text-emerald-400 font-bold shrink-0">Rule {r.ruleNumber}:</span>
                      <span>{r.description}</span>
                    </div>
                  ))}
                </div>

                {/* Recommended Action */}
                <div className="pt-2 border-t border-slate-800 text-xs">
                  <span className="text-slate-400 font-medium">Stewardship Action: </span>
                  <span className="text-white font-medium">{simResult.recommendedAction}</span>
                </div>

                {/* Secondary Advisory Section: Profit Realization & Rebalancing */}
                <div className="rounded-md border-2 border-dashed border-slate-700 bg-slate-900/60 p-4 space-y-4 mt-4">
                  {/* Section Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                        Advisory Profit Realization & Rebalancing Guidance
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800">
                        NON-BINDING ADVISORY ONLY
                      </span>
                      {realizationResult && (
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase border ${
                          realizationResult.realizationAssessment === 'CONSIDER_PARTIAL_REALIZATION'
                            ? 'bg-amber-950/80 text-amber-300 border-amber-700'
                            : realizationResult.realizationAssessment === 'NO_ACTION'
                            ? 'bg-slate-800 text-slate-300 border-slate-700'
                            : realizationResult.realizationAssessment === 'YIELD_TO_RISK_REDUCTION'
                            ? 'bg-rose-950/80 text-rose-300 border-rose-700'
                            : 'bg-purple-950/80 text-purple-300 border-purple-700'
                        }`}>
                          {realizationResult.realizationAssessment.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Realization Rationale */}
                  {realizationResult && (
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-slate-400">Realization Assessment Rationale:</div>
                      <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/80 p-3 rounded border border-slate-800/80">
                        {realizationResult.realizationRationale}
                      </p>
                    </div>
                  )}

                  {/* Allocation Tolerance Ceiling Metrics */}
                  <div className="rounded bg-slate-950/50 p-3 border border-slate-800 space-y-2 text-xs">
                    <div className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                      <span>Allocation & Relative Tolerance Framework</span>
                      <span className="font-mono text-[10px] text-slate-400">Rule 3 Protected</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center font-mono">
                      <div className="p-2 rounded bg-slate-900 border border-slate-800">
                        <div className="text-[10px] text-slate-500 uppercase">Target</div>
                        <div className="text-slate-200 font-bold mt-0.5">{targetWeight.toFixed(1)}%</div>
                      </div>
                      <div className="p-2 rounded bg-slate-900 border border-slate-800">
                        <div className="text-[10px] text-amber-400 uppercase">Tolerance Ceiling (+25%)</div>
                        <div className="text-amber-300 font-bold mt-0.5">{toleranceCeiling.toFixed(1)}%</div>
                      </div>
                      <div className="p-2 rounded bg-slate-900 border border-slate-800">
                        <div className="text-[10px] text-slate-500 uppercase">Simulated Current</div>
                        <div className={`font-bold mt-0.5 ${simulatedCurrentWeight > toleranceCeiling ? 'text-amber-400' : 'text-slate-200'}`}>
                          {simulatedCurrentWeight.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-normal italic">
                      Notice: The relative tolerance ceiling (25% above strategic target) serves strictly as a discretionary review threshold — never an automatic sell trigger. Rule 3 (Drift Alone ≠ Sell) is strictly preserved.
                    </p>
                  </div>

                  {/* Sizing & Friction Drag Analysis */}
                  {realizationResult?.suggestedAmount && (
                    <div className="rounded bg-slate-950/50 p-3 border border-slate-800 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-300">
                          Discretionary Trim Sizing & Friction Drag Analysis
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">
                          Amount Type: {realizationResult.suggestedAmount.amountType} · Currency: {advisoryCurrency ?? 'Currency unspecified'}
                        </span>
                      </div>

                      {realizationResult.suggestedAmount.suggestedGrossCapitalValue !== null && realizationResult.suggestedAmount.suggestedGrossCapitalValue > 0 ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-center">
                            <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                              <div className="text-[10px] text-slate-500">Gross Trim Value</div>
                              <div className="text-slate-200 font-bold">
                                {formatCurrencyAmount(realizationResult.suggestedAmount.suggestedGrossCapitalValue, advisoryCurrency)}
                              </div>
                            </div>
                            <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                              <div className="text-[10px] text-slate-500">Suggested Prop.</div>
                              <div className="text-slate-200 font-bold">
                                {(realizationResult.suggestedAmount.suggestedProportionOfHolding * 100).toFixed(1)}%
                              </div>
                            </div>
                            <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                              <div className="text-[10px] text-slate-500">Total Friction</div>
                              <div className="text-amber-300 font-bold">
                                {formatCurrencyAmount(realizationResult.suggestedAmount.frictionBreakdown?.totalFrictionCosts, advisoryCurrency)}
                              </div>
                            </div>
                            <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                              <div className="text-[10px] text-slate-500">Net Proceeds</div>
                              <div className="text-emerald-300 font-bold">
                                {formatCurrencyAmount(realizationResult.suggestedAmount.frictionBreakdown?.estimatedNetProceeds, advisoryCurrency)}
                              </div>
                            </div>
                          </div>

                          {/* Detailed Friction Itemization */}
                          {realizationResult.suggestedAmount.frictionBreakdown && (
                            <div className="rounded border border-slate-800/80 bg-slate-900/70 p-2.5 space-y-1.5 text-[11px]">
                              <div className="flex justify-between text-slate-400">
                                <span>Allocated Cost Basis:</span>
                                <span className="font-mono text-slate-300">{formatCurrencyAmount(realizationResult.suggestedAmount.frictionBreakdown.allocatedCostBasis, advisoryCurrency)}</span>
                              </div>
                              <div className="flex justify-between text-slate-400">
                                <span>Gross Realized Capital Gain:</span>
                                <span className="font-mono text-slate-300">{formatCurrencyAmount(realizationResult.suggestedAmount.frictionBreakdown.grossRealizedCapitalGain, advisoryCurrency)}</span>
                              </div>
                              <div className="flex justify-between text-amber-300/90 font-medium">
                                <span>Capital Gains Tax:</span>
                                <span className="font-mono">{formatCurrencyAmount(realizationResult.suggestedAmount.frictionBreakdown.estimatedCapitalGainsTax, advisoryCurrency)}</span>
                              </div>
                              <div className="text-[10px] text-amber-400 font-mono bg-amber-950/40 px-2 py-0.5 rounded border border-amber-900/60">
                                Synthetic Model Assumption: 20.0% — Unverified · Not Tax Advice
                              </div>
                              <div className="flex justify-between text-slate-400">
                                <span>Estimated Commission (0.10%):</span>
                                <span className="font-mono text-slate-300">{formatCurrencyAmount(realizationResult.suggestedAmount.frictionBreakdown.estimatedCommissionCosts, advisoryCurrency)}</span>
                              </div>
                              <div className="flex justify-between text-slate-400">
                                <span>Estimated Bid-Ask Spread (0.15%):</span>
                                <span className="font-mono text-slate-300">{formatCurrencyAmount(realizationResult.suggestedAmount.frictionBreakdown.estimatedSpreadCosts, advisoryCurrency)}</span>
                              </div>
                              <div className="pt-1 border-t border-slate-800 flex justify-between font-mono text-xs">
                                <span className="text-slate-300 font-sans">Friction Drag Ratio:</span>
                                <span className={realizationResult.suggestedAmount.frictionBreakdown.frictionToGainDragRatio > 0.35 ? 'text-rose-400' : 'text-emerald-400'}>
                                  {(realizationResult.suggestedAmount.frictionBreakdown.frictionToGainDragRatio * 100).toFixed(2)}% (Max Threshold: 35.0%)
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800 text-slate-400 text-xs">
                          No capital trim suggested under current parameters (amount type: {realizationResult.suggestedAmount.amountType}).
                          <div className="text-[10px] text-amber-400 font-mono mt-1">
                            Synthetic Model Assumption: 20.0% — Unverified · Not Tax Advice
                          </div>
                        </div>
                      )}

                      <p className="text-[10px] text-slate-500 leading-normal">
                        Tax, friction, and net proceeds are illustrative model estimates based on synthetic assumptions, not confirmed net proceeds or professional tax advice.
                      </p>
                    </div>
                  )}

                  {/* Reinvestment & Candidate Universe Stewardship */}
                  {realizationResult?.reinvestmentAssessment && (
                    <div className="rounded bg-slate-950/50 p-3 border border-slate-800 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-300">
                          Reinvestment Assessment & Proceeds Conservation
                        </span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {realizationResult.reinvestmentAssessment.action}
                        </span>
                      </div>
                      <p className="text-slate-300 leading-relaxed text-xs">
                        {realizationResult.reinvestmentAssessment.rationale}
                      </p>
                      <div className="text-[11px] text-slate-400 p-2 rounded bg-slate-900 border border-slate-800 space-y-1">
                        <div className="flex justify-between font-mono">
                          <span>Net Proceeds Retained as Cash:</span>
                          <span className="text-emerald-400 font-bold">
                            {formatCurrencyAmount(realizationResult.reinvestmentAssessment.unallocatedNetProceedsToCash, reinvestmentCurrency)}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 italic">
                          Candidate universe conservation: Unverified candidates are excluded without fabrication; 100% of net proceeds are retained in cash (HOLD_AS_CASH).
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Strict Safeguard Banner */}
                  <div className="rounded border border-amber-500/40 bg-amber-950/30 p-2.5 text-center">
                    <div className="text-[11px] font-mono font-bold text-amber-300 tracking-wider">
                      AUTOMATED TRADE EXECUTION STRICTLY BLOCKED · NON-CUSTODIAL HUMAN DECISION SUPPORT
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
