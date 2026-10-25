/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Cloud Session Manager
 * =====================
 * Coordinates Google Identity Services (GIS), the Cloud API Client,
 * and React PortfolioSessionState.
 *
 * Core Guarantees:
 * 1. Concurrency Guard: Prevents uncontrolled duplicate concurrent requests.
 * 2. Non-Destructive Failures: Network, timeout, or auth errors NEVER mutate
 *    or wipe out the active session state (demo or local snapshot).
 * 3. In-Memory Security: No token is ever stored in persistent web storage.
 * 4. Explicit Sign-Out: Purges token and transitions cloud session back to demo.
 * 5. Deterministic Retry: Failed requests can be explicitly retried by the user.
 */

import { GoogleIdentityService, GoogleIdentityStatus } from './googleIdentityService';
import { CloudApiClient, CloudApiError, createCloudApiClient } from './cloudApiClient';
import { PortfolioSessionState } from '../types/investment';
import { getInitialSyntheticSessionState } from '../utils/snapshotLoader';
import { getCloudConfig, DEFAULT_CLOUD_TIMEOUT_MS } from '../config/cloudConfig';
import { integrateIntelligenceIntoHoldings } from '../adapters/investmentAgentAdapter';

export interface CloudSessionErrorState {
  message: string;
  kind: string;
  status?: number;
  canRetry: boolean;
  timestamp: string;
}

export interface CloudSessionManagerState {
  authStatus: GoogleIdentityStatus;
  authError: string | null;
  hasToken: boolean;
  isFetching: boolean;
  error: CloudSessionErrorState | null;
  activeSessionMode: 'synthetic_demonstration' | 'local_snapshot' | 'cloud_live';
}

export interface CloudSessionManagerConfig {
  client?: CloudApiClient;
  identityService?: GoogleIdentityService;
  timeoutMs?: number;
  baseUrl?: string;
  onStateChange?: (state: CloudSessionManagerState) => void;
}

export class CloudSessionManager {
  private readonly client: CloudApiClient;
  private readonly identityService: GoogleIdentityService;
  private readonly timeoutMs: number;

  private isFetching = false;
  private activeAbortController: AbortController | null = null;
  private currentError: CloudSessionErrorState | null = null;
  private stateListeners: Array<(state: CloudSessionManagerState) => void> = [];

  constructor(config: CloudSessionManagerConfig = {}) {
    const cloudConfig = getCloudConfig();

    this.timeoutMs = config.timeoutMs ?? cloudConfig.timeoutMs ?? DEFAULT_CLOUD_TIMEOUT_MS;

    this.client = config.client ?? createCloudApiClient({
      baseUrl: config.baseUrl ?? cloudConfig.baseUrl,
      timeoutMs: this.timeoutMs
    });

    this.identityService = config.identityService ?? new GoogleIdentityService({
      clientId: cloudConfig.googleClientId
    });

    if (config.onStateChange) {
      this.stateListeners.push(config.onStateChange);
    }

    // Subscribe to identity service state changes
    this.identityService.onTokenChange(() => this.notifyState());
    this.identityService.onStatusChange(() => this.notifyState());
  }

  public getIdentityService(): GoogleIdentityService {
    return this.identityService;
  }

  public getClient(): CloudApiClient {
    return this.client;
  }

  public getIsFetching(): boolean {
    return this.isFetching;
  }

  public getCurrentError(): CloudSessionErrorState | null {
    return this.currentError;
  }

  public onStateChange(listener: (state: CloudSessionManagerState) => void): () => void {
    this.stateListeners.push(listener);
    return () => {
      this.stateListeners = this.stateListeners.filter(l => l !== listener);
    };
  }

  private notifyState(activeSessionMode: 'synthetic_demonstration' | 'local_snapshot' | 'cloud_live' = 'synthetic_demonstration'): void {
    const state: CloudSessionManagerState = {
      authStatus: this.identityService.getStatus(),
      authError: this.identityService.getErrorMessage(),
      hasToken: this.identityService.hasToken(),
      isFetching: this.isFetching,
      error: this.currentError,
      activeSessionMode
    };

    for (const listener of this.stateListeners) {
      try {
        listener(state);
      } catch {
        // Prevent listener failures from interrupting flow
      }
    }
  }

  /**
   * Initializes Google Identity Services.
   */
  public async initialize(): Promise<boolean> {
    const initialized = await this.identityService.initialize();
    this.notifyState();
    return initialized;
  }

  /**
   * Explicit sign-out:
   * 1. Clears in-memory ID token via GIS.
   * 2. Clears any active error banner.
   * 3. If current session is 'cloud_live', resets session to synthetic demo.
   */
  public signOut(
    currentSession: PortfolioSessionState,
    setSessionState: (newState: PortfolioSessionState) => void
  ): void {
    this.identityService.signOut();
    this.currentError = null;

    if (currentSession.mode === 'cloud_live') {
      const syntheticState = getInitialSyntheticSessionState();
      setSessionState(syntheticState);
      this.notifyState('synthetic_demonstration');
    } else {
      this.notifyState(currentSession.mode);
    }
  }

