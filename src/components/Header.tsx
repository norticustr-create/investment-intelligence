/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';
import {
  ShieldCheck,
  BookOpen,
  Layers,
  Compass,
  Cpu,
  AlertTriangle,
  Upload,
  RotateCcw,
  FileText,
  Cloud
} from 'lucide-react';
import { DataSourceMetadata } from '../types/investment';

export type ActiveTab = 'overview' | 'research' | 'decisions' | 'evidence' | 'protocol';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  reviewQueueCount: number;
  onOpenSimulator: () => void;
  dataSource?: DataSourceMetadata;
  provenanceFilename?: string;
  onLoadSnapshotFile?: (file: File) => void;
  onResetToDemo?: () => void;
  onOpenCloudModal?: () => void;
  hasCloudToken?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  reviewQueueCount,
  onOpenSimulator,
  dataSource,
  provenanceFilename,
  onLoadSnapshotFile,
  onResetToDemo,
  onOpenCloudModal,
  hasCloudToken
}) => {
  const isCloudLive = dataSource?.mode === 'cloud_live';
  const isReal = dataSource?.mode === 'local_snapshot';
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onLoadSnapshotFile) {
      onLoadSnapshotFile(file);
    }
    // Clear value so the same file can be selected again
    e.target.value = '';
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur border-b border-slate-800">
      {/* Native hidden file input for offline JSON snapshot loading */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Load local portfolio snapshot JSON"
      />

      {/* Data Source Notice Banner */}
      <div className="bg-slate-900/80 border-b border-slate-800/80 px-4 py-1.5 text-xs text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`font-semibold flex items-center gap-1 ${
            isCloudLive ? 'text-sky-300' : isReal ? 'text-sky-400' : 'text-amber-400'
          }`}>
            {isCloudLive ? (
              <Cloud className="w-3.5 h-3.5 text-sky-400" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5" />
            )}
            {dataSource?.label ?? (isCloudLive ? 'CLOUD LIVE SNAPSHOT' : 'Synthetic Demonstration Data')}
          </span>
          <span className="text-slate-500">·</span>
          <span className="truncate max-w-2xl">{dataSource?.description ?? 'All holdings, financial metrics, and filings are realistic synthetic models illustrating long-term decision-support protocols.'}</span>
        </div>
        <div className="hidden md:flex items-center gap-3 text-slate-400 shrink-0">
          <span className="text-slate-300 font-mono text-[11px] bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
            Authoritative: {dataSource?.reportingCurrency ?? 'TRY'}
          </span>
          <span className="text-slate-600">/</span>
          <span>Non-Custodial</span>
          <span className="text-slate-600">/</span>
          <span className="text-slate-300 font-mono">
            {dataSource?.asOfDate ? `As of ${dataSource.asOfDate}` : '2026 Edition'}
          </span>
        </div>
      </div>

      {/* Strict 3-Zone Top Bar Contract */}
      <div className="flex items-center justify-between gap-6 px-6 py-3 max-w-7xl mx-auto">
        {/* Zone 1: Single text element wordmark */}
        <button
          onClick={() => onTabChange('overview')}
          className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 hover:text-slate-200 transition-colors flex items-center gap-2"
        >
          <div className="w-7 h-7 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <span>Investment Intelligence</span>
        </button>

        {/* Zone 2: 4-5 single-line clean text navigation links */}
        <nav className="hidden lg:flex items-center gap-5 text-sm font-medium text-slate-300">
          <button
            onClick={() => onTabChange('overview')}
            className={`whitespace-nowrap shrink-0 transition-colors pb-0.5 border-b-2 flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'border-emerald-400 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            Portfolio Overview
          </button>

          <button
            onClick={() => onTabChange('research')}
            className={`whitespace-nowrap shrink-0 transition-colors pb-0.5 border-b-2 flex items-center gap-1.5 ${
              activeTab === 'research'
                ? 'border-emerald-400 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Asset Research
          </button>

          <button
            onClick={() => onTabChange('decisions')}
            className={`whitespace-nowrap shrink-0 transition-colors pb-0.5 border-b-2 flex items-center gap-1.5 relative ${
              activeTab === 'decisions'
                ? 'border-emerald-400 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Compass className="w-4 h-4" />
            Decision Review
            {reviewQueueCount > 0 && (
              <span className="ml-1 text-[11px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {reviewQueueCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onTabChange('evidence')}
            className={`whitespace-nowrap shrink-0 transition-colors pb-0.5 border-b-2 flex items-center gap-1.5 ${
              activeTab === 'evidence'
                ? 'border-emerald-400 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Evidence Explorer
          </button>

          <button
            onClick={() => onTabChange('protocol')}
            className={`whitespace-nowrap shrink-0 transition-colors pb-0.5 border-b-2 flex items-center gap-1.5 ${
              activeTab === 'protocol'
                ? 'border-emerald-400 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Cpu className="w-4 h-4" />
            Decision Rules Protocol
          </button>
        </nav>

        {/* Zone 3: Primary Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          {isCloudLive ? (
            /* Cloud Live Mode Actions */
            <div className="flex items-center gap-2">
              <div
                className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono bg-sky-950/70 border border-sky-800/60 rounded text-sky-300"
                title="Active live snapshot loaded from InvestmentAgentCloud"
              >
                <Cloud className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="truncate max-w-[130px]">Cloud Live</span>
                <span className="text-[10px] px-1 py-0.2 rounded bg-sky-900/80 text-sky-200 font-sans uppercase font-semibold">
                  Read-Only
                </span>
              </div>

              {onOpenCloudModal && (
                <button
                  onClick={onOpenCloudModal}
                  className="px-2.5 py-1.5 text-xs font-semibold text-sky-300 hover:text-white bg-sky-950/50 hover:bg-sky-900/60 border border-sky-800/60 rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5"
                  title="Manage Cloud Sync / Refresh Snapshot"
                >
                  <Cloud className="w-3.5 h-3.5 text-sky-400" />
                  <span>Cloud Sync</span>
                </button>
              )}

              <button
                onClick={onResetToDemo}
                className="px-2.5 py-1.5 text-xs font-semibold text-amber-300 hover:text-amber-200 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-800/60 rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5"
                title="Reset active portfolio to synthetic demonstration data"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Demo</span>
              </button>
            </div>
          ) : isReal ? (
            /* Local Snapshot Mode Actions */
            <div className="flex items-center gap-2">
              <div
                className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono bg-sky-950/70 border border-sky-800/60 rounded text-sky-300"
                title={`Loaded file: ${provenanceFilename || 'snapshot.json'}`}
              >
                <FileText className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="truncate max-w-[130px]">{provenanceFilename || 'snapshot.json'}</span>
                <span className="text-[10px] px-1 py-0.2 rounded bg-sky-900/80 text-sky-200 font-sans uppercase font-semibold">
                  Read-Only
                </span>
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5"
                title="Load a different snapshot JSON file"
              >
                <Upload className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden sm:inline">Change Snapshot</span>
              </button>

              {onOpenCloudModal && (
                <button
                  onClick={onOpenCloudModal}
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5"
                  title="Open Cloud Portfolio Sync"
                >
                  <Cloud className="w-3.5 h-3.5 text-sky-400" />
                  <span className="hidden md:inline">Cloud Sync</span>
                </button>
              )}

              <button
                onClick={onResetToDemo}
                className="px-2.5 py-1.5 text-xs font-semibold text-amber-300 hover:text-amber-200 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-800/60 rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5"
                title="Reset active portfolio to synthetic demonstration data"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Demo</span>
              </button>
            </div>
          ) : (
            /* Synthetic Demo Mode Actions */
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 text-xs font-semibold text-sky-300 hover:text-sky-200 bg-sky-950/50 hover:bg-sky-900/60 border border-sky-800/60 rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 shadow-xs"
                title="Load local Python InvestmentAgent JSON snapshot (read-only)"
              >
                <Upload className="w-3.5 h-3.5 text-sky-400" />
                <span>Load Local Snapshot</span>
              </button>

              {onOpenCloudModal && (
                <button
                  onClick={onOpenCloudModal}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5"
                  title="Open Cloud Portfolio Sync"
                >
                  <Cloud className="w-3.5 h-3.5 text-sky-400" />
                  <span>Cloud Sync</span>
                  {hasCloudToken && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  )}
                </button>
              )}
            </div>
          )}

          <button
            onClick={onOpenSimulator}
            className="px-3 py-1.5 text-xs font-semibold text-slate-900 bg-emerald-400 hover:bg-emerald-300 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 shadow-sm"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Evaluate Thesis</span>
          </button>
        </div>
      </div>

      {/* Mobile navigation row */}
      <div className="lg:hidden flex items-center justify-between gap-2 overflow-x-auto px-4 py-2 bg-slate-900/60 border-t border-slate-800 text-xs text-slate-300 scrollbar-none">
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onTabChange('overview')}
            className={`px-2.5 py-1.5 rounded whitespace-nowrap shrink-0 ${
              activeTab === 'overview' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => onTabChange('research')}
            className={`px-2.5 py-1.5 rounded whitespace-nowrap shrink-0 ${
              activeTab === 'research' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'
            }`}
          >
            Research
          </button>
          <button
            onClick={() => onTabChange('decisions')}
            className={`px-2.5 py-1.5 rounded whitespace-nowrap shrink-0 ${
              activeTab === 'decisions' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'
            }`}
          >
            Decisions ({reviewQueueCount})
          </button>
          <button
            onClick={() => onTabChange('evidence')}
            className={`px-2.5 py-1.5 rounded whitespace-nowrap shrink-0 ${
              activeTab === 'evidence' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'
            }`}
          >
            Evidence
          </button>
          <button
            onClick={() => onTabChange('protocol')}
            className={`px-2.5 py-1.5 rounded whitespace-nowrap shrink-0 ${
              activeTab === 'protocol' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'
            }`}
          >
            Rules Protocol
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onOpenCloudModal && (
            <button
              onClick={onOpenCloudModal}
              className="px-2 py-1 text-[11px] font-semibold text-sky-300 bg-sky-950/50 border border-sky-800/60 rounded flex items-center gap-1"
            >
              <Cloud className="w-3 h-3 text-sky-400" />
              <span>Cloud</span>
            </button>
          )}

          {isCloudLive || isReal ? (
            <button
              onClick={onResetToDemo}
              className="px-2 py-1 text-[11px] font-semibold text-amber-300 bg-amber-950/40 border border-amber-800/60 rounded"
            >
              Reset Demo
            </button>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-2 py-1 text-[11px] font-semibold text-sky-300 bg-sky-950/50 border border-sky-800/60 rounded flex items-center gap-1"
            >
              <Upload className="w-3 h-3" />
              <span>Snapshot</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
