/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Cloud Session Manager & GIS Integration Test Suite (100% Mock-Only)
 * ===================================================================
 * Verifies all 12 Phase 6.2D core criteria:
 * 1. GIS initialization/configuration with missing OAuth client ID.
 * 2. Successful token callback.
 * 3. GIS script load or initialization failure.
 * 4. Sign-out clears in-memory token and cloud session.
 * 5. Successful cloud snapshot load switches to 'cloud_live'.
 * 6. Failed API request does not corrupt or silently replace current session.
 * 7. 401 and 403 produce appropriate safe UI feedback.
 * 8. Timeout and network failures show recoverable errors.
 * 9. Demo and local snapshot workflows remain functional.
 * 10. No token is written to persistent browser storage.
 * 11. Automated trade execution remains blocked.
 * 12. Repeated clicks do not create uncontrolled duplicate concurrent requests.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GoogleIdentityService,
  GoogleAccountsIdApi,
  GsiCredentialResponse
} from './googleIdentityService';
import {
  CloudSessionManager,
  createCloudSessionManager
} from './cloudSessionManager';
import { createCloudApiClient } from './cloudApiClient';
import { InvestmentAgentPortfolioSnapshot } from '../adapters/investmentAgentAdapter';
import { PortfolioSessionState } from '../types/investment';
import { getInitialSyntheticSessionState, parseAndAdaptSnapshotJson } from '../utils/snapshotLoader';

function createValidCloudSnapshotFixture(): InvestmentAgentPortfolioSnapshot {
  return {
    schemaVersion: '1.0.0',
    exportMetadata: {
      sourceSystem: 'InvestmentAgentCloud',
      sourceWorksheet: 'Asset Health Data',
      exportTimestamp: '2026-02-25T12:00:00.000Z',
      asOfDate: '2026-02-25',
      reportingCurrency: 'TRY',
      engineVersion: 'v2.1.0-cloud'
    },
    portfolioSummary: {
      totalInvestedValueTRY: 1000000,
      targetSumPct: 100,
      newMoneyBudgetTRY: 25000,
      holdingCount: 2
    },
    positions: [
      {
        asset: 'THYAO',
        category: 'TR Stocks',
        quantity: 100,
        currentValueTRY: 31000,
        currentWeightPct: 3.1,
        targetWeightPct: 5.0,
        gapPct: 1.9,
        priority: 'MEDIUM',
        averageCostTRY: 280,
        totalCostTRY: 28000,
        unrealizedPLTRY: 3000,
        unrealizedPLPct: 10.71,
        investmentThesis: 'Aviation cargo growth',
        notes: 'Core domestic holding'
      },
      {
        asset: 'NVDA',
        category: 'US Stocks',
        quantity: 10,
        currentValueTRY: 80000,
        currentWeightPct: 8.0,
        targetWeightPct: 10.0,
        gapPct: 2.0,
        priority: 'HIGH',
        averageCostTRY: null,
        totalCostTRY: null,
        unrealizedPLTRY: null,
        unrealizedPLPct: null,
        investmentThesis: 'AI compute leadership',
        notes: 'Cost basis untracked'
      }
    ],
    existingPurchaseRecommendations: [
      {
        asset: 'THYAO',
        category: 'TR Stocks',
        purchaseTRY: 15000,
        gapPp: 1.9,
        priority: 'MEDIUM'
      }
    ]
  };
}

