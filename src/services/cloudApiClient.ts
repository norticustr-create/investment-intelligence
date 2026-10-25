/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Cloud Snapshot API Client (Pure Client Module)
 * ===============================================
 * Typed API client for consuming the protected GET /api/snapshot endpoint
 * exposed by the InvestmentAgentCloud FastAPI backend.
 *
 * Architectural & Safety Guarantees:
 * 1. Base URL Injection: The client does not hardcode any production endpoint.
 *    Base URL is passed via configuration or resolved from import.meta.env.
 * 2. Injected Fetch: Accepts an injected fetch implementation for isolated,
 *    deterministic testing with 100% mocked responses.
 * 3. Zero Credential Persistence: Does not store, cache, or persist Google ID
 *    tokens in localStorage, sessionStorage, cookies, or class instance state.
 * 4. Contract Schema Validation: All responses pass through adaptPortfolioSnapshot()
 *    to ensure strict conformity with schemaVersion 1.0.0.
 * 5. Security Invariants Preserved: Enforces automatedTradeExecutionBlocked === true,
 *    reportingCurrency === 'TRY', and preserves null cost basis fields.
 * 6. Non-Destructive Failures: Errors are typed and structured as CloudApiError;
 *    network or authentication failures never mutate or corrupt active session state.
 */

import {
  InvestmentAgentPortfolioSnapshot,
  adaptPortfolioSnapshot,
  SnapshotAdapterResult
} from '../adapters/investmentAgentAdapter';
import {
  PortfolioSessionState,
  DataSourceMetadata
} from '../types/investment';

export type CloudApiErrorKind =
  | 'INVALID_TOKEN'
  | 'UNAUTHORIZED'              // HTTP 401
  | 'FORBIDDEN'                 // HTTP 403
  | 'INVALID_BUDGET'            // HTTP 422
  | 'SERVICE_UNAVAILABLE'       // HTTP 503
  | 'SERVER_ERROR'              // HTTP 500+
  | 'CLIENT_ERROR'              // HTTP 400..499 (other)
  | 'TIMEOUT'                   // Network request timed out
  | 'NETWORK_ERROR'              // Network failure, aborted, offline
  | 'INVALID_RESPONSE'          // Non-JSON or malformed payload
  | 'SCHEMA_VALIDATION_ERROR'    // Fails Snapshot schema contract
  | 'SECURITY_INVARIANT_VIOLATION'; // Security invariant failed

export class CloudApiError extends Error {
  public readonly kind: CloudApiErrorKind;
  public readonly status?: number;
  public readonly details?: unknown;

  constructor(
    message: string,
    kind: CloudApiErrorKind,
    status?: number,
    details?: unknown
  ) {
    super(message);
    this.name = 'CloudApiError';
    this.kind = kind;
    this.status = status;
    this.details = details;
  }
}

