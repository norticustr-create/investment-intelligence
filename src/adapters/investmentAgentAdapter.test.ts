/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Investment Agent Snapshot Adapter Unit Tests
 * ============================================
 * Validates contract conversion, error handling, strict sign inversion,
 * null preservation, TRY currency preservation, recommendation separation,
 * and fail-closed safety gating.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  adaptPortfolioSnapshot,
  mapSnapshotCategory,
  mapTradingCurrency,
  SnapshotValidationError,
  InvestmentAgentPortfolioSnapshot,
  integrateIntelligenceIntoHoldings
} from './investmentAgentAdapter';
import { AssetIntelligenceReport } from '../types/investment';

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
      targetSumPct: 100,
      newMoneyBudgetTRY: 50000,
      holdingCount: 5
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
        investmentThesis: 'AI hardware computing infrastructure dominance',
        notes: 'Review quarterly earnings'
      },
      {
        asset: 'SPYM',
        category: 'US Stocks',
        quantity: 25.0,
        currentValueTRY: 120000.0,
        currentWeightPct: 12.0,
        targetWeightPct: 10.0,
        gapPct: -2.0,
        priority: 'MEDIUM',
        averageCostTRY: 4000.0,
        totalCostTRY: 100000.0,
        unrealizedPLTRY: 20000.0,
        unrealizedPLPct: 20.0,
        investmentThesis: 'S&P 500 broad market core allocation',
        notes: 'Trim if weight exceeds threshold'
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
        investmentThesis: 'Flagship aviation carrier global growth',
        notes: 'Domestic inflation hedge'
      },
      {
        asset: 'BTC',
        category: 'BTC',
        quantity: 0.1,
        currentValueTRY: 350000.0,
        currentWeightPct: 35.0,
        targetWeightPct: 35.0,
        gapPct: 0.0,
        priority: 'MEDIUM',
        averageCostTRY: null,
        totalCostTRY: null,
        unrealizedPLTRY: null,
        unrealizedPLPct: null,
        investmentThesis: 'Digital store of value allocation',
        notes: 'Cold storage'
      },
      {
        asset: 'TIO',
        category: 'Funds',
        quantity: 5000,
        currentValueTRY: 148023.0,
        currentWeightPct: 14.8023,
        targetWeightPct: 20.0,
        gapPct: 5.1977,
        priority: 'LOW',
        averageCostTRY: 25.0,
        totalCostTRY: 125000.0,
        unrealizedPLTRY: 23023.0,
        unrealizedPLPct: 18.4184,
        investmentThesis: 'Turkish mutual fund money market liquidity',
        notes: 'Yield generating cash buffer'
      }
    ],
    existingPurchaseRecommendations: [
      {
        asset: 'TIO',
        category: 'Funds',
        purchaseTRY: 35000.0,
        gapPp: 5.1977,
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

describe('investmentAgentAdapter', () => {
  describe('Category & Currency Helpers', () => {
    it('maps standard raw categories accurately', () => {
      assert.equal(mapSnapshotCategory('TR Stocks', 'THYAO'), 'turkish_equity');
      assert.equal(mapSnapshotCategory('Funds', 'TIO'), 'turkish_fund');
      assert.equal(mapSnapshotCategory('Bonds', 'BOND1'), 'turkish_fund');
      assert.equal(mapSnapshotCategory('BTC', 'BTC'), 'bitcoin');
      assert.equal(mapSnapshotCategory('US Stocks', 'NVDA'), 'equity');
      assert.equal(mapSnapshotCategory('US Stocks', 'SPYM'), 'etf');
      assert.equal(mapSnapshotCategory('US Stocks', 'VOO'), 'etf');
    });

    it('rejects unsupported categories with a SnapshotValidationError', () => {
      assert.throws(
        () => mapSnapshotCategory('Real Estate', 'PROP1'),
        (err: unknown) => {
          assert.ok(err instanceof SnapshotValidationError);
          assert.equal(err.field, 'category');
          assert.match(err.message, /Unrecognized position category "Real Estate"/);
          return true;
        }
      );
    });

    it('determines trading currency based on asset class', () => {
      assert.equal(mapTradingCurrency('TR Stocks', 'THYAO'), 'TRY');
      assert.equal(mapTradingCurrency('Funds', 'TIO'), 'TRY');
      assert.equal(mapTradingCurrency('Bonds', 'BOND1'), 'TRY');
      assert.equal(mapTradingCurrency('US Stocks', 'NVDA'), 'USD');
      assert.equal(mapTradingCurrency('BTC', 'BTC'), 'USD');
    });
  });

  describe('Contract Conversion (Valid Payload)', () => {
    it('converts a full valid snapshot cleanly', () => {
      const fixture = createValidSnapshotFixture();
      const result = adaptPortfolioSnapshot(fixture);

      assert.equal(result.schemaVersion, '1.0.0');
      assert.equal(result.exportMetadata.sourceSystem, 'InvestmentAgentLocal');
      assert.equal(result.automatedTradeExecutionBlocked, true);

      // Summary assertions
      assert.equal(result.summary.reportingCurrency, 'TRY');
      assert.equal(result.summary.totalValueTRY, 1000000);
      assert.equal(result.summary.holdingCount, 5);
      assert.equal(result.summary.newMoneyBudgetTRY, 50000);

      // Holdings assertions
      assert.equal(result.holdings.length, 5);
      const nvda = result.holdings.find(h => h.ticker === 'NVDA');
      assert.ok(nvda);
      assert.equal(nvda.category, 'equity');
      assert.equal(nvda.currency, 'TRY'); // Valuation denomination is TRY (preventing 38.5x inflation)
      assert.equal(nvda.tradingCurrency, 'USD'); // Native trading venue currency
      assert.equal(nvda.currentPriceNative, null);
      assert.equal(nvda.currentWeight, 8.1977);
      assert.equal(nvda.targetWeight, 10.0);
      assert.equal(nvda.costBasis, null);
      assert.equal(nvda.totalCostTRY, null);
      assert.equal(nvda.userThesis, 'AI hardware computing infrastructure dominance');
      assert.equal(nvda.userNotes, 'Review quarterly earnings');

      const spym = result.holdings.find(h => h.ticker === 'SPYM');
      assert.ok(spym);
      assert.equal(spym.category, 'etf');
      assert.equal(spym.currency, 'TRY');
      assert.equal(spym.tradingCurrency, 'USD');
      assert.equal(spym.costBasis, 4000.0);
      assert.equal(spym.totalCostTRY, 100000.0);
      assert.equal(spym.unrealizedPLTRY, 20000.0);
      assert.equal(spym.unrealizedPLPct, 20.0);

      // Top 1 ticker dynamic detection (BTC is largest holding at 350k TRY)
      assert.equal(result.summary.topHoldingsConcentration.top1Ticker, 'BTC');
      assert.equal(result.summary.evidenceFreshnessStats, undefined);
    });

    it('generates decision and profit engine inputs for each holding', () => {
      const fixture = createValidSnapshotFixture();
      const result = adaptPortfolioSnapshot(fixture, { asOfDate: '2026-02-20' });

      assert.equal(result.decisionEvaluationInputs.size, 5);
      assert.equal(result.profitRealizationInputs.size, 5);

      const nvdaDecisionInput = result.decisionEvaluationInputs.get('NVDA');
      assert.ok(nvdaDecisionInput);
      assert.equal(nvdaDecisionInput.holdingName, 'NVDA');
      assert.equal(nvdaDecisionInput.executionMode, 'real_decision');
      assert.equal(nvdaDecisionInput.allowSimulatedDemonstrationDraft, false);
      assert.equal(nvdaDecisionInput.asOfDate, '2026-02-20');

      const nvdaProfitInput = result.profitRealizationInputs.get('NVDA');
      assert.ok(nvdaProfitInput);
      assert.equal(nvdaProfitInput.holdingName, 'NVDA');
      assert.equal(nvdaProfitInput.executionMode, 'real_decision');
      assert.equal(nvdaProfitInput.costModel?.currency, 'TRY');
      assert.equal(nvdaProfitInput.asOfDate, '2026-02-20');
      // Untracked cost basis safely sets costBasisTotal to undefined in profit engine
      assert.equal(nvdaProfitInput.costBasisTotal, undefined);
    });
  });

  describe('Contract Schema & Validation Rules', () => {
    it('rejects unsupported schema versions', () => {
      const fixture = createValidSnapshotFixture();
      (fixture as unknown as Record<string, unknown>).schemaVersion = '2.0.0';

      assert.throws(
        () => adaptPortfolioSnapshot(fixture),
        (err: unknown) => {
          assert.ok(err instanceof SnapshotValidationError);
          assert.equal(err.field, 'schemaVersion');
          assert.match(err.message, /Unsupported schema version "2.0.0"/);
          return true;
        }
      );
    });

    it('rejects non-object or null payloads', () => {
      assert.throws(
        () => adaptPortfolioSnapshot(null),
        (err: unknown) => {
          assert.ok(err instanceof SnapshotValidationError);
          assert.match(err.message, /payload must be a non-null object/);
          return true;
        }
      );
      assert.throws(
        () => adaptPortfolioSnapshot([]),
        (err: unknown) => {
          assert.ok(err instanceof SnapshotValidationError);
          assert.match(err.message, /payload must be a non-null object/);
          return true;
        }
      );
    });

    it('rejects missing or empty metadata fields', () => {
      const fixture = createValidSnapshotFixture();
      (fixture.exportMetadata as unknown as Record<string, unknown>).sourceSystem = ' ';

      assert.throws(
        () => adaptPortfolioSnapshot(fixture),
        (err: unknown) => {
          assert.ok(err instanceof SnapshotValidationError);
          assert.equal(err.field, 'exportMetadata.sourceSystem');
          return true;
        }
      );
    });

    it('rejects non-TRY reporting currency', () => {
      const fixture = createValidSnapshotFixture();
      (fixture.exportMetadata as unknown as Record<string, unknown>).reportingCurrency = 'USD';

      assert.throws(
        () => adaptPortfolioSnapshot(fixture),
        (err: unknown) => {
          assert.ok(err instanceof SnapshotValidationError);
          assert.equal(err.field, 'exportMetadata.reportingCurrency');
          assert.match(err.message, /Unsupported reporting currency "USD"/);
          return true;
        }
      );
    });

    it('rejects non-finite and negative numeric summary values', () => {
      const fixture = createValidSnapshotFixture();
      fixture.portfolioSummary.totalInvestedValueTRY = -500;

      assert.throws(
        () => adaptPortfolioSnapshot(fixture),
        (err: unknown) => {
          assert.ok(err instanceof SnapshotValidationError);
          assert.equal(err.field, 'portfolioSummary.totalInvestedValueTRY');
          assert.match(err.message, /must be non-negative/);
          return true;
        }
      );

      const fixture2 = createValidSnapshotFixture();
      fixture2.portfolioSummary.totalInvestedValueTRY = NaN;

      assert.throws(
        () => adaptPortfolioSnapshot(fixture2),
        (err: unknown) => {
          assert.ok(err instanceof SnapshotValidationError);
          assert.equal(err.field, 'portfolioSummary.totalInvestedValueTRY');
          assert.match(err.message, /must be a finite number/);
          return true;
        }
      );
    });

    it('rejects duplicate asset symbols in positions', () => {
      const fixture = createValidSnapshotFixture();
      // Replace existing position at index 1 with duplicate asset from index 0
      fixture.positions[1].asset = fixture.positions[0].asset;

      assert.throws(
        () => adaptPortfolioSnapshot(fixture),
        (err: unknown) => {
          assert.ok(err instanceof SnapshotValidationError);
          assert.equal(err.field, 'positions[1].asset');
          assert.match(err.message, /Duplicate asset identifier "NVDA"/);
          return true;
        }
      );
    });
  });

  describe('Sign Inversion & Math Conventions', () => {
    it('inverts gap percentage to domain drift percentage', () => {
      const fixture = createValidSnapshotFixture();
      const result = adaptPortfolioSnapshot(fixture);

      // NVDA: Python gap = +1.8023 (underweight: Target 10% - Current 8.1977%)
      // Domain drift = Current - Target = -1.8023 (negative drift)
      const nvda = result.holdings.find(h => h.ticker === 'NVDA')!;
      assert.equal(nvda.driftPercentage, -1.8023);

      // SPYM: Python gap = -2.0 (overweight: Target 10% - Current 12%)
      // Domain drift = Current - Target = +2.0 (positive drift)
      const spym = result.holdings.find(h => h.ticker === 'SPYM')!;
      assert.equal(spym.driftPercentage, 2.0);

      // BTC: gap = 0.0 -> drift = 0.0
      const btc = result.holdings.find(h => h.ticker === 'BTC')!;
      assert.equal(btc.driftPercentage, 0.0);
    });
  });

  describe('Missing Data & Null Preservation', () => {
    it('strictly preserves null cost basis and P&L without zero-substitution', () => {
      const fixture = createValidSnapshotFixture();
      const result = adaptPortfolioSnapshot(fixture);

      const nvda = result.holdings.find(h => h.ticker === 'NVDA')!;
      assert.strictEqual(nvda.costBasis, null);
      assert.strictEqual(nvda.totalCostTRY, null);
      assert.strictEqual(nvda.unrealizedPLTRY, null);
      assert.strictEqual(nvda.unrealizedPLPct, null);
      assert.strictEqual(nvda.currentPriceNative, null);

      // Confirm that zero is never substituted
      assert.notEqual(nvda.costBasis, 0);
      assert.notEqual(nvda.totalCostTRY, 0);
      assert.notEqual(nvda.unrealizedPLTRY, 0);
    });

    it('records disclosure notices for untracked cost bases', () => {
      const fixture = createValidSnapshotFixture();
      const result = adaptPortfolioSnapshot(fixture);

      assert.ok(result.validationDisclosures.length >= 2);
      assert.ok(result.validationDisclosures.some(d => d.includes('NVDA') && d.includes('Missing acquisition cost basis')));
      assert.ok(result.validationDisclosures.some(d => d.includes('BTC') && d.includes('Missing acquisition cost basis')));
    });
  });

  describe('Separation of Recommendations', () => {
    it('keeps existing purchase recommendations separate from holdings', () => {
      const fixture = createValidSnapshotFixture();
      const result = adaptPortfolioSnapshot(fixture);

      assert.equal(result.holdings.length, 5);
      assert.equal(result.purchaseRecommendations.length, 2);

      // Recommendations are exactly the incoming purchase items
      assert.equal(result.purchaseRecommendations[0].asset, 'TIO');
      assert.equal(result.purchaseRecommendations[0].purchaseTRY, 35000);
      assert.equal(result.purchaseRecommendations[1].asset, 'NVDA');
      assert.equal(result.purchaseRecommendations[1].purchaseTRY, 15000);

      // Verify that recommendation items are not appended to holdings
      const holdingAssets = result.holdings.map(h => h.ticker);
      assert.deepEqual(holdingAssets, ['NVDA', 'SPYM', 'THYAO', 'BTC', 'TIO']);
    });

    it('accepts an empty array of recommendations', () => {
      const fixture = createValidSnapshotFixture();
      fixture.existingPurchaseRecommendations = [];
      const result = adaptPortfolioSnapshot(fixture);

      assert.equal(result.purchaseRecommendations.length, 0);
      assert.deepEqual(result.purchaseRecommendations, []);
    });

    it('rejects missing (undefined) existingPurchaseRecommendations', () => {
      const fixture = createValidSnapshotFixture();
      delete (fixture as unknown as Record<string, unknown>).existingPurchaseRecommendations;

      assert.throws(
        () => adaptPortfolioSnapshot(fixture),
        (err: unknown) => {
          assert.ok(err instanceof SnapshotValidationError);
          assert.equal(err.field, 'existingPurchaseRecommendations');
          assert.match(err.message, /must be an array/);
          return true;
        }
      );
    });

    it('rejects null existingPurchaseRecommendations', () => {
      const fixture = createValidSnapshotFixture();
      (fixture as unknown as Record<string, unknown>).existingPurchaseRecommendations = null;

      assert.throws(
        () => adaptPortfolioSnapshot(fixture),
        (err: unknown) => {
          assert.ok(err instanceof SnapshotValidationError);
          assert.equal(err.field, 'existingPurchaseRecommendations');
          assert.match(err.message, /must be an array/);
          return true;
        }
      );
    });

    it('rejects string existingPurchaseRecommendations', () => {
      const fixture = createValidSnapshotFixture();
      (fixture as unknown as Record<string, unknown>).existingPurchaseRecommendations = 'not-an-array';

      assert.throws(
        () => adaptPortfolioSnapshot(fixture),
        (err: unknown) => {
          assert.ok(err instanceof SnapshotValidationError);
          assert.equal(err.field, 'existingPurchaseRecommendations');
          assert.match(err.message, /must be an array/);
          return true;
        }
      );
    });

    it('rejects object existingPurchaseRecommendations', () => {
      const fixture = createValidSnapshotFixture();
      (fixture as unknown as Record<string, unknown>).existingPurchaseRecommendations = { asset: 'TIO' };

      assert.throws(
        () => adaptPortfolioSnapshot(fixture),
        (err: unknown) => {
          assert.ok(err instanceof SnapshotValidationError);
          assert.equal(err.field, 'existingPurchaseRecommendations');
          assert.match(err.message, /must be an array/);
          return true;
        }
      );
    });
  });

  describe('Evidence & Security Guardrails', () => {
    it('does not treat user thesis/notes as verified statutory evidence', () => {
      const fixture = createValidSnapshotFixture();
      const result = adaptPortfolioSnapshot(fixture);

      // 1. In adapted holdings:
      for (const holding of result.holdings) {
        assert.deepEqual(
          holding.supportingEvidenceIds,
          [],
          `Holding ${holding.ticker} must not have synthetic supporting evidence IDs`
        );
        assert.deepEqual(
          holding.counterevidenceIds,
          [],
          `Holding ${holding.ticker} must not have synthetic counterevidence IDs`
        );
      }

      // 2. In decisionEvaluationInputs:
      for (const [, decisionInput] of result.decisionEvaluationInputs) {
        assert.deepEqual(
          decisionInput.traceableEvidenceIds ?? [],
          [],
          `Holding ${decisionInput.holdingName} must not have synthetic evidence IDs`
        );
      }

      // 3. In profitRealizationInputs:
      for (const [, profitInput] of result.profitRealizationInputs) {
        assert.deepEqual(
          profitInput.traceableEvidenceIds ?? [],
          [],
          `Holding ${profitInput.holdingName} must not have synthetic evidence IDs`
        );
      }
    });

    it('permanently blocks automated trade execution flag', () => {
      const fixture = createValidSnapshotFixture();
      const result = adaptPortfolioSnapshot(fixture);

      assert.strictEqual(result.automatedTradeExecutionBlocked, true);
    });

    it('does not mutate the source snapshot payload', () => {
      const fixture = createValidSnapshotFixture();
      const copyBefore = JSON.parse(JSON.stringify(fixture));

      adaptPortfolioSnapshot(fixture);

      assert.deepEqual(fixture, copyBefore);
    });
  });

  describe('integrateIntelligenceIntoHoldings (Phase 7)', () => {
    it('integrates intelligence reports into holdings, maps evidence findings, and updates review status', () => {
      const fixture = createValidSnapshotFixture();
      const { holdings } = adaptPortfolioSnapshot(fixture);

      const mockReports: Record<string, AssetIntelligenceReport> = {
        NVDA: {
          asset: 'NVDA',
          as_of_date: '2026-02-25',
          thesis_evaluated: 'AI compute',
          overall_health: 'SOUND',
          thesis_status: 'questionable',
          review_required: true,
          review_reason: 'Antitrust probe initiated by DOJ into datacenter networking bundling',
          uncertainty_level: 'MODERATE',
          uncertainty_explanation: 'DOJ investigation status unconfirmed in primary 10-K.',
          suggested_action: 'HOLD',
          findings: [
            {
              id: 'f-nvda-1',
              holding_id: 'NVDA',
              source_doc_id: 'doc-sec-1',
              claim: 'Data center margins expanded to 75%',
              excerpt: 'Gross margins for Data Center reached 75.1%.',
              type: 'verified_fact',
              verification_status: 'verified_primary',
              evidence_quality: 'high_statutory',
              materiality: 'HIGH',
              thesis_impact: 'SUPPORTS_THESIS',
              supports_moat_destruction: false,
              explanation: 'Audited statutory numbers from Form 10-K.',
              source_url: 'https://sec.gov/nvda-10k',
              source_title: 'SEC Form 10-K FY2026'
            },
            {
              id: 'f-nvda-2',
              holding_id: 'NVDA',
              source_doc_id: 'doc-regulatory-1',
              claim: 'DOJ opened preliminary review into interconnect exclusivity',
              excerpt: 'Regulators requested information regarding software locks.',
              type: 'conflicting_evidence',
              verification_status: 'unverified_third_party',
              evidence_quality: 'conflicting',
              materiality: 'MEDIUM',
              thesis_impact: 'CHALLENGES_THESIS',
              supports_moat_destruction: false,
              explanation: 'Third-party reports cite pending DOJ review.',
              source_url: 'https://news.example.com/nvda-probe',
              source_title: 'Market Investigation Release'
            }
          ],
          unresolved_questions: ['Will DOJ probe result in formal consent decree?'],
          automated_execution_blocked: true,
          documents_analyzed: 2,
          generation_timestamp: '2026-02-25T14:00:00Z',
          model_version: 'gemini-2.5-pro'
        }
      };

      const result = integrateIntelligenceIntoHoldings(holdings, mockReports);

      assert.equal(result.enrichedHoldings.length, holdings.length);
      const nvda = result.enrichedHoldings.find(h => h.ticker === 'NVDA');
      assert.ok(nvda, 'NVDA holding must exist');
      assert.equal(nvda?.intelligenceReport?.overall_health, 'SOUND');
      assert.equal(nvda?.reviewStatus, 'review_required');
      assert.equal(nvda?.reviewReason, 'Antitrust probe initiated by DOJ into datacenter networking bundling');

      // Verify supporting & counter evidence separation
      assert.deepEqual(nvda?.supportingEvidenceIds, ['f-nvda-1']);
      assert.deepEqual(nvda?.counterevidenceIds, ['f-nvda-2']);

      // Verify unresolved questions merged
      assert.ok(nvda?.unresolvedQuestions.includes('Will DOJ probe result in formal consent decree?'));

      // Verify live findings & documents extracted
      assert.equal(result.liveFindings.length, 2);
      assert.equal(result.liveDocs.length, 2);
      assert.ok(result.reviewQueueCount >= 1);
    });

    it('sets reviewStatus to insufficient_evidence when suggested_action is INSUFFICIENT_EVIDENCE', () => {
      const fixture = createValidSnapshotFixture();
      const { holdings } = adaptPortfolioSnapshot(fixture);

      const mockReports: Record<string, AssetIntelligenceReport> = {
        SPYM: {
          asset: 'SPYM',
          as_of_date: '2026-02-25',
          thesis_evaluated: 'S&P 500 ETF',
          overall_health: 'SOUND',
          thesis_status: 'intact',
          review_required: false,
          review_reason: null,
          uncertainty_level: 'HIGH',
          uncertainty_explanation: 'No filings indexed',
          suggested_action: 'INSUFFICIENT_EVIDENCE',
          findings: [],
          unresolved_questions: [],
          automated_execution_blocked: true,
          documents_analyzed: 0,
          generation_timestamp: '2026-02-25T14:00:00Z',
          model_version: 'gemini-2.5-pro'
        }
      };

      const result = integrateIntelligenceIntoHoldings(holdings, mockReports);
      const spym = result.enrichedHoldings.find(h => h.ticker === 'SPYM');
      assert.ok(spym);
      assert.equal(spym?.reviewStatus, 'insufficient_evidence');
    });

    it('handles empty or missing reports gracefully without mutating holdings', () => {
      const fixture = createValidSnapshotFixture();
      const { holdings } = adaptPortfolioSnapshot(fixture);

      const result = integrateIntelligenceIntoHoldings(holdings, {} as Record<string, AssetIntelligenceReport>);
      assert.equal(result.enrichedHoldings.length, holdings.length);
      assert.equal(result.liveFindings.length, 0);
      assert.equal(result.liveDocs.length, 0);
    });
  });
});