describe('Phase 6.2D — Cloud Session Manager & GIS Integration Test Suite', () => {
  // Test 1: GIS initialization with missing OAuth client ID
  it('1. GIS initialization with missing or placeholder OAuth client ID returns unconfigured state', async () => {
    const service = new GoogleIdentityService({
      clientId: 'PLACEHOLDER_GOOGLE_CLIENT_ID.apps.googleusercontent.com'
    });

    const initialized = await service.initialize();

    assert.equal(initialized, false);
    assert.equal(service.getStatus(), 'unconfigured');
    assert.match(service.getErrorMessage() || '', /Placeholder/);
    assert.equal(service.hasToken(), false);
  });

  // Test 2: Successful token callback
  it('2. Successful token callback updates in-memory token and status to signed_in', () => {
    let capturedCallback: ((resp: GsiCredentialResponse) => void) | null = null;

    const mockGsiApi: GoogleAccountsIdApi = {
      initialize: (cfg) => {
        capturedCallback = cfg.callback;
      },
      renderButton: () => {}
    };

    const service = new GoogleIdentityService({
      clientId: '123456789-valid.apps.googleusercontent.com',
      googleAccountsId: mockGsiApi
    });

    service.initialize();
    if (!capturedCallback) {
      throw new Error('Callback was not captured during initialize');
    }

    // Simulate GIS token return
    const callbackFn: (resp: GsiCredentialResponse) => void = capturedCallback;
    callbackFn({ credential: 'mock.valid.google.id.token' });

    assert.equal(service.getStatus(), 'signed_in');
    assert.equal(service.getIdToken(), 'mock.valid.google.id.token');
    assert.equal(service.hasToken(), true);
  });

  // Test 3: GIS script load or initialization failure
  it('3. GIS script load failure transitions to script_error gracefully', async () => {
    const service = new GoogleIdentityService({
      clientId: '123456789-valid.apps.googleusercontent.com',
      customScriptLoader: async () => {
        throw new Error('Network offline or CDN blocked');
      }
    });

    const initialized = await service.initialize();

    assert.equal(initialized, false);
    assert.equal(service.getStatus(), 'script_error');
    assert.match(service.getErrorMessage() || '', /Network offline/);
  });

  // Test 4: Sign-out clears in-memory token and cloud session
  it('4. Sign-out clears in-memory token and resets cloud session to synthetic demo', () => {
    const service = new GoogleIdentityService({
      clientId: '123456789-valid.apps.googleusercontent.com'
    });
    service.handleCredentialResponse({ credential: 'jwt.token.to.clear' });
    assert.equal(service.hasToken(), true);

    const manager = createCloudSessionManager({ identityService: service });

    // Active session is cloud_live
    const cloudSession: PortfolioSessionState = {
      mode: 'cloud_live',
      dataSource: {
        mode: 'cloud_live',
        label: 'CLOUD LIVE SNAPSHOT',
        description: 'Ingested live from InvestmentAgentCloud',
        reportingCurrency: 'TRY'
      },
      holdings: [],
      summary: {
        reportingCurrency: 'TRY',
        totalValueTRY: 1000000,
        categories: [],
        topHoldingsConcentration: { top1: 0, top3: 0, top5: 0 },
        currencyExposure: { USD: 0, TRY: 1000000 },
        reviewQueueCount: 0
      },
      purchaseRecommendations: [],
      validationDisclosures: []
    };

    let updatedSession: PortfolioSessionState | null = null;
    manager.signOut(cloudSession, (state) => {
      updatedSession = state;
    });

    // In-memory token is cleared
    assert.equal(service.hasToken(), false);
    assert.equal(service.getIdToken(), null);
    assert.equal(service.getStatus(), 'ready_signed_out');

    // Cloud session was reset to synthetic demonstration
    assert.ok(updatedSession);
    assert.equal((updatedSession as PortfolioSessionState).mode, 'synthetic_demonstration');
  });

  // Test 5: Successful cloud snapshot load switches to cloud_live
  it('5. Successful cloud snapshot load switches session mode to cloud_live', async () => {
    const service = new GoogleIdentityService({
      clientId: '123456789-valid.apps.googleusercontent.com'
    });
    service.handleCredentialResponse({ credential: 'valid.mock.token' });

    const mockFetch: typeof fetch = async () => {
      return new Response(JSON.stringify(createValidCloudSnapshotFixture()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const client = createCloudApiClient({ fetchFn: mockFetch });
    const manager = createCloudSessionManager({ identityService: service, client });

    const initialSession = getInitialSyntheticSessionState();
    let currentSession: PortfolioSessionState = initialSession;

    const result = await manager.loadCloudPortfolio(currentSession, (state) => {
      currentSession = state;
    });

    assert.equal(result.success, true);
    assert.equal(currentSession.mode, 'cloud_live');
    assert.equal(currentSession.dataSource.mode, 'cloud_live');
    assert.equal(currentSession.holdings.length, 2);
    assert.equal(currentSession.summary.reportingCurrency, 'TRY');
  });

  // Test 6: Failed API request does not corrupt or silently replace current session
  it('6. Failed API request does not corrupt or silently replace the current session', async () => {
    const service = new GoogleIdentityService({
      clientId: '123456789-valid.apps.googleusercontent.com'
    });
    service.handleCredentialResponse({ credential: 'valid.mock.token' });

    // Mock 500 error from backend
    const mockFetch: typeof fetch = async () => {
      return new Response(JSON.stringify({ detail: 'Internal engine calculation failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const client = createCloudApiClient({ fetchFn: mockFetch });
    const manager = createCloudSessionManager({ identityService: service, client });

    const initialSession = getInitialSyntheticSessionState();
    let stateMutated = false;

    const result = await manager.loadCloudPortfolio(initialSession, () => {
      stateMutated = true;
    });

    assert.equal(result.success, false);
    // Active session was NOT mutated
    assert.equal(stateMutated, false);
    assert.equal(initialSession.mode, 'synthetic_demonstration');
    assert.ok(manager.getCurrentError());
  });

  // Test 7: 401 and 403 produce appropriate safe UI feedback
  it('7. 401 and 403 produce appropriate safe, non-revealing error feedback', async () => {
    const service = new GoogleIdentityService({
      clientId: '123456789-valid.apps.googleusercontent.com'
    });
    service.handleCredentialResponse({ credential: 'expired.token' });

    // 7a: 401 Unauthorized
    const mockFetch401: typeof fetch = async () => {
      return new Response(JSON.stringify({ detail: 'Token has expired' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const client401 = createCloudApiClient({ fetchFn: mockFetch401 });
    const manager401 = createCloudSessionManager({ identityService: service, client: client401 });

    const result401 = await manager401.loadCloudPortfolio(getInitialSyntheticSessionState(), () => {});
    assert.equal(result401.success, false);
    assert.equal(manager401.getCurrentError()?.status, 401);
    assert.match(manager401.getCurrentError()?.message || '', /401/);
    assert.equal(manager401.getCurrentError()?.canRetry, false);

    // 7b: 403 Forbidden (Non-allowlisted Google account)
    const mockFetch403: typeof fetch = async () => {
      return new Response(JSON.stringify({ detail: 'User unapproved@example.com is not authorized.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const client403 = createCloudApiClient({ fetchFn: mockFetch403 });
    const manager403 = createCloudSessionManager({ identityService: service, client: client403 });

    const result403 = await manager403.loadCloudPortfolio(getInitialSyntheticSessionState(), () => {});
    assert.equal(result403.success, false);
    assert.equal(manager403.getCurrentError()?.status, 403);
    assert.match(manager403.getCurrentError()?.message || '', /authorized portfolio owners/);
    assert.equal(manager403.getCurrentError()?.canRetry, false);
  });

  // Test 8: Timeout and network failures show recoverable errors
  it('8. Timeout and network failures show recoverable errors with retry enabled', async () => {
    const service = new GoogleIdentityService({
      clientId: '123456789-valid.apps.googleusercontent.com'
    });
    service.handleCredentialResponse({ credential: 'valid.token' });

    // 8a: Timeout
    const mockFetchTimeout: typeof fetch = (_input, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    };

    const clientTimeout = createCloudApiClient({
      fetchFn: mockFetchTimeout,
      timeoutMs: 30 // trigger timeout fast
    });
    const managerTimeout = createCloudSessionManager({ identityService: service, client: clientTimeout });

    const resultTimeout = await managerTimeout.loadCloudPortfolio(getInitialSyntheticSessionState(), () => {});
    assert.equal(resultTimeout.success, false);
    assert.equal(managerTimeout.getCurrentError()?.kind, 'TIMEOUT');
    assert.equal(managerTimeout.getCurrentError()?.canRetry, true);
    assert.match(managerTimeout.getCurrentError()?.message || '', /cold start/);

    // 8b: Network Failure
    const mockFetchNetwork: typeof fetch = async () => {
      throw new TypeError('Failed to fetch (DNS resolution failure)');
    };

    const clientNetwork = createCloudApiClient({ fetchFn: mockFetchNetwork });
    const managerNetwork = createCloudSessionManager({ identityService: service, client: clientNetwork });

    const resultNetwork = await managerNetwork.loadCloudPortfolio(getInitialSyntheticSessionState(), () => {});
    assert.equal(resultNetwork.success, false);
    assert.equal(managerNetwork.getCurrentError()?.kind, 'NETWORK_ERROR');
    assert.equal(managerNetwork.getCurrentError()?.canRetry, true);
  });

  // Test 9: Demo and local snapshot workflows remain functional
  it('9. Demo and local snapshot workflows remain fully functional without interference', () => {
    // Demo mode initialization
    const demoState = getInitialSyntheticSessionState();
    assert.equal(demoState.mode, 'synthetic_demonstration');
    assert.equal(demoState.holdings.length, 6);

    // Local snapshot file parsing
    const sampleSnapshotJson = JSON.stringify(createValidCloudSnapshotFixture());
    const parseResult = parseAndAdaptSnapshotJson(sampleSnapshotJson, 'offline_portfolio.json');

    assert.equal(parseResult.success, true);
    if (parseResult.success) {
      assert.equal(parseResult.state.mode, 'local_snapshot');
      assert.equal(parseResult.state.provenanceFilename, 'offline_portfolio.json');
      assert.equal(parseResult.state.holdings.length, 2);
    }
  });

  // Test 10: No token is written to persistent browser storage
  it('10. No token is ever written to persistent browser storage (localStorage or sessionStorage)', async () => {
    // Monitor storage access
    let storageWriteAttempted = false;

    const storageProxy = {
      setItem: () => { storageWriteAttempted = true; },
      getItem: () => null,
      removeItem: () => {},
      clear: () => {}
    };

    const originalLocalStorage = globalThis.localStorage;
    const originalSessionStorage = globalThis.sessionStorage;

    Object.defineProperty(globalThis, 'localStorage', { value: storageProxy, configurable: true });
    Object.defineProperty(globalThis, 'sessionStorage', { value: storageProxy, configurable: true });

    try {
      const service = new GoogleIdentityService({
        clientId: '123456789-valid.apps.googleusercontent.com'
      });

      // Sign-in
      service.handleCredentialResponse({ credential: 'secret.jwt.token' });
      assert.equal(service.getIdToken(), 'secret.jwt.token');

      // Execute snapshot load
      const mockFetch: typeof fetch = async () => {
        return new Response(JSON.stringify(createValidCloudSnapshotFixture()), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };
      const client = createCloudApiClient({ fetchFn: mockFetch });
      const manager = createCloudSessionManager({ identityService: service, client });

      let currentSession = getInitialSyntheticSessionState();
      await manager.loadCloudPortfolio(currentSession, (st) => { currentSession = st; });

      // Sign out
      manager.signOut(currentSession, () => {});

      // Verify zero storage writes occurred
      assert.equal(storageWriteAttempted, false);
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { value: originalLocalStorage, configurable: true });
      Object.defineProperty(globalThis, 'sessionStorage', { value: originalSessionStorage, configurable: true });
    }
  });

  // Test 11: Automated trade execution remains blocked
  it('11. Automated trade execution remains permanently blocked and null cost basis preserved', async () => {
    const service = new GoogleIdentityService({
      clientId: '123456789-valid.apps.googleusercontent.com'
    });
    service.handleCredentialResponse({ credential: 'valid.token' });

    const mockFetch: typeof fetch = async () => {
      return new Response(JSON.stringify(createValidCloudSnapshotFixture()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const client = createCloudApiClient({ fetchFn: mockFetch });
    const successData = await client.fetchSnapshot({ idToken: 'valid.token' });

    assert.equal(successData.adapterResult.automatedTradeExecutionBlocked, true);
    assert.equal(successData.state.summary.reportingCurrency, 'TRY');

    const nvda = successData.state.holdings.find(h => h.ticker === 'NVDA');
    assert.ok(nvda);
    assert.equal(nvda.costBasis, null);
  });

  // Test 12: Repeated clicks do not create uncontrolled duplicate concurrent requests
  it('12. Repeated clicks do not create uncontrolled duplicate concurrent requests', async () => {
    const service = new GoogleIdentityService({
      clientId: '123456789-valid.apps.googleusercontent.com'
    });
    service.handleCredentialResponse({ credential: 'valid.token' });

    let fetchCount = 0;
    let finishFetch: (() => void) | null = null;

    const mockFetch: typeof fetch = async () => {
      fetchCount++;
      await new Promise<void>(resolve => {
        finishFetch = resolve;
      });
      return new Response(JSON.stringify(createValidCloudSnapshotFixture()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const client = createCloudApiClient({ fetchFn: mockFetch });
    const manager = createCloudSessionManager({ identityService: service, client });

    const session = getInitialSyntheticSessionState();

    // 1st request initiates fetch
    const req1Promise = manager.loadCloudPortfolio(session, () => {});
    assert.equal(manager.getIsFetching(), true);
    assert.equal(fetchCount, 1);

    // 2nd request (duplicate click) while 1st is in-flight
    const req2Result = await manager.loadCloudPortfolio(session, () => {});

    // Duplicate request is rejected immediately
    assert.equal(req2Result.success, false);
    assert.match(req2Result.error || '', /already in progress/);
    assert.equal(fetchCount, 1); // Fetch was NOT called a second time

    // Release 1st request
    finishFetch!();
    const req1Result = await req1Promise;

    assert.equal(req1Result.success, true);
    assert.equal(manager.getIsFetching(), false);
    assert.equal(fetchCount, 1);
  });
});