export interface CloudApiClientConfig {
  baseUrl?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export interface FetchCloudSnapshotOptions {
  idToken: string;
  budget?: number;
  signal?: AbortSignal;
  userEmail?: string;
}

export interface CloudSnapshotSuccess {
  rawSnapshot: InvestmentAgentPortfolioSnapshot;
  adapterResult: SnapshotAdapterResult;
  state: PortfolioSessionState;
  disclosures: string[];
}

export type CloudSnapshotFetchResult =
  | {
      success: true;
      data: CloudSnapshotSuccess;
    }
  | {
      success: false;
      error: CloudApiError;
    };

const DEFAULT_TIMEOUT_MS = 15000;
const MAX_BUDGET_TRY = 100_000_000;

export class CloudApiClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: CloudApiClientConfig = {}) {
    this.baseUrl = (config.baseUrl ?? '').replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    // Resolve fetch: injected fetch > window.fetch > globalThis.fetch
    this.fetchImpl = config.fetchFn ?? (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : globalThis.fetch);
  }

  /**
   * Fetches and adapts the protected portfolio snapshot from the cloud backend.
   * Throws typed CloudApiError on any network, validation, or HTTP failure.
   */
  public async fetchSnapshot(options: FetchCloudSnapshotOptions): Promise<CloudSnapshotSuccess> {
    if (!options || typeof options !== 'object') {
      throw new CloudApiError('Options object must be provided.', 'CLIENT_ERROR');
    }

    // 1. Validate Token Parameter
    if (!options.idToken || typeof options.idToken !== 'string' || !options.idToken.trim()) {
      throw new CloudApiError('Authorization token is required and cannot be empty.', 'INVALID_TOKEN');
    }
    const cleanToken = options.idToken.trim();

    // 2. Validate Budget Parameter (if specified)
    if (options.budget !== undefined) {
      if (!Number.isFinite(options.budget)) {
        throw new CloudApiError('Budget must be a finite numeric value.', 'INVALID_BUDGET', 422);
      }
      if (options.budget <= 0) {
        throw new CloudApiError('Budget must be strictly greater than 0 TRY.', 'INVALID_BUDGET', 422);
      }
      if (options.budget > MAX_BUDGET_TRY) {
        throw new CloudApiError(
          `Budget exceeds the maximum allowed limit of ${MAX_BUDGET_TRY.toLocaleString('en-US')} TRY.`,
          'INVALID_BUDGET',
          422
        );
      }
    }

    // 3. Compose Request URL
    let url = `${this.baseUrl}/api/snapshot`;
    if (options.budget !== undefined) {
      url += `?budget=${encodeURIComponent(options.budget)}`;
    }

    // 4. Configure Timeout and AbortController
    const controller = new AbortController();
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
    let isTimedOut = false;

    if (this.timeoutMs > 0) {
      timeoutTimer = setTimeout(() => {
        isTimedOut = true;
        controller.abort();
      }, this.timeoutMs);
    }

    // Attach caller-provided signal to our controller
    const callerSignal = options.signal;
    const abortListener = () => controller.abort();
    if (callerSignal) {
      if (callerSignal.aborted) {
        controller.abort();
      } else {
        callerSignal.addEventListener('abort', abortListener);
      }
    }

    // 5. Execute HTTP Request
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cleanToken}`,
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
    } catch (err: unknown) {
      if (isTimedOut) {
        throw new CloudApiError(
          `Request to ${url} timed out after ${this.timeoutMs}ms.`,
          'TIMEOUT'
        );
      }
      if (callerSignal?.aborted) {
        throw new CloudApiError('Request was aborted by the caller.', 'NETWORK_ERROR');
      }
      const msg = err instanceof Error ? err.message : String(err);
      throw new CloudApiError(`Network failure while contacting cloud API: ${msg}`, 'NETWORK_ERROR', undefined, err);
    } finally {
      if (timeoutTimer !== null) {
        clearTimeout(timeoutTimer);
      }
      if (callerSignal) {
        callerSignal.removeEventListener('abort', abortListener);
      }
    }

    // 6. Handle HTTP Status Errors
    if (!response.ok) {
      let errorBody: unknown = null;
      try {
        errorBody = await response.json();
      } catch {
        // Body was non-JSON or empty
      }

      const detailMsg = (errorBody && typeof errorBody === 'object' && 'detail' in errorBody)
        ? String((errorBody as { detail: unknown }).detail)
        : (errorBody && typeof errorBody === 'object' && 'message' in errorBody)
        ? String((errorBody as { message: unknown }).message)
        : `HTTP ${response.status} ${response.statusText}`;

      switch (response.status) {
        case 401:
          throw new CloudApiError(`Authentication failed: ${detailMsg}`, 'UNAUTHORIZED', 401, errorBody);
        case 403:
          throw new CloudApiError(`Access forbidden: ${detailMsg}`, 'FORBIDDEN', 403, errorBody);
        case 422:
          throw new CloudApiError(`Invalid request: ${detailMsg}`, 'INVALID_BUDGET', 422, errorBody);
        case 503:
          throw new CloudApiError(`Cloud service unavailable: ${detailMsg}`, 'SERVICE_UNAVAILABLE', 503, errorBody);
        default:
          if (response.status >= 500) {
            throw new CloudApiError(`Cloud server error (${response.status}): ${detailMsg}`, 'SERVER_ERROR', response.status, errorBody);
          }
          throw new CloudApiError(`Client request error (${response.status}): ${detailMsg}`, 'CLIENT_ERROR', response.status, errorBody);
      }
    }

    // 7. Parse Response Body as JSON
    let rawJson: unknown;
    try {
      rawJson = await response.json();
    } catch (err: unknown) {
      throw new CloudApiError(
        `Failed to parse response from ${url} as JSON: ${err instanceof Error ? err.message : String(err)}`,
        'INVALID_RESPONSE',
        response.status,
        err
      );
    }

    // 8. Contract Validation via Existing Pure Adapter
    let adapterResult: SnapshotAdapterResult;
    try {
      adapterResult = adaptPortfolioSnapshot(rawJson);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      throw new CloudApiError(
        `Cloud snapshot schema validation failed: ${errMsg}`,
        'SCHEMA_VALIDATION_ERROR',
        response.status,
        err
      );
    }

    // 9. Post-Adaptation Security Invariant Checks
    if (adapterResult.automatedTradeExecutionBlocked !== true) {
      throw new CloudApiError(
        'Security Invariant Violation: automatedTradeExecutionBlocked must be true.',
        'SECURITY_INVARIANT_VIOLATION',
        response.status
      );
    }

    if (adapterResult.holdings.length === 0) {
      throw new CloudApiError(
        'Snapshot contains 0 positions. Empty portfolios are not permitted.',
        'SCHEMA_VALIDATION_ERROR',
        response.status
      );
    }

    if (!Number.isFinite(adapterResult.summary.totalValueTRY) || adapterResult.summary.totalValueTRY < 0) {
      throw new CloudApiError(
        'Total portfolio value in TRY must be a non-negative finite number.',
        'SCHEMA_VALIDATION_ERROR',
        response.status
      );
    }

    if (adapterResult.summary.reportingCurrency !== 'TRY') {
      throw new CloudApiError(
        `Invalid reporting currency "${adapterResult.summary.reportingCurrency}". Sole authoritative currency must be "TRY".`,
        'SECURITY_INVARIANT_VIOLATION',
        response.status
      );
    }

    // 10. Construct Discriminated 'cloud_live' Session State
    const cloudDataSource: DataSourceMetadata = {
      mode: 'cloud_live',
      label: 'CLOUD LIVE SNAPSHOT',
      description: `Ingested live from ${adapterResult.exportMetadata.sourceWorksheet} via ${adapterResult.exportMetadata.sourceSystem} (${adapterResult.exportMetadata.engineVersion}). Read-only mode with automated execution blocked.`,
      sourceSystem: adapterResult.exportMetadata.sourceSystem,
      sourceWorksheet: adapterResult.exportMetadata.sourceWorksheet,
      asOfDate: adapterResult.exportMetadata.asOfDate,
      engineVersion: adapterResult.exportMetadata.engineVersion,
      reportingCurrency: 'TRY'
    };

    const cloudState: PortfolioSessionState = {
      mode: 'cloud_live',
      dataSource: cloudDataSource,
      holdings: adapterResult.holdings,
      summary: adapterResult.summary,
      purchaseRecommendations: adapterResult.purchaseRecommendations,
      validationDisclosures: adapterResult.validationDisclosures,
      authenticatedUserEmail: options.userEmail
    };

    return {
      rawSnapshot: rawJson as InvestmentAgentPortfolioSnapshot,
      adapterResult,
      state: cloudState,
      disclosures: adapterResult.validationDisclosures
    };
  }

  /**
   * Safe execution wrapper: Never throws. Returns a discriminated result object.
   */
  public async fetchSnapshotSafe(options: FetchCloudSnapshotOptions): Promise<CloudSnapshotFetchResult> {
    try {
      const data = await this.fetchSnapshot(options);
      return { success: true, data };
    } catch (err: unknown) {
      if (err instanceof CloudApiError) {
        return { success: false, error: err };
      }
      return {
        success: false,
        error: new CloudApiError(
          err instanceof Error ? err.message : String(err),
          'CLIENT_ERROR',
          undefined,
          err
        )
      };
    }
  }
}

/**
 * Factory helper for creating configured CloudApiClient instances.
 */
export function createCloudApiClient(config?: CloudApiClientConfig): CloudApiClient {
  return new CloudApiClient(config);
}
