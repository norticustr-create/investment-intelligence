/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { EvidenceFinding, SourceDocument, Holding, DataSourceMetadata } from '../types/investment';
import { SYNTHETIC_SOURCE_DOCUMENTS, SYNTHETIC_EVIDENCE_FINDINGS } from '../data/syntheticPortfolio';
import {
  Search,
  Filter,
  FileText,
  ShieldCheck,
  AlertTriangle,
  Clock,
  HelpCircle,
  ExternalLink,
  Layers,
  CheckCircle2,
  Calendar,
  Building,
  ArrowRight,
  Info
} from 'lucide-react';

interface EvidenceExplorerProps {
  holdings: Holding[];
  onSelectHolding: (holdingId: string) => void;
  onInspectDocument: (doc: SourceDocument) => void;
  dataSource?: DataSourceMetadata;
}

export const EvidenceExplorer: React.FC<EvidenceExplorerProps> = ({
  holdings,
  onSelectHolding,
  onInspectDocument,
  dataSource
}) => {
  const isReal = dataSource?.mode === 'local_snapshot' || dataSource?.mode === 'cloud_live';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHoldingFilter, setSelectedHoldingFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'claims' | 'documents'>('claims');

  // Extract live intelligence findings and documents if present on holdings
  const liveReports = holdings
    .map(h => h.intelligenceReport)
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  const hasLiveIntelligence = liveReports.length > 0;

  const liveClaims: EvidenceFinding[] = [];
  const liveDocsMap = new Map<string, SourceDocument>();

  if (hasLiveIntelligence) {
    for (const report of liveReports) {
      if (Array.isArray(report.findings)) {
        for (const f of report.findings) {
          if (!f || !f.id) continue;
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
              verificationStatus: f.verification_status,
              freshnessStatus: 'fresh',
              isSyntheticDemonstration: false,
              notes: f.explanation
            });
          }

          liveClaims.push({
            id: f.id,
            holdingId: f.holding_id,
            sourceDocId: f.source_doc_id,
            claim: f.claim,
            excerpt: f.excerpt,
            type: f.type,
            verificationStatus: f.verification_status,
            freshnessStatus: 'fresh',
            evidenceQuality: f.evidence_quality,
            confidenceNotes: f.explanation,
            lastVerifiedDate: report.as_of_date,
            isConflicting: f.thesis_impact === 'CHALLENGES_THESIS' || f.thesis_impact === 'INVALIDATES_THESIS',
            conflictDescription: f.explanation,
            isSyntheticDemonstration: false,
            supportsThesisInvalidation: f.thesis_impact === 'INVALIDATES_THESIS' || f.supports_moat_destruction,
            supportsRiskConcern: f.materiality === 'HIGH',
            claimModality: 'confirmed_fact',
            claimScope: 'holding_specific'
          });
        }
      }
    }
  }

  const isSyntheticMode = !dataSource || dataSource.mode === 'synthetic_demonstration';

  const claimsSource: EvidenceFinding[] = hasLiveIntelligence
    ? liveClaims
    : isSyntheticMode
    ? SYNTHETIC_EVIDENCE_FINDINGS
    : [];

  const docsSource: SourceDocument[] = hasLiveIntelligence
    ? Array.from(liveDocsMap.values())
    : isSyntheticMode
    ? SYNTHETIC_SOURCE_DOCUMENTS
    : [];

  // Filter Claims
  const filteredClaims = claimsSource.filter(finding => {
    const matchesHolding = selectedHoldingFilter === 'all' || finding.holdingId === selectedHoldingFilter;
    const matchesType = selectedTypeFilter === 'all' || finding.type === selectedTypeFilter;
    const doc = docsSource.find(d => d.id === finding.sourceDocId);
    const matchesSearch = searchQuery === '' ||
      finding.claim.toLowerCase().includes(searchQuery.toLowerCase()) ||
      finding.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc?.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc?.identifier.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesHolding && matchesType && matchesSearch;
  });

  // Filter Documents
  const filteredDocuments = docsSource.filter(doc => {
    const matchesSearch = searchQuery === '' ||
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.sourceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.identifier.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.reportingPeriod.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const getHolding = (hId: string) => holdings.find(h => h.id === hId);
  const getDoc = (docId: string) => docsSource.find(d => d.id === docId);

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-3">
            <span>Evidence Explorer & Source Traceability</span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase tracking-wider ${
              isReal
                ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}>
              {dataSource?.label ?? 'SYNTHETIC DEMONSTRATION DATA'}
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Empirical knowledge base. Every thesis claim is indexed with primary source citations, audit state, and freshness timestamps.
          </p>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg shrink-0">
          <button
            onClick={() => setActiveTab('claims')}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
              activeTab === 'claims'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Claims & Findings ({claimsSource.length})
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
              activeTab === 'documents'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Source Documents ({docsSource.length})
          </button>
        </div>
      </div>

      {hasLiveIntelligence ? (
        <div className="rounded-lg border border-sky-800/80 bg-sky-950/30 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-900/60 border border-sky-700/60 flex items-center justify-center text-sky-400 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                <span>Verified Live Statutory Intelligence Feed</span>
                <span className="text-[10px] font-mono font-normal text-sky-300 bg-sky-900/40 px-2 py-0.5 rounded border border-sky-700/50">
                  {docsSource.length} Primary Documents Ingested
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Claims normalized from SEC EDGAR, KAP public disclosures, and primary records with automated execution blocked.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-semibold text-emerald-400 shrink-0 hidden sm:inline">
            {claimsSource.length} Live Findings
          </span>
        </div>
      ) : isReal ? (
        <div className="rounded-lg border border-sky-900/50 bg-sky-950/20 p-6 text-center space-y-2">
          <Info className="w-6 h-6 mx-auto text-sky-400" />
          <h3 className="text-sm font-semibold text-sky-200">Local Snapshot Mode · No Regulatory Filings Uploaded</h3>
          <p className="text-xs text-slate-400 max-w-xl mx-auto">
            The active portfolio snapshot represents real holdings and purchase allocation recommendations exported from your local investment engine. No statutory SEC/KAP regulatory disclosures or audited statements have been ingested for these positions.
          </p>
        </div>
      ) : null}

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-900/60 p-4 rounded-lg border border-slate-800">
        {/* Search Input */}
        <div className="md:col-span-5 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search claims, accession numbers, issuers, or keywords..."
            className="w-full bg-slate-950 border border-slate-800 rounded pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-hidden focus:border-slate-700"
          />
        </div>

        {/* Holding Filter */}
        <div className="md:col-span-3">
          <select
            value={selectedHoldingFilter}
            onChange={(e) => setSelectedHoldingFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-hidden focus:border-slate-700"
          >
            <option value="all">All Holdings ({holdings.length})</option>
            {holdings.map(h => (
              <option key={h.id} value={h.id}>
                {h.ticker} - {h.name}
              </option>
            ))}
          </select>
        </div>

        {/* Evidence Classification Filter */}
        <div className="md:col-span-4">
          <select
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-hidden focus:border-slate-700"
          >
            <option value="all">All Evidence Classifications</option>
            <option value="verified_fact">Verified Statutory Facts</option>
            <option value="model_interpretation">Model Interpretations & Forecasts</option>
            <option value="conflicting_evidence">Conflicting / Disputed Evidence</option>
            <option value="stale_evidence">Stale / Outdated Reports (&gt;140d)</option>
          </select>
        </div>
      </div>

      {/* Epistemic Classification Guidance Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="rounded border border-emerald-900/40 bg-emerald-950/20 p-3">
          <div className="font-semibold text-emerald-400 flex items-center gap-1.5 mb-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            Verified Facts
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Statutory filings (SEC 10-K, KAP, TEFAS, On-Chain code) with independent auditor opinions.
          </p>
        </div>

        <div className="rounded border border-blue-900/40 bg-blue-950/20 p-3">
          <div className="font-semibold text-blue-400 flex items-center gap-1.5 mb-1">
            <Layers className="w-3.5 h-3.5" />
            Model Interpretations
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Analytical inferences, DCF projections, or scenario sensitivities based on empirical facts.
          </p>
        </div>

        <div className="rounded border border-amber-900/40 bg-amber-950/20 p-3">
          <div className="font-semibold text-amber-400 flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            Conflicting Evidence
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Regulatory disputes, conflicting analyst consensus, or marketing claims clashing with filings.
          </p>
        </div>

        <div className="rounded border border-purple-900/40 bg-purple-950/20 p-3">
          <div className="font-semibold text-purple-400 flex items-center gap-1.5 mb-1">
            <Clock className="w-3.5 h-3.5" />
            Stale / Gaps
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Disclosures older than 140 days without subsequent updates. Enforces INSUFFICIENT EVIDENCE.
          </p>
        </div>
      </div>

      {/* Main Content Area: Claims vs Documents */}
      {activeTab === 'claims' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Showing {filteredClaims.length} extracted claims</span>
            <span>Click any citation to inspect official accession metadata</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredClaims.map(claim => {
              const holding = getHolding(claim.holdingId);
              const doc = getDoc(claim.sourceDocId);

              const badgeColors = {
                verified_fact: 'bg-emerald-950 text-emerald-300 border-emerald-800',
                model_interpretation: 'bg-blue-950 text-blue-300 border-blue-800',
                conflicting_evidence: 'bg-amber-950 text-amber-300 border-amber-800',
                stale_evidence: 'bg-purple-950 text-purple-300 border-purple-800'
              };

              const labels = {
                verified_fact: 'Verified Fact',
                model_interpretation: 'Model Interpretation',
                conflicting_evidence: 'Conflicting Evidence',
                stale_evidence: 'Stale (>140d)'
              };

              return (
                <div
                  key={claim.id}
                  className="rounded-lg border border-slate-800 bg-slate-900/40 p-5 space-y-3 hover:border-slate-700 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {holding && (
                          <button
                            onClick={() => onSelectHolding(holding.id)}
                            className="font-mono font-bold text-white hover:text-emerald-400 transition-colors text-sm"
                          >
                            {holding.ticker}
                          </button>
                        )}
                        <span className="text-slate-500">·</span>
                        <span className="text-xs text-slate-400">{holding?.name}</span>
                      </div>
                      <h3 className="text-sm font-semibold text-slate-100 leading-snug">
                        {claim.claim}
                      </h3>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[11px] font-mono border whitespace-nowrap self-start ${badgeColors[claim.type]}`}>
                      {labels[claim.type]}
                    </span>
                  </div>

                  {/* Verbatim Excerpt */}
                  <div className="bg-slate-950/70 p-3 rounded border border-slate-800/80 font-sans text-xs text-slate-300 italic border-l-2 border-emerald-500/60">
                    "{claim.excerpt}"
                  </div>

                  {/* Conflict description if applicable */}
                  {claim.conflictDescription && (
                    <div className="bg-amber-950/30 p-2.5 rounded border border-amber-900/40 text-xs text-amber-300/90 space-y-0.5">
                      <span className="font-semibold text-amber-200">Unresolved Conflict:</span>
                      <p>{claim.conflictDescription}</p>
                    </div>
                  )}

                  {/* Epistemic note */}
                  <div className="text-xs text-slate-400">
                    <span className="text-slate-500 font-medium">Verification Note:</span> {claim.confidenceNotes}
                  </div>

                  {/* Source Document Citation Strip */}
                  {doc && (
                    <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400">
                      <div className="flex flex-wrap items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-slate-300 font-medium">{doc.title}</span>
                        <span className="text-slate-600">·</span>
                        <span className="font-mono text-slate-400">{doc.reportingPeriod}</span>
                        <span className="text-slate-600">·</span>
                        <span className="font-mono text-slate-400">Filing: {doc.publicationDate}</span>
                        {doc.isAudited && (
                          <span className="text-emerald-400 flex items-center gap-1 font-mono">
                            <CheckCircle2 className="w-3 h-3" /> Audited
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => onInspectDocument(doc)}
                        className="text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 whitespace-nowrap self-start sm:self-auto"
                      >
                        Inspect Filing Accession <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Source Documents View */
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Showing {filteredDocuments.length} registered statutory documents</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredDocuments.map(doc => {
              const findingsForDoc = SYNTHETIC_EVIDENCE_FINDINGS.filter(f => f.sourceDocId === doc.id);

              return (
                <div
                  key={doc.id}
                  className="rounded-lg border border-slate-800 bg-slate-900/40 p-5 space-y-3 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider">
                        {doc.sourceType.replace('_', ' ')}
                      </div>
                      <h3 className="text-sm font-bold text-white">
                        {doc.title}
                      </h3>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                      doc.isAudited
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {doc.isAudited ? 'Audited' : 'Unaudited'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <Building className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-slate-400">Authority:</span>
                      <span className="text-slate-200">{doc.sourceName}</span>
                    </div>

                    <div className="flex items-center gap-2 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-slate-400 font-sans">Period:</span>
                      <span className="text-slate-200">{doc.reportingPeriod}</span>
                      <span className="text-slate-500">·</span>
                      <span className="text-slate-400 font-sans">Pub:</span>
                      <span className="text-slate-200">{doc.publicationDate}</span>
                    </div>

                    <div className="text-[11px] font-mono text-slate-400 bg-slate-950 p-2 rounded border border-slate-800/80 truncate">
                      {doc.identifier}
                    </div>
                  </div>

                  {doc.notes && (
                    <p className="text-xs text-slate-400 leading-relaxed bg-slate-900/70 p-2.5 rounded border border-slate-800/80">
                      {doc.notes}
                    </p>
                  )}

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-mono">
                      {findingsForDoc.length} Extracted {findingsForDoc.length === 1 ? 'Finding' : 'Findings'}
                    </span>
                    <button
                      onClick={() => onInspectDocument(doc)}
                      className="text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
                    >
                      <span>Full Accession Card</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