  /**
   * Loads the protected cloud portfolio snapshot:
   * - Enforces single in-flight request (blocks concurrent duplicate requests).
   * - Enforces in-memory token requirement.
   * - Preserves current session on failure.
   * - Updates session to 'cloud_live' on success.
   */
  public async loadCloudPortfolio(
    currentSession: PortfolioSessionState,
    setSessionState: (newState: PortfolioSessionState) => void,
    options: { budget?: number } = {}
  ): Promise<{ success: boolean; error?: string; state?: PortfolioSessionState }> {
    // 1. Concurrency Guard: Block concurrent requests
    if (this.isFetching) {
      const busyMsg = 'A portfolio request is already in progress. Please wait for it to complete.';
      return { success: false, error: busyMsg };
    }

    // 2. Token Requirement Guard
    const idToken = this.identityService.getIdToken();
    if (!idToken) {
      const noTokenMsg = 'Please sign in with your authorized Google account before loading the cloud portfolio.';
      this.currentError = {
        message: noTokenMsg,
        kind: 'UNAUTHORIZED',
        status: 401,
        canRetry: false,
        timestamp: new Date().toISOString()
      };
      this.notifyState(currentSession.mode);
      return { success: false, error: noTokenMsg };
    }

    // 3. Setup Fetch Execution
    this.isFetching = true;
    this.currentError = null;
    this.activeAbortController = new AbortController();
    this.notifyState(currentSession.mode);

    try {
      const result = await this.client.fetchSnapshotSafe({
        idToken,
        budget: options.budget,
        signal: this.activeAbortController.signal
      });

      if (!result.success) {
        // Map error into user-friendly message preserving security
        const mappedError = this.mapCloudApiError(result.error);
        this.currentError = mappedError;
        // Current session is STRICTLY preserved; not replaced or cleared
        this.notifyState(currentSession.mode);
        return { success: false, error: mappedError.message };
      }

      // 4. Success: Transition to 'cloud_live' session state
      const newState = result.data.state;
      setSessionState(newState);
      this.currentError = null;
      this.notifyState('cloud_live');

      return { success: true, state: newState };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.currentError = {
        message: `Unexpected cloud error: ${msg}`,
        kind: 'UNKNOWN_ERROR',
        canRetry: true,
        timestamp: new Date().toISOString()
      };
      this.notifyState(currentSession.mode);
      return { success: false, error: msg };
    } finally {
      this.isFetching = false;
      this.activeAbortController = null;
      this.notifyState(currentSession.mode);
    }
  }

  /**
   * Fetches AI Asset Intelligence reports from GET /api/intelligence and
   * merges verified statutory/ecosystem findings and thesis evaluations
   * into active holdings.
   */
  public async fetchCloudIntelligence(
    currentSession: PortfolioSessionState,
    setSessionState: (newState: PortfolioSessionState) => void,
    options: { forceRefresh?: boolean; maxItemsPerAsset?: number } = {}
  ): Promise<{ success: boolean; error?: string; state?: PortfolioSessionState }> {
    if (this.isFetching) {
      const busyMsg = 'An intelligence analysis request is already in progress. Please wait.';
      return { success: false, error: busyMsg };
    }

    const idToken = this.identityService.getIdToken();
    if (!idToken) {
      const noTokenMsg = 'Please sign in with your authorized Google account before requesting intelligence reports.';
      this.currentError = {
        message: noTokenMsg,
        kind: 'UNAUTHORIZED',
        status: 401,
        canRetry: false,
        timestamp: new Date().toISOString()
      };
      this.notifyState(currentSession.mode);
      return { success: false, error: noTokenMsg };
    }

    this.isFetching = true;
    this.currentError = null;
    this.activeAbortController = new AbortController();

    // Mark session as loading intelligence
    const sessionWithLoading: PortfolioSessionState = {
      ...currentSession,
      intelligenceLoading: true,
      intelligenceError: null
    } as PortfolioSessionState;
    setSessionState(sessionWithLoading);
    this.notifyState(currentSession.mode);

    try {
      const result = await this.client.fetchIntelligenceSafe({
        idToken,
        forceRefresh: options.forceRefresh,
        maxItemsPerAsset: options.maxItemsPerAsset,
        signal: this.activeAbortController.signal
      });

      if (!result.success) {
        const mappedError = this.mapCloudApiError(result.error);
        this.currentError = mappedError;
        const sessionWithError: PortfolioSessionState = {
          ...currentSession,
          intelligenceLoading: false,
          intelligenceError: mappedError.message
        } as PortfolioSessionState;
        setSessionState(sessionWithError);
        this.notifyState(currentSession.mode);
        return { success: false, error: mappedError.message };
      }

      // Merge intelligence into active holdings
      const enriched = integrateIntelligenceIntoHoldings(
        currentSession.holdings,
        result.data.response.reports
      );

      const updatedSession: PortfolioSessionState = {
        ...currentSession,
        holdings: enriched.enrichedHoldings,
        summary: {
          ...currentSession.summary,
          reviewQueueCount: enriched.reviewQueueCount
        },
        intelligenceReports: result.data.response.reports,
        intelligenceLoading: false,
        intelligenceError: null,
        intelligenceCached: result.data.response.cached,
        intelligenceAsOfDate: result.data.response.as_of_date,
        liveEvidenceFindings: enriched.liveFindings,
        liveSourceDocuments: enriched.liveDocs
      } as PortfolioSessionState;

      setSessionState(updatedSession);
      this.currentError = null;
      this.notifyState(currentSession.mode);

      return { success: true, state: updatedSession };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.currentError = {
        message: `Intelligence retrieval error: ${msg}`,
        kind: 'UNKNOWN_ERROR',
        canRetry: true,
        timestamp: new Date().toISOString()
      };
      const sessionWithError: PortfolioSessionState = {
        ...currentSession,
        intelligenceLoading: false,
        intelligenceError: msg
      } as PortfolioSessionState;
      setSessionState(sessionWithError);
      this.notifyState(currentSession.mode);
      return { success: false, error: msg };
    } finally {
      this.isFetching = false;
      this.activeAbortController = null;
      this.notifyState(currentSession.mode);
    }
  }

