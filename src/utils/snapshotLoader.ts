/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Snapshot Loader & State Integration Utility
 * ============================================
 * Provides user-initiated, fully offline parsing, validation, and atomic
 * session state derivation for Python InvestmentAgent JSON snapshots.
 *
 * Strict Architectural Guarantees:
 * 1. Offline only: Zero network, zero remote fetch, zero server communication.
 * 2. In-memory only: Zero localStorage, IndexedDB, cookies, or disk persistence.
 * 3. File size bound: Rejects payloads exceeding MAX_SNAPSHOT_FILE_SIZE (10 MB).
 * 4. Fail-closed: On any parsing, schema, or invariant failure, returns an explicit
 *    error message without mutating existing application state.
 * 5. Atomic state bundling: Keeps holdings, summary, recommendations, and metadata
 *    strictly together in a single discriminated PortfolioSessionState.
 * 6. Non-custodial & non-executable: automatedTradeExecutionBlocked remains permanently true.
 */

import {
  PortfolioSessionState,
  DataSourceMetadata,
  DEFAULT_SYNTHETIC_DATA_SOURCE,
  Holding
} from '../types/investment';
import {
  SYNTHETIC_HOLDINGS,
  calculatePortfolioSummary
} from '../data/syntheticPortfolio';
import {
  adaptPortfolioSnapshot,
  SnapshotValidationError,
  SnapshotAdapterResult
} from '../adapters/investmentAgentAdapter';

export const MAX_SNAPSHOT_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export interface FileValidationTarget {
  name?: string;
  size?: number;
}

/**
 * Validates file metadata before reading content into memory.
 * Returns null if valid; returns a concise, actionable error string if rejected.
 */
export function validateSnapshotFile(file: FileValidationTarget | null | undefined): string | null {
  if (!file) {
    return 'No file selected for snapshot loading.';
  }

  if (typeof file.name !== 'string' || !file.name.trim()) {
    return 'Invalid file: Filename is missing or unpopulated.';
  }

  const normalizedName = file.name.trim().toLowerCase();
  if (!normalizedName.endsWith('.json')) {
    return `Invalid file format "${file.name}". Only JSON snapshot files (.json) are supported.`;
  }

  if (typeof file.size === 'number') {
    if (!Number.isFinite(file.size) || file.size < 0) {
      return 'Invalid file: File size is invalid or negative.';
    }
    if (file.size > MAX_SNAPSHOT_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      return `File size (${sizeMB} MB) exceeds maximum allowable limit of 10 MB.`;
    }
  }

  return null;
}

export type SnapshotParseResult =
  | {
      success: true;
      adapterResult: SnapshotAdapterResult;
      state: PortfolioSessionState;
      disclosures: string[];
    }
  | {
      success: false;
      error: string;
    };

/**
 * Parses raw JSON text, executes full adapter contract validation, and builds
 * an atomic PortfolioSessionState in local_snapshot mode.
 * Untrusted input is strictly validated inside guarded error boundaries.
 */
export function parseAndAdaptSnapshotJson(
  rawText: string,
  provenanceFilename?: string
): SnapshotParseResult {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return {
      success: false,
      error: 'Snapshot file is empty or contains only whitespace.'
    };
  }

  // 1. Guarded JSON parse
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch (err: unknown) {
    const syntaxMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Malformed JSON: ${syntaxMsg}`
    };
  }

  // 2. Adapter contract validation
  let adapterResult: SnapshotAdapterResult;
  try {
    adapterResult = adaptPortfolioSnapshot(parsedJson);
  } catch (err: unknown) {
    if (err instanceof SnapshotValidationError) {
      return {
        success: false,
        error: `Snapshot Validation Error (${err.field}): ${err.message}`
      };
    }
    const genericMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Snapshot Adapter Error: ${genericMsg}`
    };
  }

  // 3. Post-adaptation invariant checks
  if (adapterResult.holdings.length === 0) {
    return {
      success: false,
      error: 'Snapshot contains 0 positions. Empty portfolios are not permitted.'
    };
  }

  if (!Number.isFinite(adapterResult.summary.totalValueTRY) || adapterResult.summary.totalValueTRY < 0) {
    return {
      success: false,
      error: 'Total portfolio value in TRY must be a non-negative finite number.'
    };
  }

  if (adapterResult.automatedTradeExecutionBlocked !== true) {
    return {
      success: false,
      error: 'Security Invariant Violation: automatedTradeExecutionBlocked must be true.'
    };
  }

  // 4. Construct validated snapshot metadata
  const cleanFilename = provenanceFilename && typeof provenanceFilename === 'string' && provenanceFilename.trim()
    ? provenanceFilename.trim()
    : 'local_snapshot.json';

  const snapshotDataSource: DataSourceMetadata = {
    mode: 'local_snapshot',
    label: 'LOCAL AGENT SNAPSHOT',
    description: `Ingested from ${adapterResult.exportMetadata.sourceWorksheet} via ${adapterResult.exportMetadata.sourceSystem} (${adapterResult.exportMetadata.engineVersion}). Read-only mode with automated execution blocked.`,
    sourceSystem: adapterResult.exportMetadata.sourceSystem,
    sourceWorksheet: adapterResult.exportMetadata.sourceWorksheet,
    asOfDate: adapterResult.exportMetadata.asOfDate,
    engineVersion: adapterResult.exportMetadata.engineVersion,
    reportingCurrency: 'TRY'
  };

  const localState: PortfolioSessionState = {
    mode: 'local_snapshot',
    dataSource: snapshotDataSource,
    holdings: adapterResult.holdings,
    summary: adapterResult.summary,
    purchaseRecommendations: adapterResult.purchaseRecommendations,
    validationDisclosures: adapterResult.validationDisclosures,
    provenanceFilename: cleanFilename
  };

  return {
    success: true,
    adapterResult,
    state: localState,
    disclosures: adapterResult.validationDisclosures
  };
}

/**
 * Returns the default atomic state bundle for synthetic demonstration mode.
 */
export function getInitialSyntheticSessionState(): PortfolioSessionState {
  const summary = calculatePortfolioSummary(SYNTHETIC_HOLDINGS);
  return {
    mode: 'synthetic_demonstration',
    dataSource: DEFAULT_SYNTHETIC_DATA_SOURCE,
    holdings: SYNTHETIC_HOLDINGS,
    summary,
    purchaseRecommendations: [],
    validationDisclosures: []
  };
}
