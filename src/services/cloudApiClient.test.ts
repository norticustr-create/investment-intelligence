/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Cloud Snapshot API Client Unit Tests (100% Mock-Only)
 * ======================================================
 * Tests all authentication, network, timeout, validation, and session state
 * behaviors using injected mock fetch functions. Zero live network calls.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createCloudApiClient,
  CloudApiClient,
  CloudApiError
} from './cloudApiClient';
import { InvestmentAgentPortfolioSnapshot } from '../adapters/investmentAgentAdapter';

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
        averageCostTRY: null, // Preserved untracked cost basis
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

describe('CloudApiClient (Mock-Only Test Suite)', () => {

  it('successfully fetches and adapts valid snapshot with correct headers and cloud_live state', async () => {
    let capturedUrl = '';
    let capturedHeaders: Record<string, string> = {};

    const mockFetch: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedHeaders = (init?.headers ?? {}) as Record<string, string>;

      return new Response(JSON.stringify(createValidCloudSnapshotFixture()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const client = createCloudApiClient({
      baseUrl: 'https://mock-backend.local',
      fetchFn: mockFetch
    });

    const result = await client.fetchSnapshot({
      idToken: 'mock_google_jwt_token_123',
      userEmail: 'authorized_user@example.com'
    });

    assert.equal(capturedUrl, 'https://mock-backend.local/api/snapshot');
    assert.equal(capturedHeaders['Authorization'], 'Bearer mock_google_jwt_token_123');
    assert.equal(capturedHeaders['Accept'], 'application/json');

    // Invariant assertions
    assert.equal(result.state.mode, 'cloud_live');
    assert.equal(result.state.authenticatedUserEmail, 'authorized_user@example.com');
    assert.equal(result.state.dataSource.mode, 'cloud_live');
    assert.equal(result.state.dataSource.reportingCurrency, 'TRY');
    assert.equal(result.adapterResult.automatedTradeExecutionBlocked, true);
    assert.equal(result.state.holdings.length, 2);

    // Null cost basis preservation
    const nvda = result.state.holdings.find(h => h.ticker === 'NVDA');
    assert.ok(nvda);
    assert.equal(nvda.costBasis, null);
  });

  it('appends budget query parameter when provided and valid', async () => {
    let capturedUrl = '';

    const mockFetch: typeof fetch = async (input) => {
      capturedUrl = String(input);
      return new Response(JSON.stringify(createValidCloudSnapshotFixture()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const client = createCloudApiClient({
      baseUrl: 'https://mock-backend.local',
      fetchFn: mockFetch
    });

    await client.fetchSnapshot({
      idToken: 'token123',
      budget: 75000.5
    });

    assert.equal(capturedUrl, 'https://mock-backend.local/api/snapshot?budget=75000.5');
  });

  it('rejects invalid budget before making network requests', async () => {
    let networkCallMade = false;
    const mockFetch: typeof fetch = async () => {
      networkCallMade = true;
      return new Response('{}');
    };

    const client = createCloudApiClient({ fetchFn: mockFetch });

    // Zero budget
    await assert.rejects(
      () => client.fetchSnapshot({ idToken: 'tok', budget: 0 }),
      (err: unknown) => err instanceof CloudApiError && err.kind === 'INVALID_BUDGET'
    );

    // Negative budget
    await assert.rejects(
      () => client.fetchSnapshot({ idToken: 'tok', budget: -500 }),
      (err: unknown) => err instanceof CloudApiError && err.kind === 'INVALID_BUDGET'
    );

    // Excessive budget (> 100M)
    await assert.rejects(
      () => client.fetchSnapshot({ idToken: 'tok', budget: 100_000_001 }),
      (err: unknown) => err instanceof CloudApiError && err.kind === 'INVALID_BUDGET'
    );

    // NaN / Infinity budget
    await assert.rejects(
      () => client.fetchSnapshot({ idToken: 'tok', budget: Number.NaN }),
      (err: unknown) => err instanceof CloudApiError && err.kind === 'INVALID_BUDGET'
    );

    assert.equal(networkCallMade, false, 'No network call should be issued for invalid budget');
  });

  it('rejects empty or whitespace-only token before network call', async () => {
    let networkCallMade = false;
    const mockFetch: typeof fetch = async () => {
      networkCallMade = true;
      return new Response('{}');
    };

    const client = createCloudApiClient({ fetchFn: mockFetch });

    await assert.rejects(
      () => client.fetchSnapshot({ idToken: '' }),
      (err: unknown) => err instanceof CloudApiError && err.kind === 'INVALID_TOKEN'
    );

    await assert.rejects(
      () => client.fetchSnapshot({ idToken: '   ' }),
      (err: unknown) => err instanceof CloudApiError && err.kind === 'INVALID_TOKEN'
    );

    assert.equal(networkCallMade, false);
  });

  it('maps HTTP 401 response to UNAUTHORIZED CloudApiError', async () => {
    const mockFetch: typeof fetch = async () => {
      return new Response(JSON.stringify({ detail: 'Invalid or expired token' }), {
        status: 401,
        statusText: 'Unauthorized',
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const client = createCloudApiClient({ fetchFn: mockFetch });

    await assert.rejects(
      () => client.fetchSnapshot({ idToken: 'expired_tok' }),
      (err: unknown) => {
        assert.ok(err instanceof CloudApiError);
        assert.equal(err.kind, 'UNAUTHORIZED');
        assert.equal(err.status, 401);
        assert.ok(err.message.includes('Invalid or expired token'));
        return true;
      }
    );
  });

  it('maps HTTP 403 response to FORBIDDEN CloudApiError', async () => {
    const mockFetch: typeof fetch = async () => {
      return new Response(JSON.stringify({ detail: 'User not in allowed users list' }), {
        status: 403,
        statusText: 'Forbidden',
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const client = createCloudApiClient({ fetchFn: mockFetch });

    await assert.rejects(
      () => client.fetchSnapshot({ idToken: 'unauthorized_tok' }),
      (err: unknown) => {
        assert.ok(err instanceof CloudApiError);
        assert.equal(err.kind, 'FORBIDDEN');
        assert.equal(err.status, 403);
        assert.ok(err.message.includes('User not in allowed users list'));
        return true;
      }
    );
  });

  it('maps HTTP 422 response to INVALID_BUDGET CloudApiError', async () => {
    const mockFetch: typeof fetch = async () => {
      return new Response(JSON.stringify({ detail: 'Budget must be strictly positive' }), {
        status: 422,
        statusText: 'Unprocessable Content',
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const client = createCloudApiClient({ fetchFn: mockFetch });

    await assert.rejects(
      () => client.fetchSnapshot({ idToken: 'valid_tok', budget: 100 }),
      (err: unknown) => {
        assert.ok(err instanceof CloudApiError);
        assert.equal(err.kind, 'INVALID_BUDGET');
        assert.equal(err.status, 422);
        return true;
      }
    );
  });

  it('maps HTTP 503 response to SERVICE_UNAVAILABLE CloudApiError', async () => {
    const mockFetch: typeof fetch = async () => {
      return new Response(JSON.stringify({ detail: 'Snapshot data source unavailable' }), {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const client = createCloudApiClient({ fetchFn: mockFetch });

    await assert.rejects(
      () => client.fetchSnapshot({ idToken: 'valid_tok' }),
      (err: unknown) => {
        assert.ok(err instanceof CloudApiError);
        assert.equal(err.kind, 'SERVICE_UNAVAILABLE');
        assert.equal(err.status, 503);
        assert.ok(err.message.includes('unavailable'));
        return true;
      }
    );
  });

  it('handles request timeout gracefully with TIMEOUT CloudApiError', async () => {
    const mockFetch: typeof fetch = (_input, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    };

    const client = createCloudApiClient({
      timeoutMs: 30, // 30ms short timeout for testing
      fetchFn: mockFetch
    });

    await assert.rejects(
      () => client.fetchSnapshot({ idToken: 'valid_tok' }),
      (err: unknown) => {
        assert.ok(err instanceof CloudApiError);
        assert.equal(err.kind, 'TIMEOUT');
        assert.ok(err.message.includes('timed out after 30ms'));
        return true;
      }
    );
  });

  it('maps network rejection to NETWORK_ERROR CloudApiError', async () => {
    const mockFetch: typeof fetch = async () => {
      throw new TypeError('Failed to fetch (DNS or connection refused)');
    };

    const client = createCloudApiClient({ fetchFn: mockFetch });

    await assert.rejects(
      () => client.fetchSnapshot({ idToken: 'valid_tok' }),
      (err: unknown) => {
        assert.ok(err instanceof CloudApiError);
        assert.equal(err.kind, 'NETWORK_ERROR');
        assert.ok(err.message.includes('Network failure'));
        return true;
      }
    );
  });

  it('rejects non-JSON response with INVALID_RESPONSE CloudApiError', async () => {
    const mockFetch: typeof fetch = async () => {
      return new Response('<html>502 Bad Gateway</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      });
    };

    const client = createCloudApiClient({ fetchFn: mockFetch });

    await assert.rejects(
      () => client.fetchSnapshot({ idToken: 'valid_tok' }),
      (err: unknown) => {
        assert.ok(err instanceof CloudApiError);
        assert.equal(err.kind, 'INVALID_RESPONSE');
        return true;
      }
    );
  });

  it('rejects invalid snapshot schema with SCHEMA_VALIDATION_ERROR', async () => {
    const invalidSnapshot = {
      schemaVersion: '2.0.0', // Unsupported version
      exportMetadata: {},
      portfolioSummary: {},
      positions: []
    };

    const mockFetch: typeof fetch = async () => {
      return new Response(JSON.stringify(invalidSnapshot), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const client = createCloudApiClient({ fetchFn: mockFetch });

    await assert.rejects(
      () => client.fetchSnapshot({ idToken: 'valid_tok' }),
      (err: unknown) => {
        assert.ok(err instanceof CloudApiError);
        assert.equal(err.kind, 'SCHEMA_VALIDATION_ERROR');
        assert.ok(err.message.includes('schema validation failed'));
        return true;
      }
    );
  });

  it('fetchSnapshotSafe returns discriminated success without throwing', async () => {
    const mockFetch: typeof fetch = async () => {
      return new Response(JSON.stringify(createValidCloudSnapshotFixture()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const client = createCloudApiClient({ fetchFn: mockFetch });
    const result = await client.fetchSnapshotSafe({ idToken: 'valid_tok' });

    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.state.mode, 'cloud_live');
      assert.equal(result.data.adapterResult.automatedTradeExecutionBlocked, true);
    }
  });

  it('fetchSnapshotSafe returns discriminated error without throwing', async () => {
    const mockFetch: typeof fetch = async () => {
      return new Response(JSON.stringify({ detail: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const client = createCloudApiClient({ fetchFn: mockFetch });
    const result = await client.fetchSnapshotSafe({ idToken: 'invalid_tok' });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.error.kind, 'UNAUTHORIZED');
      assert.equal(result.error.status, 401);
    }
  });

  // ==========================================================================
  // Phase 7: fetchIntelligence and fetchIntelligenceSafe Tests
  // ==========================================================================

  it('fetchIntelligence sends correct Authorization, handles query params, and returns reports', async () => {
    let capturedUrl = '';
    let capturedHeaders: HeadersInit | undefined;

    const mockResponsePayload = {
      status: 'success',
      as_of_date: '2026-02-25',
      cached: false,
      cache_expires_at: null,
      data_source: 'sheets',
      user: 'investor@example.com',
      reports: {
        NVDA: {
          asset: 'NVDA',
          as_of_date: '2026-02-25',
          thesis_evaluated: 'AI hardware infrastructure',
          overall_health: 'EXCELLENT',
          thesis_status: 'intact',
          review_required: false,
          review_reason: null,
          uncertainty_level: 'LOW',
          uncertainty_explanation: 'Strong primary statutory 10-K disclosures.',
          suggested_action: 'HOLD',
          findings: [
            {
              id: 'finding-001',
              holding_id: 'NVDA',
              source_doc_id: 'doc-001',
              claim: 'Data center revenue accelerated 112% year-over-year',
              excerpt: 'Data Center compute revenue grew significantly.',
              type: 'verified_fact',
              verification_status: 'verified_primary',
              evidence_quality: 'high_statutory',
              materiality: 'HIGH',
              thesis_impact: 'SUPPORTS_THESIS',
              supports_moat_destruction: false,
              explanation: 'Audited statutory 10-K SEC filing confirms high datacenter growth.',
              source_url: 'https://www.sec.gov/edgar/data/1045810/nvda-10k.htm',
              source_title: 'SEC Form 10-K FY2026'
            }
          ],
          unresolved_questions: [],
          automated_execution_blocked: true,
          documents_analyzed: 3,
          generation_timestamp: '2026-02-25T14:30:00Z',
          model_version: 'gemini-2.5-pro'
        }
      },
      documents_ingested: 3,
      sources_contacted: ['SEC EDGAR'],
      errors: [],
      automated_execution_blocked: true
    };

    const mockFetch: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedHeaders = init?.headers;
      return new Response(JSON.stringify(mockResponsePayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const client = createCloudApiClient({
      baseUrl: 'https://cloud-api.test',
      fetchFn: mockFetch
    });

    const result = await client.fetchIntelligenceSafe({
      idToken: 'test_bearer_token_123',
      forceRefresh: true,
      maxItemsPerAsset: 5
    });

    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.response.status, 'success');
      assert.equal(result.data.response.automated_execution_blocked, true);
      assert.equal(result.data.response.reports.NVDA.overall_health, 'EXCELLENT');
      assert.equal(result.data.response.reports.NVDA.findings.length, 1);
    }

    assert.match(capturedUrl, /force_refresh=true/);
    assert.match(capturedUrl, /max_items_per_asset=5/);
    const headers = capturedHeaders as Record<string, string>;
    assert.equal(headers['Authorization'], 'Bearer test_bearer_token_123');
  });

  it('fetchIntelligenceSafe validates security invariant: automated_execution_blocked must be true', async () => {
    const maliciousPayload = {
      status: 'success',
      as_of_date: '2026-02-25',
      cached: false,
      cache_expires_at: null,
      data_source: 'sheets',
      user: 'investor@example.com',
      reports: {},
      documents_ingested: 0,
      sources_contacted: [],
      errors: [],
      automated_execution_blocked: false // Security violation
    };

    const mockFetch: typeof fetch = async () => {
      return new Response(JSON.stringify(maliciousPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const client = createCloudApiClient({ fetchFn: mockFetch });
    const result = await client.fetchIntelligenceSafe({ idToken: 'valid_tok' });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.error.kind, 'SECURITY_INVARIANT_VIOLATION');
    }
  });

  it('fetchIntelligenceSafe catches 403 Forbidden with typed error without throwing', async () => {
    const mockFetch: typeof fetch = async () => {
      return new Response(JSON.stringify({ detail: 'User email unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const client = createCloudApiClient({ fetchFn: mockFetch });
    const result = await client.fetchIntelligenceSafe({ idToken: 'unauthorized_token' });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.error.kind, 'FORBIDDEN');
      assert.equal(result.error.status, 403);
    }
  });

});
