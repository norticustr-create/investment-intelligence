/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  ShieldAlert,
  Scale,
  TrendingDown,
  Layers,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  FileCheck,
  Zap,
  ArrowRight
} from 'lucide-react';

interface DecisionProtocolViewProps {
  onOpenSimulator: () => void;
}

export const DecisionProtocolView: React.FC<DecisionProtocolViewProps> = ({
  onOpenSimulator
}) => {
  const rules = [
    {
      number: 1,
      title: 'Inertia & HOLD as Default Baseline',
      subtitle: 'Evidence must justify change, never inactivity',
      icon: Scale,
      color: 'text-slate-200 border-slate-700 bg-slate-800/40',
      tag: 'DEFAULT STANCE',
      description:
        'HOLD is the standard operating state for all portfolio holdings. In the absence of definitive, audited proof invalidating a thesis or a strict triple-test meeting an increase, capital remains undisturbed to let compounding work.',
      operationalGuard:
        'Prevents hyperactive portfolio turnover, frictional tax drag, and trading commissions.'
    },
    {
      number: 2,
      title: 'Price Drawdown Alone Never Triggers SELL',
      subtitle: 'Market volatility is not business impairment',
      icon: TrendingDown,
      color: 'text-rose-400 border-rose-900/40 bg-rose-950/20',
      tag: 'PSYCHOLOGICAL SHIELD',
      description:
        'An unrealized loss or sudden stock price decline—no matter how severe (e.g., -30%, -50%)—is completely disallowed as the sole or primary reason to execute a SELL decision. The market price is merely what someone else is willing to pay today, not an audit of business moat.',
      operationalGuard:
        'Prohibits emotional panic selling at cyclical market bottoms when fundamental economic moats remain robust.'
    },
    {
      number: 3,
      title: 'Allocation Drift Alone Never Triggers SELL',
      subtitle: 'Drift dictates rebalancing tranches, not liquidation',
      icon: Layers,
      color: 'text-amber-400 border-amber-900/40 bg-amber-950/20',
      tag: 'DISCIPLINED REBALANCING',
      description:
        'When an asset appreciates or depreciates beyond its mandated target weight (e.g., Bitcoin appreciating to 12.1% against a 10.0% target), the correct operational response is a disciplined rebalance deliberation, never an abrupt termination or total liquidation.',
      operationalGuard:
        'Prevents mistaking routine asset allocation rebalancing for thesis abandonment.'
    },
    {
      number: 4,
      title: 'The Triple-Test Requirement for INCREASE',
      subtitle: 'Thesis Quality + Portfolio Room + Favorable Valuation',
      icon: CheckCircle2,
      color: 'text-emerald-400 border-emerald-900/40 bg-emerald-950/20',
      tag: 'CAPITAL ALLOCATION BARRIER',
      description:
        'To trigger an INCREASE recommendation, three conditions must concurrently pass: 1) Verified high thesis quality with durable economic moat; 2) Available risk budget (current weight is below target); 3) Valuation multiples at or below long-term fair value benchmarks. If any one of the three fails, the decision reverts to HOLD.',
      operationalGuard:
        'Prevents chasing expensive momentum stocks or over-concentrating in already full positions.'
    },
    {
      number: 5,
      title: 'High-Bar Structural Thesis Invalidation for SELL',
      subtitle: 'Audited moat collapse or terminal governance breach',
      icon: ShieldAlert,
      color: 'text-rose-400 border-rose-900/40 bg-rose-950/20',
      tag: 'SUBSTANTIVE EXIT CRITERIA',
      description:
        'A SELL decision requires incontrovertible, verified empirical evidence that permanently breaks the long-term investment thesis (e.g., structural negative gross margins, lender covenant defaults, patent invalidation, or terminal technological substitution). Prior purchase price is completely irrelevant to this determination.',
      operationalGuard:
        'Ensures exits are based on business autopsy rather than market noise or price anchoring.'
    },
    {
      number: 6,
      title: 'Epistemic Honesty: INSUFFICIENT EVIDENCE',
      subtitle: 'Refusal to guess when data is stale, missing, or conflicting',
      icon: HelpCircle,
      color: 'text-purple-400 border-purple-900/40 bg-purple-950/20',
      tag: 'EPISTEMIC GUARDRAIL',
      description:
        'If primary statutory evidence is older than 140 days without subsequent release, if disclosures conflict without regulatory clarity, or if critical risk details are omitted, the terminal strictly mandates INSUFFICIENT EVIDENCE. The system never invents facts or forces an arbitrary conviction score.',
      operationalGuard:
        'Prevents false confidence and hallucinations under conditions of incomplete market disclosures.'
    }
  ];

  return (
    <div className="space-y-8 pb-16">
      {/* Protocol Header */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
        <div className="max-w-4xl space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <Scale className="w-4 h-4" />
            <span>Investment Intelligence Constitutional Rules</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Critical Decision Rules & Governance Constitution
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            The Investment Intelligence terminal is designed for long-term buy-and-hold investors. These deterministic rules govern every calculation, recommendation, and thesis audit across the application.
          </p>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            6 Core Invariants Enforced in Code
          </div>
          <button
            onClick={onOpenSimulator}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-900 bg-emerald-400 hover:bg-emerald-300 rounded transition-colors flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Launch Rule Simulator</span>
          </button>
        </div>
      </div>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {rules.map(rule => {
          const Icon = rule.icon;
          return (
            <div
              key={rule.number}
              className={`rounded-lg border p-6 space-y-4 ${rule.color}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded bg-slate-900 border border-slate-700/80 flex items-center justify-center font-mono font-bold text-xs text-white">
                    {rule.number}
                  </span>
                  <span className="text-[11px] font-mono tracking-wider uppercase text-slate-400">
                    {rule.tag}
                  </span>
                </div>
                <Icon className="w-5 h-5 shrink-0 opacity-80" />
              </div>

              <div>
                <h3 className="text-base font-bold text-white leading-snug">
                  {rule.title}
                </h3>
                <div className="text-xs text-slate-400 mt-0.5">
                  {rule.subtitle}
                </div>
              </div>

              <p className="text-xs text-slate-200 leading-relaxed">
                {rule.description}
              </p>

              <div className="pt-3 border-t border-slate-800/80 text-xs">
                <span className="text-slate-400 font-semibold">Fiduciary Protection: </span>
                <span className="text-slate-300">{rule.operationalGuard}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Data Integrity Pledge */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-6 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <FileCheck className="w-4 h-4 text-emerald-400" />
          <span>Strict Zero-Fabrication Integrity Standard</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          The Investment Intelligence terminal never invents mock stock prices, hallucinated financial statements, fake regulatory accessions, or arbitrary algorithm scores (such as a generic "87/100 conviction index"). Every assertion in this terminal is explicitly traceable to a statutory document (SEC Form 10-K, KAP notification, TEFAS factsheet, or on-chain consensus code). In demonstration mode, all synthetic figures are clearly labeled to preserve strict epistemic transparency.
        </p>
      </div>
    </div>
  );
};
