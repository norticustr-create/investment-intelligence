/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Holding } from '../types/investment';
import { evaluateDecisionRules, DecisionEvaluationInput } from '../utils/decisionEngine';
import { X, Cpu, ShieldCheck, Scale, CheckCircle2, RotateCcw, AlertTriangle } from 'lucide-react';

interface EvaluateThesisModalProps {
  isOpen: boolean;
  onClose: () => void;
  holdings: Holding[];
  initialHoldingId?: string;
}

export const EvaluateThesisModal: React.FC<EvaluateThesisModalProps> = ({
  isOpen,
  onClose,
  holdings,
  initialHoldingId
}) => {
  const initialHolding = (holdings && holdings.length > 0)
    ? (holdings.find(h => h.id === initialHoldingId) || holdings[0])
    : null;

  const [selectedHoldingId, setSelectedHoldingId] = useState<string>(initialHolding?.id || '');
  const [ticker, setTicker] = useState<string>(initialHolding?.ticker || '');
  const [assetName, setAssetName] = useState<string>(initialHolding?.name || '');
  const [thesisStatus, setThesisStatus] = useState<'intact' | 'questionable' | 'materially_invalidated'>('intact');
  const [evidenceQuality, setEvidenceQuality] = useState<'verified_fresh' | 'adequate' | 'stale_or_missing' | 'conflicting'>('verified_fresh');
  const [priceDrawdown, setPriceDrawdown] = useState<number>(-12);
  const [allocationDrift, setAllocationDrift] = useState<number>(0.0);
  const [valuationFavorable, setValuationFavorable] = useState<boolean>(true);
  const [portfolioBudgetAvailable, setPortfolioBudgetAvailable] = useState<boolean>(false);
  const [verifiedMoatDestruction, setVerifiedMoatDestruction] = useState<boolean>(false);
  const [hasTraceableEvidence, setHasTraceableEvidence] = useState<boolean>(true);
  const [hasRiskConcern, setHasRiskConcern] = useState<boolean>(false);

  const handleSelectPreloaded = (hId: string) => {
    setSelectedHoldingId(hId);
    const found = holdings?.find(h => h.id === hId);
    if (found) {
      setTicker(found.ticker);
      setAssetName(found.name);
      const hasCostBasis = found.costBasis !== null && found.costBasis > 0;
      const pnl = hasCostBasis ? ((found.currentPrice - found.costBasis!) / found.costBasis!) * 100 : 0;
      setPriceDrawdown(pnl < 0 ? parseFloat(pnl.toFixed(1)) : 0);
      setAllocationDrift(found.driftPercentage);
      setValuationFavorable(found.decision.outcome === 'INCREASE');
      setPortfolioBudgetAvailable(found.driftPercentage < 0);
      setVerifiedMoatDestruction(found.decision.outcome === 'SELL');
      setThesisStatus(found.decision.outcome === 'SELL' ? 'materially_invalidated' : 'intact');
      setEvidenceQuality(found.decision.outcome === 'INSUFFICIENT_EVIDENCE' ? 'stale_or_missing' : 'verified_fresh');
      setHasTraceableEvidence(true);
      setHasRiskConcern(found.decision.outcome === 'REDUCE');
    }
  };

  React.useEffect(() => {
    if (isOpen && initialHolding) {
      handleSelectPreloaded(initialHolding.id);
    }
  }, [isOpen, initialHoldingId, holdings]);

  if (!isOpen) return null;

  if (!initialHolding || !holdings || holdings.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
        <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-lg p-6 shadow-2xl text-center space-y-4">
          <div className="text-sm font-semibold text-slate-300">No Holdings Available</div>
          <p className="text-xs text-slate-400">The active portfolio has no holdings to evaluate against constitutional decision rules.</p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const evalInput: DecisionEvaluationInput = {
    holdingName: `${ticker} - ${assetName}`,
    thesisStatus,
    evidenceQuality,
    priceDrawdownPercent: priceDrawdown,
    allocationDriftPercent: allocationDrift,
    valuationFavorable,
    valuationAssessment: {
      isFavorable: valuationFavorable,
      inputTimestamp: '2026-02-15T00:00:00Z',
      metricsCount: 3
    },
    portfolioBudgetAvailable,
    riskAssessmentSupportsIncrease: true,
    verifiedMoatDestruction,
    traceableEvidenceIds: hasTraceableEvidence
      ? ((initialHolding?.supportingEvidenceIds && initialHolding.supportingEvidenceIds.length > 0)
          ? initialHolding.supportingEvidenceIds
          : ['ev-msft-1'])
      : [],
    evidenceVerificationStatus: 'simulated_demonstration',
    hasDocumentedRiskConcern: hasRiskConcern,
    traceableRiskEvidenceIds: hasRiskConcern
      ? ((initialHolding?.counterevidenceIds && initialHolding.counterevidenceIds.length > 0)
          ? initialHolding.counterevidenceIds
          : ['ev-msft-3'])
      : [],
    executionMode: 'synthetic_simulation',
    allowSimulatedDemonstrationDraft: true,
    asOfDate: '2026-02-20'
  };

  const result = evaluateDecisionRules(evalInput);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-lg shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-800 bg-slate-950/70">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <Cpu className="w-4 h-4" />
              <span>Investment Intelligence Protocol Engine</span>
            </div>
            <h2 className="text-lg font-bold text-white">
              Evaluate Holding Against Constitutional Decision Rules
            </h2>
            <p className="text-xs text-slate-400">
              Test qualitative thesis health, statutory filing freshness, and valuation to derive a deterministic decision.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-300">
          {/* Quick Holding Preset Selector */}
          <div>
            <label className="block text-slate-400 font-semibold mb-1.5">
              Select Preset Holding to Evaluate:
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {holdings.map(h => (
                <button
                  key={h.id}
                  onClick={() => handleSelectPreloaded(h.id)}
                  className={`px-2.5 py-1.5 rounded border font-mono text-center transition-colors ${
                    selectedHoldingId === h.id
                      ? 'border-emerald-500 bg-emerald-950/40 text-white font-bold'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {h.ticker}
                </button>
              ))}
            </div>
          </div>

          {/* Form Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/60 p-4 rounded border border-slate-800">
            {/* Thesis Condition */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300">
                1. Fundamental Economic Thesis Status
              </label>
              <select
                value={thesisStatus}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setThesisStatus(val);
                  if (val === 'materially_invalidated') {
                    setVerifiedMoatDestruction(true);
                  } else {
                    setVerifiedMoatDestruction(false);
                  }
                }}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-hidden"
              >
                <option value="intact">Intact · Economic Moat & Cash Flows Solid</option>
                <option value="questionable">Questionable · Headwinds Under Evaluation</option>
                <option value="materially_invalidated">Materially Invalidated · Moat Destroyed</option>
              </select>
            </div>

            {/* Evidence Quality */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300">
                2. Statutory Document Freshness & Verification
              </label>
              <select
                value={evidenceQuality}
                onChange={(e) => setEvidenceQuality(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-hidden"
              >
                <option value="verified_fresh">Verified Fresh · Audited Primary Filings</option>
                <option value="adequate">Adequate · Recent Filings Within 120 Days</option>
                <option value="stale_or_missing">Stale (&gt;140d) or Missing Data Points</option>
                <option value="conflicting">Conflicting Disclosures Unresolved</option>
              </select>
            </div>

            {/* Price Drawdown */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-300">
                  3. Unrealized Market Price Change:
                </label>
                <span className={`font-mono font-bold ${priceDrawdown < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {priceDrawdown}%
                </span>
              </div>
              <input
                type="range"
                min="-75"
                max="50"
                step="5"
                value={priceDrawdown}
                onChange={(e) => setPriceDrawdown(parseInt(e.target.value))}
                className="w-full accent-emerald-400 cursor-pointer"
              />
              <div className="text-[10px] text-slate-500 font-mono flex justify-between">
                <span>-75% Crash</span>
                <span>0% Cost Basis</span>
                <span>+50% Gain</span>
              </div>
            </div>

            {/* Allocation Drift */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-300">
                  4. Allocation Weight vs Target Weight:
                </label>
                <span className="font-mono font-bold text-slate-200">
                  {allocationDrift > 0 ? `+${allocationDrift.toFixed(1)}%` : `${allocationDrift.toFixed(1)}%`}
                </span>
              </div>
              <input
                type="range"
                min="-6"
                max="8"
                step="0.5"
                value={allocationDrift}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setAllocationDrift(val);
                  setPortfolioBudgetAvailable(val < 0);
                }}
                className="w-full accent-emerald-400 cursor-pointer"
              />
              <div className="text-[10px] text-slate-500 font-mono flex justify-between">
                <span>-6% Underweight</span>
                <span>0% Balanced</span>
                <span>+8% Overweight</span>
              </div>
            </div>

            {/* Valuation check */}
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="valFavorable"
                checked={valuationFavorable}
                onChange={(e) => setValuationFavorable(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-emerald-500"
              />
              <label htmlFor="valFavorable" className="text-slate-200 cursor-pointer">
                Valuation Attractive (Trading below or at historic fair value)
              </label>
            </div>

            {/* Moat check */}
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="moatBreach"
                checked={verifiedMoatDestruction}
                onChange={(e) => {
                  setVerifiedMoatDestruction(e.target.checked);
                  if (e.target.checked) setThesisStatus('materially_invalidated');
                }}
                className="rounded border-slate-700 bg-slate-900 text-rose-500"
              />
              <label htmlFor="moatBreach" className="text-slate-200 cursor-pointer">
                Assert permanent moat destruction / debt default
              </label>
            </div>

            {/* Traceable Evidence Check (Safeguard 7) */}
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="hasTraceable"
                checked={hasTraceableEvidence}
                onChange={(e) => setHasTraceableEvidence(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-emerald-500"
              />
              <label htmlFor="hasTraceable" className="text-slate-200 cursor-pointer">
                Traceable primary evidence citations attached (Safeguard 7)
              </label>
            </div>

            {/* Documented Risk Concern Check (Safeguard 2) */}
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="hasRisk"
                checked={hasRiskConcern}
                onChange={(e) => setHasRiskConcern(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-amber-500"
              />
              <label htmlFor="hasRisk" className="text-slate-200 cursor-pointer">
                Documented position risk/concentration concern (Safeguard 2)
              </label>
            </div>
          </div>

          {/* Evaluation Engine Result Card */}
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-semibold">Engine Result for</span>
                <span className="font-mono font-bold text-white text-sm">{ticker}:</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  SYNTHETIC DEMONSTRATION DATA
                </span>
              </div>

              <span className={`px-3 py-1 rounded font-mono font-bold text-xs uppercase tracking-wider ${
                result.outcome === 'HOLD' ? 'bg-slate-800 text-white border border-slate-700' :
                result.outcome === 'INCREASE' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                result.outcome === 'SELL' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                result.outcome === 'INSUFFICIENT_EVIDENCE' ? 'bg-purple-950 text-purple-300 border border-purple-800' :
                'bg-amber-950 text-amber-300 border border-amber-800'
              }`}>
                {result.outcome}
              </span>
            </div>

            {/* Rationale */}
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-slate-400">Governing Rationale:</div>
              <p className="text-xs text-slate-200 leading-relaxed bg-slate-900/80 p-3 rounded border border-slate-800">
                {result.primaryRationale}
              </p>
            </div>

            {/* Missing Data Reasons & Reassessment Requirements */}
            {result.missingDataReasons && result.missingDataReasons.length > 0 && (
              <div className="rounded border border-purple-900/50 bg-purple-950/20 p-3 space-y-2">
                <div className="text-xs font-semibold text-purple-300">
                  Missing Data Identified:
                </div>
                <ul className="text-xs text-purple-200/90 list-disc pl-4 space-y-1">
                  {result.missingDataReasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
                {result.reassessmentRequirements && (
                  <div className="pt-1.5 border-t border-purple-900/40 text-xs text-slate-400">
                    <span className="font-semibold text-purple-300">Evidence Needed to Reassess: </span>
                    {result.reassessmentRequirements.join(' ')}
                  </div>
                )}
              </div>
            )}

            {/* Prevented Violations */}
            {result.violationsPrevented.length > 0 && (
              <div className="rounded border border-amber-900/60 bg-amber-950/20 p-3 space-y-1">
                <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  Behavioral Errors Prevented:
                </div>
                {result.violationsPrevented.map((v, i) => (
                  <p key={i} className="text-amber-200/90 text-xs">
                    {v}
                  </p>
                ))}
              </div>
            )}

            {/* Rules Applied */}
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-slate-400">Rules Applied in Evaluation:</div>
              <div className="space-y-1">
                {result.appliedRules.map(r => (
                  <div key={r.ruleNumber} className="flex items-start gap-2 text-slate-300">
                    <span className="font-mono text-emerald-400 font-bold shrink-0">Rule {r.ruleNumber}:</span>
                    <span>{r.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs">
          <span className="text-slate-400">
            Rule evaluation is deterministic and operates without external black-box models.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 font-medium bg-slate-800 hover:bg-slate-700 text-white rounded transition-colors"
          >
            Close Engine
          </button>
        </div>
      </div>
    </div>
  );
};
