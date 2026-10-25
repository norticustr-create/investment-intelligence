/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Holding, PortfolioSummary, DataSourceMetadata, SnapshotPurchaseRecommendation } from '../types/investment';
import { SYNTHETIC_USD_TRY_RATE } from '../data/syntheticPortfolio';
import { ArrowUpRight, ArrowDownRight, ArrowRight, AlertCircle, RefreshCw, Eye, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface PortfolioOverviewProps {
  holdings: Holding[];
  summary: PortfolioSummary;
  onSelectHolding: (holdingId: string) => void;
  onNavigateToDecisions: () => void;
  onNavigateToEvidence: () => void;
  dataSource?: DataSourceMetadata;
  purchaseRecommendations?: SnapshotPurchaseRecommendation[];
}

export const PortfolioOverview: React.FC<PortfolioOverviewProps> = ({
  holdings,
  summary,
  onSelectHolding,
  onNavigateToDecisions,
  onNavigateToEvidence,
  dataSource,
  purchaseRecommendations
}) => {
  const isRealMode = summary.reportingCurrency === 'TRY';
  const hasUSD = summary.totalValueUSD !== undefined;
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [displayCurrency, setDisplayCurrency] = useState<'USD' | 'TRY'>(isRealMode ? 'TRY' : 'USD');

  const formatCurrency = (valUSD?: number) => {
    if (isRealMode || displayCurrency === 'TRY') {
      return `₺${summary.totalValueTRY.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
    if (valUSD !== undefined) {
      return `$${valUSD.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
    return `₺${summary.totalValueTRY.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const reviewItems = holdings.filter(
    h => h.reviewStatus === 'review_required' || h.reviewStatus === 'insufficient_evidence'
  );

  const filteredHoldings = filterCategory === 'all'
    ? holdings
    : holdings.filter(h => h.category === filterCategory);

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner: Data Confirmation & Purpose */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-white">
                Portfolio Overview & Asset Allocation
              </h1>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase tracking-wider ${
                isRealMode
                  ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}>
                {dataSource?.label ?? (isRealMode ? 'LOCAL SNAPSHOT DATA' : 'SYNTHETIC DEMONSTRATION DATA')}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Long-term capital stewardship terminal. Portfolio holdings are evaluated strictly against dated primary filings, thesis integrity, and disciplined rebalancing thresholds.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {/* Currency Segmented Control */}
            <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-md">
              {hasUSD && (
                <button
                  onClick={() => setDisplayCurrency('USD')}
                  className={`px-3 py-1 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
                    displayCurrency === 'USD'
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  USD Basis ($)
                </button>
              )}
              <button
                onClick={() => setDisplayCurrency('TRY')}
                className={`px-3 py-1 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
                  displayCurrency === 'TRY' || !hasUSD
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                TRY Basis (₺)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Primary KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-xs text-slate-400">Total Portfolio Value</div>
          <div className="text-2xl font-bold font-mono tracking-tight text-white mt-1">
            {isRealMode
              ? `₺${summary.totalValueTRY.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
              : formatCurrency(summary.totalValueUSD)}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono">
            {summary.fxRateUSDTRY !== undefined
              ? `FX Reference: 1 USD = ${summary.fxRateUSDTRY.toFixed(2)} TRY`
              : 'Authoritative Currency: TRY (No external FX inferred)'}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-xs text-slate-400">Holdings Needing Review</div>
          <div className="text-2xl font-bold font-mono tracking-tight text-amber-400 mt-1 flex items-baseline gap-2">
            <span>{summary.reviewQueueCount}</span>
            <span className="text-xs font-normal text-slate-400">of {holdings.length} holdings</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Triggered by drift or evidence freshness
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-xs text-slate-400">Top 3 Concentration</div>
          <div className="text-2xl font-bold font-mono tracking-tight text-white mt-1">
            {summary.topHoldingsConcentration.top3}%
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Top 1 ({summary.topHoldingsConcentration.top1Ticker || 'Top 1'}): {summary.topHoldingsConcentration.top1}% · Target &lt;30%
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-xs text-slate-400">Evidence Audit Freshness</div>
          {summary.evidenceFreshnessStats ? (
            <>
              <div className="text-2xl font-bold font-mono tracking-tight text-emerald-400 mt-1">
                {summary.evidenceFreshnessStats.freshPercentage}%
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {summary.evidenceFreshnessStats.adequatePercentage}% adequate · {summary.evidenceFreshnessStats.stalePercentage}% stale/pending
              </div>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold font-mono tracking-tight text-slate-400 mt-1">
                Untracked
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Zero statutory filings linked
              </div>
            </>
          )}
        </div>
      </div>

      {/* Target Allocation Purchase Recommendations (Exported by Python Agent) */}
      {purchaseRecommendations && purchaseRecommendations.length > 0 && (
        <div className="rounded-lg border border-sky-900/60 bg-sky-950/20 p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              <h2 className="text-sm font-semibold text-sky-200">
                Purchase Recommendations ({purchaseRecommendations.length} Assets · Python Engine Export)
              </h2>
            </div>
            <span className="text-[11px] font-mono text-sky-400 bg-sky-950 px-2 py-0.5 rounded border border-sky-800/60 self-start sm:self-auto">
              {summary.newMoneyBudgetTRY !== undefined ? `Budget: ₺${summary.newMoneyBudgetTRY.toLocaleString('tr-TR')}` : 'Deterministic Rebalancing'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {purchaseRecommendations.map((rec, rIdx) => (
              <div key={rIdx} className="rounded border border-sky-800/40 bg-slate-900/80 p-3 space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-white">{rec.asset}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-sans uppercase font-semibold ${
                    rec.priority === 'HIGH' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                    rec.priority === 'MEDIUM' ? 'bg-sky-950 text-sky-300 border border-sky-800' :
                    'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    {rec.priority} Priority
                  </span>
                </div>
                <div className="text-base font-bold font-mono text-emerald-400">
                  ₺{rec.purchaseTRY.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Category: {rec.category}</span>
                  <span className="font-mono">Underweight: +{rec.gapPp.toFixed(1)}pp</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Holdings Requiring Review Banner */}
      {reviewItems.length > 0 && (
        <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-amber-300">
                Action Required: {reviewItems.length} Holdings Flagged for Research Review
              </h2>
            </div>
            <button
              onClick={onNavigateToDecisions}
              className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 transition-colors"
            >
              <span>View Decision Queue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {reviewItems.map(item => (
              <div
                key={item.id}
                onClick={() => onSelectHolding(item.id)}
                className="cursor-pointer rounded border border-amber-800/40 bg-slate-900/80 p-3 hover:border-amber-600/60 transition-colors"
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-mono font-bold text-white">{item.ticker}</span>
                  <span className="text-[11px] font-mono text-slate-400">
                    Weight: {item.currentWeight}% (Target: {item.targetWeight}%)
                  </span>
                </div>
                <p className="text-xs text-slate-300 line-clamp-2">
                  {item.reviewReason || item.thesisPremise}
                </p>
                <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Status: {item.decision.outcome}</span>
                  <span className="text-amber-400 flex items-center gap-1">
                    Examine <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Asset Allocation Breakdown (Visual Bar + Category Comparison) */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 space-y-6">
        <div>
          <h2 className="text-base font-semibold text-white">
            Asset Allocation by Category
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Target weights represent mandated policy limits. Current weights reflect market valuation and disciplined cash additions.
          </p>
        </div>

        {/* Visual Allocation Stack */}
        <div className="space-y-2">
          <div className="h-4 w-full rounded-md overflow-hidden flex bg-slate-800 border border-slate-700/50">
            {summary.categories.map((cat, idx) => {
              const colors = [
                'bg-blue-600',
                'bg-emerald-600',
                'bg-amber-600',
                'bg-violet-600',
                'bg-rose-600'
              ];
              const color = colors[idx % colors.length];
              return (
                <div
                  key={cat.category}
                  style={{ width: `${cat.currentWeight}%` }}
                  title={`${cat.label}: ${cat.currentWeight}% (Target ${cat.targetWeight}%)`}
                  className={`${color} h-full hover:opacity-90 transition-opacity`}
                />
              );
            })}
          </div>

          {/* Allocation Legend */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400 pt-1">
            {summary.categories.map((cat, idx) => {
              const dots = [
                'bg-blue-500',
                'bg-emerald-500',
                'bg-amber-500',
                'bg-violet-500',
                'bg-rose-500'
              ];
              return (
                <div key={cat.category} className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-sm ${dots[idx % dots.length]}`} />
                  <span className="font-medium text-slate-200">{cat.label}</span>
                  <span className="font-mono text-slate-400">{cat.currentWeight}%</span>
                  <span className="text-slate-600 font-mono">· Target: {cat.targetWeight}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Drift Matrix */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-medium">
                <th className="py-2.5 pr-4">Category</th>
                <th className="py-2.5 px-3">Holdings</th>
                <th className="py-2.5 px-3 text-right">Value ({isRealMode ? 'TRY' : 'USD'})</th>
                <th className="py-2.5 px-3 text-right">Current Weight</th>
                <th className="py-2.5 px-3 text-right">Target Weight</th>
                <th className="py-2.5 pl-3 text-right">Variance (Drift)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {summary.categories.map(cat => {
                const drift = cat.currentWeight - cat.targetWeight;
                const isUnder = drift < -1.5;
                const isOver = drift > 1.5;
                return (
                  <tr key={cat.category} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 pr-4 font-sans font-medium text-slate-200">
                      {cat.label}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 font-mono">
                      {cat.holdingCount} {cat.holdingCount === 1 ? 'asset' : 'assets'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-200">
                      {isRealMode
                        ? `₺${cat.currentValueTRY.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                        : cat.currentValueUSD !== undefined
                        ? `$${cat.currentValueUSD.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                        : `₺${cat.currentValueTRY.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                    </td>
                    <td className="py-2.5 px-3 text-right text-white font-semibold">
                      {cat.currentWeight.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-400">
                      {cat.targetWeight.toFixed(1)}%
                    </td>
                    <td className="py-2.5 pl-3 text-right">
                      <span className={`inline-flex items-center gap-1 font-semibold ${
                        isUnder ? 'text-amber-400' : isOver ? 'text-blue-400' : 'text-slate-400'
                      }`}>
                        {drift > 0 ? `+${drift.toFixed(1)}%` : `${drift.toFixed(1)}%`}
                        {isUnder && <ArrowDownRight className="w-3.5 h-3.5" />}
                        {isOver && <ArrowUpRight className="w-3.5 h-3.5" />}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Holdings Ledger Table */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">
              Portfolio Holdings & Evidence Health
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Click any holding to examine the primary thesis, dated citations, and decision rationale.
            </p>
          </div>

          {/* Category Filter Buttons */}
          <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg overflow-x-auto scrollbar-none">
            <button
              onClick={() => setFilterCategory('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                filterCategory === 'all'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Assets ({holdings.length})
            </button>
            <button
              onClick={() => setFilterCategory('equity')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                filterCategory === 'equity'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Equities
            </button>
            <button
              onClick={() => setFilterCategory('etf')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                filterCategory === 'etf'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ETFs
            </button>
            <button
              onClick={() => setFilterCategory('bitcoin')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                filterCategory === 'bitcoin'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Bitcoin
            </button>
            <button
              onClick={() => setFilterCategory('turkish_equity')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                filterCategory === 'turkish_equity'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              TR Equities
            </button>
            <button
              onClick={() => setFilterCategory('turkish_fund')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                filterCategory === 'turkish_fund'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              TR Funds
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-medium">
                <th className="py-3 pr-4">Ticker / Asset</th>
                <th className="py-3 px-3">Asset Category</th>
                <th className="py-3 px-3 text-right">Price / Basis</th>
                <th className="py-3 px-3 text-right">Unrealized P&L</th>
                <th className="py-3 px-3 text-right">Portfolio Value</th>
                <th className="py-3 px-3 text-right">Weight (vs Target)</th>
                <th className="py-3 px-3 text-center">Decision</th>
                <th className="py-3 pl-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredHoldings.map(h => {
                const isTRY = h.currency === 'TRY';
                const hasCostBasis = h.costBasis !== null && h.costBasis > 0;
                const pnlPercent = hasCostBasis
                  ? ((h.currentPrice - h.costBasis!) / h.costBasis!) * 100
                  : null;
                const isPositive = pnlPercent !== null ? pnlPercent >= 0 : null;
                const valueInUSD = isTRY ? (h.currentValue / SYNTHETIC_USD_TRY_RATE) : h.currentValue;

                return (
                  <tr
                    key={h.id}
                    onClick={() => onSelectHolding(h.id)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 pr-4 font-sans">
                      <div className="font-bold text-white group-hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                        <span className="font-mono text-sm">{h.ticker}</span>
                        {h.reviewStatus === 'review_required' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Review Required" />
                        )}
                        {h.reviewStatus === 'insufficient_evidence' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400" title="Insufficient Evidence" />
                        )}
                      </div>
                      <div className="text-slate-400 text-[11px] truncate max-w-xs font-sans">
                        {h.name}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 font-sans text-slate-300 capitalize">
                      {h.category.replace('_', ' ')}
                    </td>

                    <td className="py-3.5 px-3 text-right">
                      <div className="text-slate-200 font-semibold">
                        {isTRY ? '₺' : '$'}{h.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-slate-500 text-[11px]">
                        Cost: {h.costBasis !== null ? `${isTRY ? '₺' : '$'}${h.costBasis.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : <span className="italic">Untracked</span>}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-right">
                      {pnlPercent !== null ? (
                        <>
                          <span className={`font-semibold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isPositive ? '+' : ''}{pnlPercent.toFixed(1)}%
                          </span>
                          <div className="text-slate-500 text-[11px]">
                            {isPositive ? 'Gain' : 'Loss'}
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="text-slate-500 text-xs italic">N/A</span>
                          <div className="text-slate-500 text-[11px]">—</div>
                        </>
                      )}
                    </td>

                    <td className="py-3.5 px-3 text-right">
                      {isRealMode ? (
                        <>
                          <div className="text-white font-semibold">
                            ₺{h.currentValue.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </div>
                          {h.tradingCurrency && h.tradingCurrency !== 'TRY' && (
                            <div className="text-slate-500 text-[11px]">
                              Venue: {h.tradingCurrency}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="text-white font-semibold">
                            ${valueInUSD.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </div>
                          {isTRY && (
                            <div className="text-slate-500 text-[11px]">
                              ₺{h.currentValue.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </div>
                          )}
                        </>
                      )}
                    </td>

                    <td className="py-3.5 px-3 text-right">
                      <div className="text-slate-200 font-semibold">
                        {h.currentWeight.toFixed(1)}%
                      </div>
                      <div className="text-slate-500 text-[11px]">
                        Target: {h.targetWeight.toFixed(1)}% ({h.driftPercentage > 0 ? `+${h.driftPercentage.toFixed(1)}` : h.driftPercentage.toFixed(1)}%)
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold font-sans tracking-wide ${
                        h.decision.outcome === 'HOLD'
                          ? 'bg-slate-800 text-slate-200 border border-slate-700'
                          : h.decision.outcome === 'INCREASE'
                          ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800'
                          : h.decision.outcome === 'REDUCE'
                          ? 'bg-amber-950/70 text-amber-300 border border-amber-800'
                          : h.decision.outcome === 'SELL'
                          ? 'bg-rose-950/70 text-rose-300 border border-rose-800'
                          : 'bg-purple-950/70 text-purple-300 border border-purple-800'
                      }`}>
                        {h.decision.outcome}
                      </span>
                    </td>

                    <td className="py-3.5 pl-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectHolding(h.id);
                        }}
                        className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                        title="View Research Dossier"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Risk & Concentration Deep-Dive */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white">Currency Exposure</h3>
          <p className="text-xs text-slate-400">
            Structural split between Hard Currency (USD) and Emerging Market Currency (TRY).
          </p>
          <div className="space-y-2 pt-1 font-mono text-xs">
            <div className="flex items-center justify-between text-slate-300">
              <span className="font-sans">USD Assets:</span>
              <span className="font-bold text-white">{summary.currencyExposure.USD}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-blue-500 h-full" style={{ width: `${summary.currencyExposure.USD}%` }} />
            </div>

            <div className="flex items-center justify-between text-slate-300 pt-2">
              <span className="font-sans">TRY Assets:</span>
              <span className="font-bold text-white">{summary.currencyExposure.TRY}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full" style={{ width: `${summary.currencyExposure.TRY}%` }} />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white">Concentration Constraints</h3>
          <p className="text-xs text-slate-400">
            Mandate rule: No single individual company may exceed 30% of portfolio.
          </p>
          <div className="space-y-2 pt-1 text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="font-sans text-slate-300">Top 1 Single Stock ({summary.topHoldingsConcentration.top1Ticker || 'Top 1'}):</span>
              <span className="font-bold text-emerald-400">{summary.topHoldingsConcentration.top1}% (Limit &lt;30%)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-sans text-slate-300">Top 3 Combined:</span>
              <span className="font-bold text-white">{summary.topHoldingsConcentration.top3}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-sans text-slate-300">Top 5 Combined:</span>
              <span className="font-bold text-white">{summary.topHoldingsConcentration.top5}%</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white">Stewardship Principles</h3>
          <p className="text-xs text-slate-400">
            Core rules governing portfolio adjustments:
          </p>
          <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-4 font-sans">
            <li>HOLD is the baseline default.</li>
            <li>Price drops never trigger panic sells.</li>
            <li>Drift alone never triggers liquidations.</li>
            <li>SELL requires audited thesis breakdown.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
