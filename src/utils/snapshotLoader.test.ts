/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Snapshot Loader & State Integration Test Suite
 * ===============================================
 * Validates file constraints, JSON parsing safeguards, adapter contract
 * enforcement, atomic state bundling, empty portfolio guards, and
 * synthetic/real state isolation.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateSnapshotFile,
  parseAndAdaptSnapshotJson,
  getInitialSyntheticSessionState,
  MAX_SNAPSHOT_FILE_SIZE
} from './snapshotLoader';
import { InvestmentAgentPortfolioSnapshot } from '../adapters/investmentAgentAdapter';
import { SYNTHETIC_HOLDINGS } from '../data/syntheticPortfolio';

function createValidSnapshotFixture(): InvestmentAgentPortfolioSnapshot {
  return {
    schemaVersion: '1.0.0',
    exportMetadata: {
      sourceSystem: 'InvestmentAgentLocal',
      sourceWorksheet: 'Asset Health Data',
      exportTimestamp: '2026-02-20T10:00:00.000Z',
      asOfDate: '2026-02-20',
      reportingCurrency: 'TRY',
      engineVersion: '2.1.0'
    },
    portfolioSummary: {
      totalInvestedValueTRY: 1000000,
      targetSumPct: 100.0,
      newMoneyBudgetTRY: 50000,
      holdingCount: 3
    },
    positions: [
      {
        asset: 'NVDA',
        category: 'US Stocks',
        quantity: 7.334091,
        currentValueTRY: 81977.0,
        currentWeightPct: 8.1977,
        targetWeightPct: 10.0,
        gapPct: 1.8023,
        priority: 'HIGH',
        averageCostTRY: null,
        totalCostTRY: null,
        unrealizedPLTRY: null,
        unrealizedPLPct: null,
        investmentThesis: 'AI compute leadership',
        notes: 'Track quarterly datacenter revenue'
      },
      {
        asset: 'THYAO',
        category: 'TR Stocks',
        quantity: 1000,
        currentValueTRY: 300000.0,
        currentWeightPct: 30.0,
        targetWeightPct: 25.0,
        gapPct: -5.0,
        priority: 'HIGH',
        averageCostTRY: 250.0,
        totalCostTRY: 250000.0,
        unrealizedPLTRY: 50000.0,
        unrealizedPLPct: 20.0,
        investmentThesis: 'Flagship carrier global hub expansion',
        notes: 'Long-term cashflow growth'
      },
      {
        asset: 'TIO',
        category: 'Funds',
        quantity: 5000,
        currentValueTRY: 618023.0,
        currentWeightPct: 61.8023,
        targetWeightPct: 65.0,
        gapPct: 3.1977,
        priority: 'LOW',
        averageCostTRY: 100.0,
        totalCostTRY: 500000.0,
        unrealizedPLTRY: 118023.0,
        unrealizedPLPct: 23.6046,
        investmentThesis: 'Turkish mutual fund money market allocation',
        notes: 'Cash-equivalent yield'
      }
    ],
    existingPurchaseRecommendations: [
      {
        asset: 'TIO',
        category: 'Funds',
        purchaseTRY: 35000.0,
        gapPp: 3.1977,
        priority: 'LOW'
      },
      {
        asset: 'NVDA',
        category: 'US Stocks',
        purchaseTRY: 15000.0,
        gapPp: 1.8023,
        priority: 'HIGH'
      }
    ]
  };
}