  /**
   * User-initiated cancellation of in-flight cloud request.
   */
  public cancelFetch(): void {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
    this.isFetching = false;
    this.currentError = {
      message: 'Cloud portfolio request was cancelled by the user.',
      kind: 'CANCELLED',
      canRetry: true,
      timestamp: new Date().toISOString()
    };
    this.notifyState();
  }

  /**
   * Clear current error banner.
   */
  public clearError(): void {
    this.currentError = null;
    this.notifyState();
  }

  /**
   * Maps CloudApiError into safe, human-readable user messages without leaking sensitive internals.
   */
  private mapCloudApiError(error: CloudApiError): CloudSessionErrorState {
    const timestamp = new Date().toISOString();

    switch (error.kind) {
      case 'UNAUTHORIZED':
        return {
          message: 'Authentication rejected (401): Google ID token is invalid or expired. Please sign out and sign in again.',
          kind: error.kind,
          status: 401,
          canRetry: false,
          timestamp
        };

      case 'FORBIDDEN':
        return {
          message: 'Access forbidden (403): Your Google account is not authorized on this backend. Only authorized portfolio owners can view live holdings.',
          kind: error.kind,
          status: 403,
          canRetry: false,
          timestamp
        };

      case 'INVALID_BUDGET':
        return {
          message: `Invalid budget parameter (422): ${error.message}`,
          kind: error.kind,
          status: 422,
          canRetry: true,
          timestamp
        };

      case 'SERVICE_UNAVAILABLE':
        return {
          message: 'Cloud service unavailable (503): The backend is currently starting or undergoing maintenance. Please retry shortly.',
          kind: error.kind,
          status: 503,
          canRetry: true,
          timestamp
        };

      case 'TIMEOUT':
        return {
          message: 'Request timed out: The cloud backend may be spinning up from a cold start. Please click Retry.',
          kind: error.kind,
          canRetry: true,
          timestamp
        };

      case 'NETWORK_ERROR':
        return {
          message: 'Network connection error: Unable to reach the cloud server. Please check your network connection and retry.',
          kind: error.kind,
          canRetry: true,
          timestamp
        };

      case 'SERVER_ERROR':
        return {
          message: `Backend error (${error.status || 500}): An error occurred while generating the portfolio snapshot. Please retry.`,
          kind: error.kind,
          status: error.status,
          canRetry: true,
          timestamp
        };

      case 'SCHEMA_VALIDATION_ERROR':
      case 'SECURITY_INVARIANT_VIOLATION':
        return {
          message: `Snapshot verification failed: ${error.message}`,
          kind: error.kind,
          canRetry: false,
          timestamp
        };

      default:
        return {
          message: `Cloud request failed: ${error.message}`,
          kind: error.kind,
          status: error.status,
          canRetry: true,
          timestamp
        };
    }
  }
}

/**
 * Factory helper for creating CloudSessionManager instances.
 */
export function createCloudSessionManager(config?: CloudSessionManagerConfig): CloudSessionManager {
  return new CloudSessionManager(config);
}
