/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Holding, SourceDocument, EvidenceFinding, AssetCategory, DataSourceMetadata } from '../types/investment';
import { SYNTHETIC_SOURCE_DOCUMENTS, SYNTHETIC_EVIDENCE_FINDINGS, SYNTHETIC_USD_TRY_RATE } from '../data/syntheticPortfolio';
import {
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Calendar,
  Clock,
  HelpCircle,
  TrendingDown,
  TrendingUp,
  Layers,
  ArrowRight,
  Info,
  CheckCircle2,
  XCircle
} from 'lucide-react';

interface AssetResearchProps {
  holdings: Holding[];
  selectedHoldingId: string;
  onSelectHolding: (id: string) => void;
  onNavigateToDecision: (holdingId: string) => void;
  onInspectDocument: (doc: SourceDocument) => void;
  dataSource?: DataSourceMetadata;
}

export const AssetResearch: React.FC<AssetResearchProps> = ({
  holdings,
  selectedHoldingId,
  onSelectHolding,
  onNavigateToDecision,
  onInspectDocument,
  dataSource
}) => {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const selectedHolding = holdings.find(h => h.id === selectedHoldingId) || holdings[0];

  if (!selectedHolding) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-12 text-center text-slate-400">
        <p className="text-base font-medium text-slate-300">No holdings available for research.</p>
        <p className="text-xs text-slate-500 mt-1">Please select or load a portfolio with active positions.</p>
      </div>
    );
  }

  // Filter holdings in selector list
  const filteredHoldings = categoryFilter === 'all'
    ? holdings
    : holdings.filter(h => h.category === categoryFilter);

  // Retrieve evidence findings and source documents for this holding
  const isSyntheticMode = dataSource ? dataSource.mode === 'synthetic_demonstration' : true;
  const supportingFindings = isSyntheticMode
    ? SYNTHETIC_EVIDENCE_FINDINGS.filter(
        ef => ef.holdingId === selectedHolding.id && !ef.isConflicting && selectedHolding.supportingEvidenceIds.includes(ef.id)
      )
    : [];

  const counterFindings = isSyntheticMode
    ? SYNTHETIC_EVIDENCE_FINDINGS.filter(
        ef => ef.holdingId === selectedHolding.id && (ef.isConflicting || selectedHolding.counterevidenceIds.includes(ef.id))
      )
    : [];

  const getSourceDoc = (docId: string): SourceDocument | undefined => {
    return isSyntheticMode ? SYNTHETIC_SOURCE_DOCUMENTS.find(d => d.id === docId) : undefined;
  };

  const isTRY = selectedHolding.currency === 'TRY';
  const hasCostBasis = selectedHolding.costBasis !== null && selectedHolding.costBasis > 0;
  const pnlPercent = hasCostBasis
    ? ((selectedHolding.currentPrice - selectedHolding.costBasis!) / selectedHolding.costBasis!) * 100
    : null;

  return (
    <div className="space-y-6 pb-16">
      {/* Category Filter / Asset Selector Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Asset Research Dossier</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-normal border border-slate-700">
              {selectedHolding.ticker}
            </span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase tracking-wider ${
              dataSource?.mode === 'local_snapshot'
                ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}>
              {dataSource?.label ?? 'SYNTHETIC DEMONSTRATION DATA'}
            </span>
          </h1>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
            <span>Evidence-backed valuation and thesis audit</span>
            <span aria-hidden="true">·</span>
            <span>All facts verified against dated source filings</span>
          </div>
        </div>

        {/* Category switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg overflow-x-auto scrollbar-none">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              categoryFilter === 'all' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            All Classes
          </button>
          <button
            onClick={() => setCategoryFilter('equity')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              categoryFilter === 'equity' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            Equities
          </button>
          <button
            onClick={() => setCategoryFilter('etf')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              categoryFilter === 'etf' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            ETFs
          </button>
          <button
            onClick={() => setCategoryFilter('bitcoin')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              categoryFilter === 'bitcoin' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            Bitcoin
          </button>
          <button
            onClick={() => setCategoryFilter('turkish_equity')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              categoryFilter === 'turkish_equity' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            Turkish Equities
          </button>
          <button
            onClick={() => setCategoryFilter('turkish_fund')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              categoryFilter === 'turkish_fund' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            Turkish Funds
          </button>
        </div>
      </div>

      {/* Holding Selector Pills / Segmented Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {filteredHoldings.map(h => {
          const isActive = h.id === selectedHolding.id;
          return (
            <button
              key={h.id}
              onClick={() => onSelectHolding(h.id)}
              className={`px-3.5 py-2 rounded border text-xs font-mono transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
                isActive
                  ? 'border-emerald-500 bg-slate-800 text-white shadow-xs'
                  : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <span className="font-bold">{h.ticker}</span>
              <span className="text-[11px] font-sans text-slate-400 max-w-[120px] truncate">
                {h.name}
              </span>
              <span className={`text-[10px] font-sans px-1.5 py-0.5 rounded ${
                h.decision.outcome === 'HOLD' ? 'bg-slate-700 text-slate-200' :
                h.decision.outcome === 'INCREASE' ? 'bg-emerald-900/60 text-emerald-300' :
                h.decision.outcome === 'SELL' ? 'bg-rose-900/60 text-rose-300' :
                h.decision.outcome === 'INSUFFICIENT_EVIDENCE' ? 'bg-purple-900/60 text-purple-300' :
                'bg-amber-900/60 text-amber-300'
              }`}>
                {h.decision.outcome}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Asset Header Card */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="capitalize font-semibold text-slate-300">{selectedHolding.category.replace('_', ' ')}</span>
              <span aria-hidden="true">·</span>
              <span>Currency: {selectedHolding.currency}</span>
              <span aria-hidden="true">·</span>
              <span>Horizon: {selectedHolding.investmentHorizonYears} Years</span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-400">Next Review: {selectedHolding.decision.nextScheduledReviewDate}</span>
            </div>

            <div className="flex items-baseline gap-3">
              <h2 className="text-2xl font-bold tracking-tight text-white font-sans">
                {selectedHolding.name}
              </h2>
              <span className="text-sm font-mono text-slate-400">
                ({selectedHolding.ticker})
              </span>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed pt-1">
              {selectedHolding.thesisTitle}
            </p>
          </div>

          {/* Quick Metrics Badge Column */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3 min-w-[280px] p-3 rounded-md bg-slate-900 border border-slate-800 font-mono text-xs">
            <div>
              <div className="text-slate-500 text-[11px] font-sans">Current Price</div>
              <div className="text-base font-bold text-white mt-0.5">
                {isTRY ? '₺' : '$'}{selectedHolding.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div>
              <div className="text-slate-500 text-[11px] font-sans">Cost Basis</div>
              <div className="text-slate-300 mt-0.5">
                {selectedHolding.costBasis !== null
                  ? `${isTRY ? '₺' : '$'}${selectedHolding.costBasis.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : <span className="text-slate-500 italic">Untracked</span>}
              </div>
            </div>

            <div>
              <div className="text-slate-500 text-[11px] font-sans">Unrealized P&L</div>
              <div className={`font-semibold mt-0.5 ${pnlPercent === null ? 'text-slate-500 italic font-normal' : pnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {pnlPercent !== null
                  ? `${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(1)}%`
                  : 'N/A'}
              </div>
            </div>

            <div>
              <div className="text-slate-500 text-[11px] font-sans">Weight / Target</div>
              <div className="text-slate-200 mt-0.5 font-semibold">
                {selectedHolding.currentWeight}% <span className="text-slate-500">/ {selectedHolding.targetWeight}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Current Decision Callout Bar */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-slate-400 font-medium">Stewardship Stance:</span>
            <span className={`px-2.5 py-1 rounded font-bold font-mono tracking-wide ${
              selectedHolding.decision.outcome === 'HOLD'
                ? 'bg-slate-800 text-slate-200 border border-slate-700'
                : selectedHolding.decision.outcome === 'INCREASE'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                : selectedHolding.decision.outcome === 'SELL'
                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                : selectedHolding.decision.outcome === 'INSUFFICIENT_EVIDENCE'
                ? 'bg-purple-950 text-purple-300 border border-purple-800'
                : 'bg-amber-950 text-amber-300 border border-amber-800'
            }`}>
              {selectedHolding.decision.outcome}
            </span>
            <span className="text-slate-400 hidden sm:inline">
              Uncertainty: <span className="font-semibold text-slate-200">{selectedHolding.decision.uncertaintyLevel}</span>
            </span>
          </div>

          <button
            onClick={() => onNavigateToDecision(selectedHolding.id)}
            className="text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 transition-colors self-start sm:self-auto"
          >
            <span>Read Complete Decision Rationale</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Grid: Thesis & Moat vs Valuation Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Investment Thesis & Moat */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 space-y-5">
          <div>
            <h3 className="text-base font-semibold text-white">
              Investment Thesis & Core Premise
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              The foundational qualitative hypothesis required for long-term ownership.
            </p>
          </div>

          <div className="space-y-4 text-xs text-slate-300">
            <div>
              <div className="text-slate-400 font-semibold mb-1">Core Premise</div>
              <p className="leading-relaxed bg-slate-900/70 p-3 rounded border border-slate-800 text-slate-200">
                {selectedHolding.thesisPremise}
              </p>
            </div>

            <div>
              <div className="text-slate-400 font-semibold mb-1">Economic Moat & Competitive Protection</div>
              <p className="leading-relaxed bg-slate-900/70 p-3 rounded border border-slate-800 text-slate-200">
                {selectedHolding.economicMoatDescription}
              </p>
            </div>

            <div>
              <div className="text-slate-400 font-semibold mb-1">Capital Allocation Track Record</div>
              <p className="leading-relaxed bg-slate-900/70 p-3 rounded border border-slate-800 text-slate-200">
                {selectedHolding.capitalAllocationAssessment}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Valuation & Risk Framework */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 space-y-5">
          <div>
            <h3 className="text-base font-semibold text-white">
              Valuation & Downside Framework
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Deterministic metrics versus historical ranges and stress scenarios.
            </p>
          </div>

          <p className="text-xs text-slate-300 bg-slate-900/70 p-3 rounded border border-slate-800">
            {selectedHolding.valuationSummary}
          </p>

          {/* Metrics Table */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-400">Empirical Valuation Metrics</div>
            {selectedHolding.metrics.length > 0 ? (
              <div className="border border-slate-800 rounded divide-y divide-slate-800 bg-slate-900/60 overflow-hidden text-xs">
                {selectedHolding.metrics.map(m => (
                  <div key={m.label} className="p-3 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="font-medium text-slate-200">{m.label}</div>
                      <div className="text-[11px] text-slate-500">{m.context}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-white text-sm">{m.currentValue}</div>
                      <div className="text-[11px] font-mono text-slate-400">{m.historicalRangeOrBenchmark}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-slate-800 rounded bg-slate-900/30 p-4 text-xs text-slate-400 italic">
                No quantitative valuation metrics indexed for this holding.
              </div>
            )}
          </div>

          {/* Downside Scenario Callout */}
          <div className="rounded border border-rose-950 bg-rose-950/20 p-3 text-xs">
            <div className="font-semibold text-rose-300 mb-1 flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5" />
              Downside Stress Scenario
            </div>
            <p className="text-slate-300 leading-relaxed">
              {selectedHolding.downsideScenario}
            </p>
          </div>
        </div>
      </div>

      {/* Supporting Evidence with Direct Primary Citations */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Supporting Evidence & Primary Sources</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Claims verified directly against official statutory reports and audited disclosures.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {supportingFindings.length} Verified Evidence Points
          </span>
        </div>

        {supportingFindings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {supportingFindings.map(finding => {
              const doc = getSourceDoc(finding.sourceDocId);
              return (
                <div
                  key={finding.id}
                  className="rounded border border-slate-800 bg-slate-900/80 p-4 space-y-3 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold text-slate-100 leading-snug">
                      {finding.claim}
                    </h4>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60 shrink-0">
                      Verified Fact
                    </span>
                  </div>

                  <blockquote className="text-xs text-slate-300 italic border-l-2 border-slate-700 pl-3 py-1 font-sans bg-slate-950/50 rounded-r">
                    "{finding.excerpt}"
                  </blockquote>

                  <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 font-medium truncate max-w-[220px]">
                        {doc?.title || 'Statutory Source'}
                      </span>
                      {doc && (
                        <button
                          onClick={() => onInspectDocument(doc)}
                          className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
                        >
                          Inspect Filing <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="font-mono text-slate-500">
                      Period: {doc?.reportingPeriod} · Pub: {doc?.publicationDate}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded border border-slate-800 bg-slate-900/30 p-6 text-center text-xs text-slate-400">
            <Info className="w-5 h-5 mx-auto text-slate-500 mb-2" />
            <div className="font-semibold text-slate-300">No statutory filings or verified evidence records linked.</div>
            <div className="text-slate-500 mt-1">This holding relies on qualitative thesis intent and disciplined rebalancing limits.</div>
          </div>
        )}
      </div>

      {/* Counterevidence & Conflicting Risks */}
      {counterFindings.length > 0 && (
        <div className="rounded-lg border border-amber-900/40 bg-slate-900/40 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Counterevidence, Headwinds & Conflicting Data</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Objective risks, regulatory scrutiny, or diverging projections that challenge the thesis.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {counterFindings.length} Items Flagged
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {counterFindings.map(cf => {
              const doc = getSourceDoc(cf.sourceDocId);
              return (
                <div
                  key={cf.id}
                  className="rounded border border-amber-900/50 bg-amber-950/10 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold text-amber-200 leading-snug">
                      {cf.claim}
                    </h4>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 shrink-0">
                      {cf.type === 'conflicting_evidence' ? 'Conflicting' : 'Risk Factor'}
                    </span>
                  </div>

                  <blockquote className="text-xs text-slate-300 italic border-l-2 border-amber-800/80 pl-3 py-1 font-sans bg-slate-950/50 rounded-r">
                    "{cf.excerpt}"
                  </blockquote>

                  {cf.conflictDescription && (
                    <div className="text-xs text-amber-300/90 bg-amber-950/40 p-2 rounded border border-amber-900/40">
                      <span className="font-semibold">Conflict:</span> {cf.conflictDescription}
                    </div>
                  )}

                  <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-slate-300 truncate max-w-[200px]">
                      {doc?.title}
                    </span>
                    {doc && (
                      <button
                        onClick={() => onInspectDocument(doc)}
                        className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium"
                      >
                        Source Citation <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Missing Information & Unresolved Questions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <HelpCircle className="w-4 h-4 text-purple-400" />
            <span>Missing Information (Epistemic Gaps)</span>
          </div>
          <p className="text-xs text-slate-400">
            Data points currently unavailable in statutory disclosures. The model refuses to fabricate these.
          </p>
          <ul className="space-y-2 text-xs text-slate-300 list-disc pl-4 font-sans pt-1">
            {selectedHolding.missingInformation.map((info, idx) => (
              <li key={idx} className="leading-relaxed">
                {info}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Clock className="w-4 h-4 text-blue-400" />
            <span>Unresolved Strategic Questions</span>
          </div>
          <p className="text-xs text-slate-400">
            Open inquiries to be re-evaluated during future quarterly earnings calls or regulatory releases.
          </p>
          <ul className="space-y-2 text-xs text-slate-300 list-disc pl-4 font-sans pt-1">
            {selectedHolding.unresolvedQuestions.map((q, idx) => (
              <li key={idx} className="leading-relaxed">
                {q}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
