/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Header, ActiveTab } from './components/Header';
import { PortfolioOverview } from './components/PortfolioOverview';
import { AssetResearch } from './components/AssetResearch';
import { DecisionReview } from './components/DecisionReview';
import { EvidenceExplorer } from './components/EvidenceExplorer';
import { DecisionProtocolView } from './components/DecisionProtocolView';
import { DocumentInspectorModal } from './components/DocumentInspectorModal';
import { EvaluateThesisModal } from './components/EvaluateThesisModal';
import { CloudSessionModal } from './components/CloudSessionModal';
import { SourceDocument, PortfolioSessionState } from './types/investment';
import {
  validateSnapshotFile,
  parseAndAdaptSnapshotJson,
  getInitialSyntheticSessionState
} from './utils/snapshotLoader';
import { createCloudSessionManager, CloudSessionManager } from './services/cloudSessionManager';
import { AlertOctagon } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [sessionState, setSessionState] = useState<PortfolioSessionState>(() => getInitialSyntheticSessionState());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const holdings = sessionState.holdings;
  const portfolioSummary = sessionState.summary;
  const dataSource = sessionState.dataSource;
  const purchaseRecommendations = sessionState.purchaseRecommendations;

  const [selectedHoldingId, setSelectedHoldingId] = useState<string>(() => holdings[0]?.id || '');
  const [inspectingDocument, setInspectingDocument] = useState<SourceDocument | null>(null);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState<boolean>(false);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState<boolean>(false);

  // In-memory Cloud Session Manager instance
  const sessionManagerRef = useRef<CloudSessionManager | null>(null);
  if (!sessionManagerRef.current) {
    sessionManagerRef.current = createCloudSessionManager();
  }
  const sessionManager = sessionManagerRef.current;

  // Track whether an in-memory token exists for header badge
  const [hasCloudToken, setHasCloudToken] = useState<boolean>(() => sessionManager.getIdentityService().hasToken());

  useEffect(() => {
    const unsubscribe = sessionManager.getIdentityService().onTokenChange((token) => {
      setHasCloudToken(Boolean(token));
    });
    return unsubscribe;
  }, [sessionManager]);

  // Dynamic active holding resolution
  const activeHoldingId = holdings.some(h => h.id === selectedHoldingId)
    ? selectedHoldingId
    : (holdings[0]?.id || '');

  const handleSelectHolding = (id: string) => {
    setSelectedHoldingId(id);
    setActiveTab('research');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateToDecision = (holdingId: string) => {
    setSelectedHoldingId(holdingId);
    setActiveTab('decisions');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoadSnapshotFile = async (file: File) => {
    // 1. Validate file size and format before reading
    const fileError = validateSnapshotFile(file);
    if (fileError) {
      setErrorMessage(fileError);
      return;
    }

    try {
      // 2. Read as text using browser native File API
      const text = await file.text();

      // 3. Parse JSON & execute adapter contract validation
      const parseResult = parseAndAdaptSnapshotJson(text, file.name);
      if (!parseResult.success) {
        setErrorMessage(parseResult.error);
        return;
      }

      // 4. Atomic state update (Discriminated local_snapshot session)
      setSessionState(parseResult.state);
      setErrorMessage(null);

      // 5. Select first holding of the newly loaded portfolio
      const firstHoldingId = parseResult.state.holdings[0]?.id || '';
      setSelectedHoldingId(firstHoldingId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Failed to read snapshot file: ${msg}`);
    }
  };

  const handleResetToDemo = () => {
    // If resetting while in cloud_live mode, also clear in-memory token
    if (sessionState.mode === 'cloud_live') {
      sessionManager.signOut(sessionState, setSessionState);
    } else {
      const syntheticState = getInitialSyntheticSessionState();
      setSessionState(syntheticState);
      setErrorMessage(null);
      setSelectedHoldingId(syntheticState.holdings[0]?.id || '');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Bar Navigation */}
      <Header
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        reviewQueueCount={portfolioSummary.reviewQueueCount}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
        dataSource={dataSource}
        provenanceFilename={sessionState.mode === 'local_snapshot' ? sessionState.provenanceFilename : undefined}
        onLoadSnapshotFile={handleLoadSnapshotFile}
        onResetToDemo={handleResetToDemo}
        onOpenCloudModal={() => setIsCloudModalOpen(true)}
        hasCloudToken={hasCloudToken}
      />

      {/* Snapshot Validation Error Banner */}
      {errorMessage && (
        <div className="bg-rose-950/90 border-b border-rose-800 px-6 py-2.5 text-xs text-rose-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 max-w-5xl">
            <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-semibold text-white shrink-0">Snapshot Loading Rejected:</span>
            <span className="text-rose-200 font-mono text-[11px] break-all">{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-white font-semibold text-xs px-2 py-0.5 rounded bg-rose-900/50 hover:bg-rose-900 border border-rose-700/60 transition-colors shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-6">
        {activeTab === 'overview' && (
          <PortfolioOverview
            holdings={holdings}
            summary={portfolioSummary}
            onSelectHolding={handleSelectHolding}
            onNavigateToDecisions={() => setActiveTab('decisions')}
            onNavigateToEvidence={() => setActiveTab('evidence')}
            dataSource={dataSource}
            purchaseRecommendations={purchaseRecommendations}
          />
        )}

        {activeTab === 'research' && (
          <AssetResearch
            holdings={holdings}
            selectedHoldingId={activeHoldingId}
            onSelectHolding={setSelectedHoldingId}
            onNavigateToDecision={handleNavigateToDecision}
            onInspectDocument={(doc) => setInspectingDocument(doc)}
            dataSource={dataSource}
          />
        )}

        {activeTab === 'decisions' && (
          <DecisionReview
            holdings={holdings}
            onSelectHoldingForResearch={handleSelectHolding}
            onInspectDocument={(doc) => setInspectingDocument(doc)}
          />
        )}

        {activeTab === 'evidence' && (
          <EvidenceExplorer
            holdings={holdings}
            onSelectHolding={handleSelectHolding}
            onInspectDocument={(doc) => setInspectingDocument(doc)}
            dataSource={dataSource}
          />
        )}

        {activeTab === 'protocol' && (
          <DecisionProtocolView
            onOpenSimulator={() => setIsSimulatorOpen(true)}
          />
        )}
      </main>

      {/* Primary Modals */}
      <DocumentInspectorModal
        document={inspectingDocument}
        onClose={() => setInspectingDocument(null)}
      />

      <EvaluateThesisModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        holdings={holdings}
        initialHoldingId={activeHoldingId}
      />

      {/* Cloud Session Modal */}
      <CloudSessionModal
        isOpen={isCloudModalOpen}
        onClose={() => setIsCloudModalOpen(false)}
        sessionManager={sessionManager}
        sessionState={sessionState}
        onSessionStateChange={setSessionState}
      />

      {/* Quiet Footer adhering to Frontend Design Constitution */}
      <footer className="border-t border-slate-900 bg-slate-950 px-6 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">Investment Intelligence</span>
            <span>·</span>
            <span>Deterministic Long-Term Decision Support</span>
            <span>·</span>
            <span className="font-mono text-slate-400">v2026.1</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span>{dataSource.label}</span>
            <span>·</span>
            {sessionState.mode === 'local_snapshot' && (
              <>
                <span className="text-sky-400 font-mono">Provenance: {sessionState.provenanceFilename}</span>
                <span>·</span>
              </>
            )}
            {sessionState.mode === 'cloud_live' && (
              <>
                <span className="text-sky-400 font-mono">Cloud Live (In-Memory Auth)</span>
                <span>·</span>
              </>
            )}
            <span>No Automated Trading</span>
            <span>·</span>
            <span>Non-Custodial</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
