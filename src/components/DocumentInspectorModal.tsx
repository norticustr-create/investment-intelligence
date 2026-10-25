/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { SourceDocument, EvidenceFinding } from '../types/investment';
import { SYNTHETIC_EVIDENCE_FINDINGS } from '../data/syntheticPortfolio';
import { X, FileText, CheckCircle2, AlertTriangle, Calendar, Building, ExternalLink, ShieldCheck } from 'lucide-react';

interface DocumentInspectorModalProps {
  document: SourceDocument | null;
  onClose: () => void;
}

export const DocumentInspectorModal: React.FC<DocumentInspectorModalProps> = ({
  document,
  onClose
}) => {
  if (!document) return null;

  const linkedFindings = SYNTHETIC_EVIDENCE_FINDINGS.filter(f => f.sourceDocId === document.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="space-y-1 pr-6">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400">
                {document.sourceType.replace('_', ' ')}
              </span>
              <span className="text-slate-600">·</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                document.isAudited
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {document.isAudited ? 'Statutory Audit Verified' : 'Management Disclosure'}
              </span>
            </div>
            <h3 className="text-lg font-bold text-white leading-snug">
              {document.title}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3 bg-slate-950/70 p-4 rounded border border-slate-800/80 font-mono">
            <div>
              <div className="text-slate-500 font-sans text-[11px]">Regulatory Filing Body</div>
              <div className="text-slate-200 font-semibold mt-0.5">{document.sourceName}</div>
            </div>

            <div>
              <div className="text-slate-500 font-sans text-[11px]">Reporting Period</div>
              <div className="text-slate-200 font-semibold mt-0.5">{document.reportingPeriod}</div>
            </div>

            <div>
              <div className="text-slate-500 font-sans text-[11px]">Statutory Publication Date</div>
              <div className="text-slate-200 mt-0.5">{document.publicationDate}</div>
            </div>

            <div>
              <div className="text-slate-500 font-sans text-[11px]">Verification Status</div>
              <div className="text-emerald-400 font-sans mt-0.5 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Active in Demonstration Matrix
              </div>
            </div>

            <div className="col-span-2 pt-2 border-t border-slate-800/80">
              <div className="text-slate-500 font-sans text-[11px]">Official Accession / Registration Identifier</div>
              <div className="text-slate-300 break-all select-all mt-0.5 text-[11px] bg-slate-900 p-1.5 rounded border border-slate-800">
                {document.identifier}
              </div>
            </div>
          </div>

          {/* Notes */}
          {document.notes && (
            <div>
              <div className="text-slate-400 font-semibold mb-1">Auditor & Disclosure Notes</div>
              <p className="bg-slate-950/40 p-3 rounded border border-slate-800 leading-relaxed text-slate-300">
                {document.notes}
              </p>
            </div>
          )}

          {/* Extracted Findings Linked */}
          <div>
            <div className="text-slate-400 font-semibold mb-2 flex items-center justify-between">
              <span>Extracted Findings Tied to this Document ({linkedFindings.length})</span>
            </div>

            <div className="space-y-3">
              {linkedFindings.map(finding => (
                <div key={finding.id} className="p-3 rounded border border-slate-800 bg-slate-950/50 space-y-1.5">
                  <div className="font-semibold text-slate-100">{finding.claim}</div>
                  <blockquote className="italic text-slate-400 border-l-2 border-slate-700 pl-2">
                    "{finding.excerpt}"
                  </blockquote>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Last Verified: {finding.lastVerifiedDate} · Confidence: {finding.confidenceNotes}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Source record stored in Investment Intelligence knowledge repository
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 font-medium bg-slate-800 hover:bg-slate-700 text-white rounded transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
