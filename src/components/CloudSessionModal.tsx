/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Cloud Session Modal
 * ===================
 * Interactive management panel for:
 * 1. Google Identity Services (GIS) Sign-In (in-memory bearer ID token).
 * 2. Cloud portfolio snapshot retrieval (GET /api/snapshot).
 * 3. Session mode status (Synthetic Demo, Local Snapshot, Cloud Live).
 * 4. Cold-start feedback & retry controls.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Cloud,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  RotateCw,
  LogOut,
  X,
  Layers,
  FileText,
  DollarSign,
  Loader2
} from 'lucide-react';
import { CloudSessionManager, CloudSessionManagerState } from '../services/cloudSessionManager';
import { PortfolioSessionState } from '../types/investment';
import { getCloudConfig } from '../config/cloudConfig';

interface CloudSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionManager: CloudSessionManager;
  sessionState: PortfolioSessionState;
  onSessionStateChange: (newState: PortfolioSessionState) => void;
}

export const CloudSessionModal: React.FC<CloudSessionModalProps> = ({
  isOpen,
  onClose,
  sessionManager,
  sessionState,
  onSessionStateChange
}) => {
  const [managerState, setManagerState] = useState<CloudSessionManagerState>(() => ({
    authStatus: sessionManager.getIdentityService().getStatus(),
    authError: sessionManager.getIdentityService().getErrorMessage(),
    hasToken: sessionManager.getIdentityService().hasToken(),
    isFetching: sessionManager.getIsFetching(),
    error: sessionManager.getCurrentError(),
    activeSessionMode: sessionState.mode
  }));

  const [budgetInput, setBudgetInput] = useState<string>('');
  const googleBtnRef = useRef<HTMLDivElement | null>(null);
  const cloudConfig = getCloudConfig();

  // Subscribe to session manager state changes
  useEffect(() => {
    const unsubscribe = sessionManager.onStateChange((newState) => {
      setManagerState({
        ...newState,
        activeSessionMode: sessionState.mode
      });
    });
    return unsubscribe;
  }, [sessionManager, sessionState.mode]);

  // Attempt GIS initialization on mount or open
  useEffect(() => {
    if (isOpen) {
      sessionManager.initialize().catch(() => {
        // Safe ignore
      });
    }
  }, [isOpen, sessionManager]);

  // Render Google Sign-In button when ready_signed_out
  useEffect(() => {
    if (isOpen && googleBtnRef.current && managerState.authStatus === 'ready_signed_out') {
      googleBtnRef.current.innerHTML = '';
      sessionManager.getIdentityService().renderButton(googleBtnRef.current, {
        theme: 'filled_black',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular'
      });
    }
  }, [isOpen, managerState.authStatus, sessionManager]);

  if (!isOpen) return null;

  const handleFetchSnapshot = async () => {
    const budgetNum = budgetInput.trim() ? Number(budgetInput) : undefined;
    await sessionManager.loadCloudPortfolio(sessionState, onSessionStateChange, {
      budget: budgetNum
    });
  };

  const handleSignOut = () => {
    sessionManager.signOut(sessionState, onSessionStateChange);
  };

  const isCloudLive = sessionState.mode === 'cloud_live';
  const isLocalSnapshot = sessionState.mode === 'local_snapshot';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
      <div
        className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-labelledby="cloud-modal-title"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-950 border border-sky-800/80 flex items-center justify-center text-sky-400">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <h2 id="cloud-modal-title" className="text-base font-bold text-white tracking-tight">
                Cloud Portfolio Integration
              </h2>
              <p className="text-xs text-slate-400">
                Read-Only Live Sync with InvestmentAgentCloud
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Current Session Mode Status Card */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-4">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <span>Active Session State</span>
            </div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                {isCloudLive ? (
                  <span className="px-2.5 py-1 text-xs font-semibold bg-sky-950 text-sky-300 border border-sky-800 rounded flex items-center gap-1.5 font-mono">
                    <Cloud className="w-3.5 h-3.5 text-sky-400" />
                    CLOUD LIVE SNAPSHOT
                  </span>
                ) : isLocalSnapshot ? (
                  <span className="px-2.5 py-1 text-xs font-semibold bg-sky-950/70 text-sky-300 border border-sky-800/80 rounded flex items-center gap-1.5 font-mono">
                    <FileText className="w-3.5 h-3.5 text-sky-400" />
                    LOCAL SNAPSHOT ({sessionState.provenanceFilename})
                  </span>
                ) : (
                  <span className="px-2.5 py-1 text-xs font-semibold bg-amber-950/70 text-amber-300 border border-amber-800/80 rounded flex items-center gap-1.5 font-mono">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    SYNTHETIC DEMO
                  </span>
                )}
                <span className="text-xs text-slate-400">
                  Authoritative: <strong className="text-slate-200">TRY</strong>
                </span>
              </div>
              <span className="text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-900/60 px-2 py-0.5 rounded font-mono">
                Automated Execution Blocked
              </span>
            </div>
          </div>

          {/* Google Identity Services Section */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Google Identity Authentication</span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">In-Memory Token</span>
            </div>

            {/* Unconfigured State (Placeholder) */}
            {!cloudConfig.isConfigured && (
              <div className="bg-amber-950/30 border border-amber-800/60 rounded-md p-3 text-xs text-amber-200 space-y-1.5">
                <div className="font-semibold flex items-center gap-1.5 text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>OAuth Client ID Unconfigured (Placeholder)</span>
                </div>
                <p className="text-amber-200/90 leading-relaxed">
                  The client ID is currently configured as a placeholder (<code className="font-mono text-[11px] bg-amber-900/40 px-1 py-0.5 rounded">{cloudConfig.googleClientId}</code>).
                </p>
                <div className="text-[11px] text-amber-300/80 pt-1 border-t border-amber-900/40">
                  To connect to a live backend, provide <code className="font-mono text-amber-200">VITE_GOOGLE_CLIENT_ID</code> and configure Authorized JavaScript Origins in Google Cloud Console.
                </div>
              </div>
            )}

            {/* Script Load Error */}
            {managerState.authStatus === 'script_error' && (
              <div className="bg-rose-950/40 border border-rose-800 rounded-md p-3 text-xs text-rose-200 space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-rose-300">
                  <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Google Identity Services Unavailable</span>
                </div>
                <p className="text-rose-200/90">{managerState.authError}</p>
                <button
                  onClick={() => sessionManager.initialize()}
                  className="mt-2 text-xs text-rose-300 hover:text-white px-2 py-1 rounded bg-rose-900/50 border border-rose-700/60 transition-colors"
                >
                  Retry Script Load
                </button>
              </div>
            )}

            {/* Signed-In State */}
            {managerState.hasToken ? (
              <div className="flex items-center justify-between p-3 bg-slate-900 border border-slate-700/80 rounded-md">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-white">Google Identity Connected</div>
                    <div className="text-[11px] text-slate-400 font-mono">Bearer ID Token Held in Memory</div>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="px-2.5 py-1.5 text-xs font-semibold text-rose-300 hover:text-rose-200 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/60 rounded transition-colors flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              /* Signed-Out State */
              <div className="space-y-2">
                <p className="text-xs text-slate-400">
                  Sign in with your authorized Google account to request an ID token. Tokens are held in memory only and never written to browser storage.
                </p>
                <div ref={googleBtnRef} className="pt-1 flex items-center justify-start min-h-[44px]">
                  {managerState.authStatus === 'script_loading' && (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                      <span>Loading Google Identity Services...</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Cloud Portfolio Fetch Section */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-4 space-y-4">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Cloud className="w-3.5 h-3.5 text-sky-400" />
              <span>Snapshot Retrieval (GET /api/snapshot)</span>
            </div>

            <div className="space-y-2">
              <label htmlFor="budget-input" className="block text-xs font-medium text-slate-300">
                Optional Monthly Budget (TRY)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <DollarSign className="w-3.5 h-3.5" />
                </div>
                <input
                  id="budget-input"
                  type="number"
                  min="1"
                  max="100000000"
                  step="1000"
                  placeholder="e.g. 50000 (Optional)"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  disabled={managerState.isFetching}
                  className="w-full bg-slate-900 border border-slate-700 rounded-md pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500 font-mono disabled:opacity-50"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Leave blank to query existing portfolio allocations without additional capital deployment.
              </p>
            </div>

            {/* In-Flight Cold Start Notice */}
            {managerState.isFetching && (
              <div className="bg-sky-950/40 border border-sky-800/80 rounded-md p-3 text-xs text-sky-200 flex items-start justify-between gap-3 animate-pulse">
                <div className="flex items-start gap-2.5">
                  <Loader2 className="w-4 h-4 text-sky-400 animate-spin shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-white">Contacting Cloud Backend...</div>
                    <div className="text-sky-300/80 text-[11px] mt-0.5">
                      Render services may experience a cold-start delay of up to 45 seconds while starting container instances.
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => sessionManager.cancelFetch()}
                  className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 shrink-0 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Error Banner */}
            {managerState.error && (
              <div className="bg-rose-950/60 border border-rose-800 rounded-md p-3 text-xs text-rose-200 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-rose-300">
                        {managerState.error.kind === 'FORBIDDEN' ? 'Access Denied (403)' : 'Cloud Request Error'}
                      </div>
                      <div className="text-rose-200 font-mono text-[11px] mt-0.5">
                        {managerState.error.message}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => sessionManager.clearError()}
                    className="text-rose-400 hover:text-white text-xs px-1.5 py-0.5"
                  >
                    Dismiss
                  </button>
                </div>

                {managerState.error.canRetry && (
                  <div className="pt-2 border-t border-rose-900/60 flex items-center justify-end">
                    <button
                      onClick={handleFetchSnapshot}
                      disabled={managerState.isFetching}
                      className="px-2.5 py-1 text-xs font-semibold text-white bg-rose-900 hover:bg-rose-800 border border-rose-700 rounded transition-colors flex items-center gap-1.5"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Retry Request</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                Close
              </button>

              <button
                onClick={handleFetchSnapshot}
                disabled={!managerState.hasToken || managerState.isFetching}
                className={`px-4 py-2 text-xs font-semibold rounded-md transition-all flex items-center gap-2 shadow-sm ${
                  !managerState.hasToken || managerState.isFetching
                    ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                    : 'bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold'
                }`}
              >
                {managerState.isFetching ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading Snapshot...</span>
                  </>
                ) : isCloudLive ? (
                  <>
                    <RotateCw className="w-4 h-4" />
                    <span>Refresh Cloud Snapshot</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-4 h-4" />
                    <span>Load Cloud Portfolio</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer Safeguards */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 text-[11px] text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">Safeguards:</span>
            <span>Non-Custodial</span>
            <span>·</span>
            <span>No Automated Trading</span>
            <span>·</span>
            <span>Zero Token Storage</span>
          </div>
          <span className="font-mono text-slate-600">v1.0.0 Snapshot Protocol</span>
        </div>
      </div>
    </div>
  );
};