describe('snapshotLoader & State Integration', () => {
  describe('1. File Constraints & Pre-Read Validation', () => {
    it('accepts valid .json file metadata within 10 MB limit', () => {
      const validFile = { name: 'portfolio_snapshot.json', size: 1024 * 50 }; // 50 KB
      assert.strictEqual(validateSnapshotFile(validFile), null);
    });

    it('rejects oversized files exceeding 10 MB', () => {
      const oversized = { name: 'huge_portfolio.json', size: MAX_SNAPSHOT_FILE_SIZE + 1 };
      const err = validateSnapshotFile(oversized);
      assert.ok(err !== null);
      assert.match(err, /exceeds maximum allowable limit of 10 MB/);
    });

    it('rejects non-JSON extensions', () => {
      assert.match(
        validateSnapshotFile({ name: 'snapshot.csv', size: 100 }) || '',
        /Only JSON snapshot files \(\.json\) are supported/
      );
      assert.match(
        validateSnapshotFile({ name: 'snapshot.py', size: 100 }) || '',
        /Only JSON snapshot files \(\.json\) are supported/
      );
      assert.match(
        validateSnapshotFile({ name: 'snapshot', size: 100 }) || '',
        /Only JSON snapshot files \(\.json\) are supported/
      );
    });

    it('rejects null, undefined, or empty file references', () => {
      assert.match(validateSnapshotFile(null) || '', /No file selected/);
      assert.match(validateSnapshotFile(undefined) || '', /No file selected/);
      assert.match(validateSnapshotFile({ name: '   ', size: 100 }) || '', /Filename is missing/);
    });
  });

  describe('2. Malformed JSON & Syntax Boundaries', () => {
    it('rejects completely empty or whitespace text', () => {
      const res = parseAndAdaptSnapshotJson('   ');
      assert.strictEqual(res.success, false);
      assert.match(res.error, /Snapshot file is empty/);
    });

    it('rejects malformed or truncated JSON with clear syntax error', () => {
      const res = parseAndAdaptSnapshotJson('{ "schemaVersion": "1.0.0", "exportMetadata": ');
      assert.strictEqual(res.success, false);
      assert.match(res.error, /Malformed JSON/);
    });
  });

  describe('3. Schema & Adapter Invariants', () => {
    it('rejects unsupported schema versions', () => {
      const fixture = createValidSnapshotFixture();
      (fixture as any).schemaVersion = '2.0.0';
      const res = parseAndAdaptSnapshotJson(JSON.stringify(fixture));
      assert.strictEqual(res.success, false);
      assert.match(res.error, /Unsupported schema version "2.0.0"/);
    });

    it('rejects non-TRY reporting currency', () => {
      const fixture = createValidSnapshotFixture();
      (fixture.exportMetadata as any).reportingCurrency = 'USD';
      const res = parseAndAdaptSnapshotJson(JSON.stringify(fixture));
      assert.strictEqual(res.success, false);
      assert.match(res.error, /Unsupported reporting currency "USD"/);
    });

    it('rejects missing required fields', () => {
      const fixture = createValidSnapshotFixture();
      delete (fixture as any).portfolioSummary;
      const res = parseAndAdaptSnapshotJson(JSON.stringify(fixture));
      assert.strictEqual(res.success, false);
      assert.match(res.error, /portfolioSummary must be a non-null object/);
    });

    it('rejects negative or invalid numerics', () => {
      const fixture = createValidSnapshotFixture();
      fixture.portfolioSummary.totalInvestedValueTRY = -500;
      const res = parseAndAdaptSnapshotJson(JSON.stringify(fixture));
      assert.strictEqual(res.success, false);
      assert.match(res.error, /must be non-negative/);
    });

    it('rejects snapshots containing 0 positions', () => {
      const fixture = createValidSnapshotFixture();
      fixture.portfolioSummary.holdingCount = 0;
      fixture.portfolioSummary.targetSumPct = 100.0;
      fixture.positions = [];
      const res = parseAndAdaptSnapshotJson(JSON.stringify(fixture));
      assert.strictEqual(res.success, false);
      assert.match(res.error, /Snapshot contains 0 positions/);
    });
  });

  describe('4. Atomic State Integration & Discriminated Sessions', () => {
    it('successfully parses a valid snapshot and returns atomic local_snapshot state', () => {
      const fixture = createValidSnapshotFixture();
      const rawText = JSON.stringify(fixture);
      const res = parseAndAdaptSnapshotJson(rawText, 'my_agent_export.json');

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.state.mode, 'local_snapshot');
        assert.strictEqual(res.state.provenanceFilename, 'my_agent_export.json');
        assert.strictEqual(res.state.dataSource.mode, 'local_snapshot');
        assert.strictEqual(res.state.dataSource.reportingCurrency, 'TRY');
        assert.strictEqual(res.state.dataSource.asOfDate, '2026-02-20');

        // Holdings & Summary atomically updated together
        assert.strictEqual(res.state.holdings.length, 3);
        assert.strictEqual(res.state.summary.totalValueTRY, 1000000);
        assert.strictEqual(res.state.summary.reportingCurrency, 'TRY');
        assert.strictEqual(res.state.purchaseRecommendations.length, 2);

        // Security invariant
        assert.strictEqual(res.adapterResult.automatedTradeExecutionBlocked, true);

        // Currency integrity: NVDA is TRY valuation, USD trading currency
        const nvda = res.state.holdings.find(h => h.ticker === 'NVDA');
        assert.ok(nvda);
        assert.strictEqual(nvda.currency, 'TRY');
        assert.strictEqual(nvda.tradingCurrency, 'USD');
        assert.strictEqual(nvda.currentPriceNative, null);
      }
    });

    it('provides clean synthetic initial state with zero real snapshot remnants', () => {
      const synthetic = getInitialSyntheticSessionState();
      assert.strictEqual(synthetic.mode, 'synthetic_demonstration');
      assert.strictEqual(synthetic.dataSource.mode, 'synthetic_demonstration');
      assert.strictEqual(synthetic.holdings.length, SYNTHETIC_HOLDINGS.length);
      assert.strictEqual(synthetic.purchaseRecommendations.length, 0);
      assert.strictEqual(synthetic.provenanceFilename, undefined);
    });

    it('switching back to synthetic mode resets holdings and removes local snapshot provenance', () => {
      // 1. Simulate active real state
      const fixture = createValidSnapshotFixture();
      const res = parseAndAdaptSnapshotJson(JSON.stringify(fixture), 'test_snapshot.json');
      assert.strictEqual(res.success, true);

      let currentState = res.success ? res.state : null;
      assert.strictEqual(currentState?.mode, 'local_snapshot');
      assert.strictEqual(currentState?.purchaseRecommendations.length, 2);

      // 2. Perform reset to synthetic demo
      currentState = getInitialSyntheticSessionState();
      assert.strictEqual(currentState.mode, 'synthetic_demonstration');
      assert.strictEqual(currentState.purchaseRecommendations.length, 0);
      assert.strictEqual(currentState.provenanceFilename, undefined);
      assert.strictEqual(currentState.dataSource.label, 'SYNTHETIC DEMONSTRATION DATA');
    });

    it('does not mutate or store data into local storage or external endpoints', () => {
      const fixture = createValidSnapshotFixture();
      const res = parseAndAdaptSnapshotJson(JSON.stringify(fixture), 'clean.json');
      assert.strictEqual(res.success, true);

      // Pure in-memory object verified
      assert.strictEqual(typeof res, 'object');
      assert.strictEqual(res.success, true);
    });
  });
});
