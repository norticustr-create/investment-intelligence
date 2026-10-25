/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Holding, SourceDocument, EvidenceFinding, PortfolioSummary } from '../types/investment';

// Primary exchange rate used for deterministic USD consolidation
export const SYNTHETIC_USD_TRY_RATE = 38.50;

export const SYNTHETIC_SOURCE_DOCUMENTS: SourceDocument[] = [
  // --- MSFT Sources ---
  {
    id: 'doc-msft-10k-2025',
    title: 'Microsoft Corporation Annual Report Form 10-K (Synthetic Model)',
    sourceName: 'U.S. Securities and Exchange Commission (EDGAR Simulation Archive)',
    sourceType: 'SEC_FILING',
    identifier: 'SYNTHETIC-SEC-Form-10K-FY2025 · Commission File No. 001-37845 · Acc: 0000950170-25-089123',
    publicationDate: '2025-07-31',
    reportingPeriod: 'FY 2025 (Ended June 30, 2025)',
    dataTimestamp: '2025-06-30T00:00:00Z',
    retrievalTimestamp: '2026-02-15T08:00:00Z',
    url: 'synthetic://sec-edgar.internal.archive/doc-msft-10k-2025',
    isAudited: true,
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'adequate',
    isSyntheticDemonstration: true,
    notes: 'Synthetic demonstration filing modeled after Deloitte & Touche LLP unqualified audit opinion on consolidated statements.'
  },
  {
    id: 'doc-msft-10q-q2-2026',
    title: 'Microsoft Corporation Quarterly Report Form 10-Q Q2 FY2026 (Synthetic Model)',
    sourceName: 'U.S. Securities and Exchange Commission (EDGAR Simulation Archive)',
    sourceType: 'SEC_FILING',
    identifier: 'SYNTHETIC-SEC-Form-10Q-Q2FY2026 · Acc: 0000950170-26-004312',
    publicationDate: '2026-01-29',
    reportingPeriod: 'Q2 FY 2026 (Ended Dec 31, 2025)',
    dataTimestamp: '2025-12-31T00:00:00Z',
    retrievalTimestamp: '2026-02-15T08:00:00Z',
    url: 'synthetic://sec-edgar.internal.archive/doc-msft-10q-q2-2026',
    isAudited: false,
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'fresh',
    isSyntheticDemonstration: true,
    notes: 'Synthetic quarterly filing reviewed by independent accountants. Cloud revenue expanded 21% constant currency.'
  },
  {
    id: 'doc-msft-ftc-antitrust-2025',
    title: 'FTC & European Commission Cloud Interoperability Inquiry Findings (Synthetic Model)',
    sourceName: 'Regulatory Competition Oversight Working Group (Simulation Record)',
    sourceType: 'ANNUAL_REPORT',
    identifier: 'SYNTHETIC-REG-EC-AT.40912 / FTC-241-0089',
    publicationDate: '2025-11-14',
    reportingPeriod: 'H2 2025 Regulatory Review',
    dataTimestamp: '2025-11-14T00:00:00Z',
    retrievalTimestamp: '2026-02-15T08:00:00Z',
    url: 'synthetic://regulatory-archive.internal.local/doc-msft-ftc-antitrust-2025',
    isAudited: false,
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'fresh',
    isSyntheticDemonstration: true,
    notes: 'Synthetic regulatory probe into software licensing penalties for non-Azure hyperscaler migrations.'
  },

  // --- VT ETF Sources ---
  {
    id: 'doc-vt-prospectus-2025',
    title: 'Vanguard Total World Stock Index Fund Prospectus & SAI (Synthetic Model)',
    sourceName: 'Vanguard Group Regulatory Filing / SEC EDGAR Simulation Archive',
    sourceType: 'SEC_FILING',
    identifier: 'SYNTHETIC-SEC-Vanguard-Trust-033-32216 · CIK: 0000857489',
    publicationDate: '2025-10-25',
    reportingPeriod: 'Annual Filing Period 2025',
    dataTimestamp: '2025-10-25T00:00:00Z',
    retrievalTimestamp: '2026-02-15T08:00:00Z',
    url: 'synthetic://sec-edgar.internal.archive/doc-vt-prospectus-2025',
    isAudited: true,
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'fresh',
    isSyntheticDemonstration: true,
    notes: 'Synthetic prospectus model. Net expense ratio verified at 0.07%.'
  },
  {
    id: 'doc-vt-factsheet-q4-2025',
    title: 'Vanguard Total World Stock ETF Quarterly Factsheet Q4 2025 (Synthetic Model)',
    sourceName: 'Vanguard Institutional Research Services (Simulation Archive)',
    sourceType: 'ANNUAL_REPORT',
    identifier: 'SYNTHETIC-VT-FACTSHEET-2025Q4-GLB',
    publicationDate: '2026-01-15',
    reportingPeriod: 'Quarter Ended Dec 31, 2025',
    dataTimestamp: '2025-12-31T00:00:00Z',
    retrievalTimestamp: '2026-02-15T08:00:00Z',
    url: 'synthetic://vanguard-institutional.internal.local/vt-factsheet-q4-2025',
    isAudited: false,
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'fresh',
    isSyntheticDemonstration: true,
    notes: 'Synthetic factsheet reporting 9,842 constituent holdings across 49 market jurisdictions.'
  },

  // --- Bitcoin Sources ---
  {
    id: 'doc-btc-core-2025',
    title: 'Bitcoin Core v28.1 Consensus Engine & Node Architecture Audit (Synthetic Model)',
    sourceName: 'Bitcoin Core Open Source Repository / Consensus Verification (Simulation Archive)',
    sourceType: 'ONCHAIN_AUDIT',
    identifier: 'SYNTHETIC-GIT-COMMIT-7c94b2f15e8a · Release v28.1.0',
    publicationDate: '2025-11-08',
    reportingPeriod: 'Post-Halving Protocol State (Block 890,000+)',
    dataTimestamp: '2025-11-08T00:00:00Z',
    retrievalTimestamp: '2026-02-15T08:00:00Z',
    url: 'synthetic://bitcoin-consensus.internal.local/core-v28.1',
    isAudited: true,
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'fresh',
    isSyntheticDemonstration: true,
    notes: 'Synthetic open-source consensus verification model confirming 21M hard supply ceiling.'
  },
  {
    id: 'doc-btc-onchain-glassnode-2026',
    title: 'Institutional Custody & Long-Term Holder Supply Dynamics Report (Synthetic Model)',
    sourceName: 'Glassnode On-Chain Intelligence Services (Simulation Archive)',
    sourceType: 'ONCHAIN_AUDIT',
    identifier: 'SYNTHETIC-GLN-MACRO-WEEKLY-2026-W03',
    publicationDate: '2026-01-20',
    reportingPeriod: 'Trailing 365 Days to Jan 2026',
    dataTimestamp: '2026-01-20T00:00:00Z',
    retrievalTimestamp: '2026-02-15T08:00:00Z',
    url: 'synthetic://glassnode-insights.internal.local/macro-w03-2026',
    isAudited: false,
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'fresh',
    isSyntheticDemonstration: true,
    notes: 'Synthetic telemetry model: Long-term holder supply (>155 days dormant) at 71.4%.'
  },
  {
    id: 'doc-btc-bis-liquidity-2025',
    title: 'Bank for International Settlements: Crypto-Assets Regulatory Standard (Synthetic Model)',
    sourceName: 'Bank for International Settlements (Basel Committee Simulation Archive)',
    sourceType: 'CENTRAL_BANK_REPORT',
    identifier: 'SYNTHETIC-BIS-BCBS-582',
    publicationDate: '2025-09-18',
    reportingPeriod: 'FY 2025 Implementation Window',
    dataTimestamp: '2025-09-18T00:00:00Z',
    retrievalTimestamp: '2026-02-15T08:00:00Z',
    url: 'synthetic://bis-regulatory.internal.local/bcbs-582',
    isAudited: true,
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'adequate',
    isSyntheticDemonstration: true,
    notes: 'Synthetic central bank regulatory model regarding 1,250% bank capital risk weighting.'
  },

  // --- Turkish Equity (BIMAS) Sources ---
  {
    id: 'doc-bimas-kap-fin-2025-q3',
    title: 'BİM Birleşik Mağazalar A.Ş. 9M Consolidated Financial Statements (Synthetic Model)',
    sourceName: 'Kamuyu Aydınlatma Platformu (KAP Simulation Archive)',
    sourceType: 'KAP_DISCLOSURE',
    identifier: 'SYNTHETIC-KAP-Bildirim-1284910 · SPK Seri: II-14.1',
    publicationDate: '2025-11-06',
    reportingPeriod: '01.01.2025 - 30.09.2025 (9M 2025)',
    dataTimestamp: '2025-09-30T00:00:00Z',
    retrievalTimestamp: '2026-02-15T08:00:00Z',
    url: 'synthetic://kap-archive.internal.local/bildirim-1284910',
    isAudited: true,
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'adequate',
    isSyntheticDemonstration: true,
    notes: 'Synthetic disclosure model based on PwC limited audit review with IAS 29 inflation accounting applied.'
  },
  {
    id: 'doc-bimas-kap-investor-pres-2025',
    title: 'BİM A.Ş. Q3 2025 Management Operational Review (Synthetic Model)',
    sourceName: 'BİM Yatırımcı İlişkileri Direktörlüğü (Simulation Archive)',
    sourceType: 'KAP_DISCLOSURE',
    identifier: 'SYNTHETIC-BIM-IR-2025-9M-ENG',
    publicationDate: '2025-11-07',
    reportingPeriod: '9M 2025 Operations',
    dataTimestamp: '2025-09-30T00:00:00Z',
    retrievalTimestamp: '2026-02-15T08:00:00Z',
    url: 'synthetic://kap-archive.internal.local/bim-ir-2025-9m',
    isAudited: false,
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'adequate',
    isSyntheticDemonstration: true,
    notes: 'Synthetic disclosure model reporting 13,420 stores (Turkey: 12,380, Morocco: 790, Egypt: 250).'
  },

  // --- Turkish Investment Fund (TI2) Sources ---
  {
    id: 'doc-ti2-tefas-summary-2025',
    title: 'İş Portföy İki Nolu Değişken Fon (TI2) TEFAS Portföy Raporu (Synthetic Model)',
    sourceName: 'Türkiye Elektronik Fon Alım Satım Platformu (TEFAS Simulation Archive)',
    sourceType: 'TEFAS_FACTSHEET',
    identifier: 'SYNTHETIC-TEFAS-TI2-MONTHLY-202511',
    publicationDate: '2025-11-30',
    reportingPeriod: 'Kasım 2025 Portföy Dağılımı',
    dataTimestamp: '2025-11-30T00:00:00Z',
    retrievalTimestamp: '2026-02-15T08:00:00Z',
    url: 'synthetic://tefas-archive.internal.local/ti2-202511',
    isAudited: false,
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'stale', // Stale under TEFAS 45-day policy (>75 days elapsed)
    isSyntheticDemonstration: true,
    notes: 'Synthetic factsheet model demonstrating stale evidence (>75 days under TEFAS 45d policy threshold).'
  },
  {
    id: 'doc-ti2-kap-mandate-amendment',
    title: 'İş Portföy Fon Kurulu İzahname ve İçtüzük Değişiklik Bildirimi (Synthetic Model)',
    sourceName: 'Kamuyu Aydınlatma Platformu (KAP Simulation Archive)',
    sourceType: 'KAP_DISCLOSURE',
    identifier: 'SYNTHETIC-KAP-Bildirim-1279041 · Tüzük Revizyonu',
    publicationDate: '2025-10-14',
    reportingPeriod: 'Effective from November 2025',
    dataTimestamp: '2025-10-14T00:00:00Z',
    retrievalTimestamp: '2026-02-15T08:00:00Z',
    url: 'synthetic://kap-archive.internal.local/bildirim-1279041',
    isAudited: false,
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'stale',
    isSyntheticDemonstration: true,
    notes: 'Synthetic disclosure model demonstrating derivative ceiling expansion to 35% with unverified OTC counterparties.'
  },

  // --- SolarEdge (Thesis Impaired / SELL example) Sources ---
  {
    id: 'doc-sedg-10k-2025',
    title: 'SolarEdge Technologies Form 10-K & Restructuring Disclosures (Synthetic Model)',
    sourceName: 'U.S. Securities and Exchange Commission (EDGAR Simulation Archive)',
    sourceType: 'SEC_FILING',
    identifier: 'SYNTHETIC-SEC-Form-10K-SEDG-2025 · Acc: 0001628280-25-007812',
    publicationDate: '2025-03-12',
    reportingPeriod: 'FY 2024 / FY 2025 Restatement Disclosures',
    dataTimestamp: '2024-12-31T00:00:00Z',
    retrievalTimestamp: '2026-02-15T08:00:00Z',
    url: 'synthetic://sec-edgar.internal.archive/sedg-10k-2025',
    isAudited: true,
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'adequate',
    isSyntheticDemonstration: true,
    notes: 'Synthetic model of audited filing documenting structural negative gross margin (-8.2%) and $1.04B inventory obsolescence.'
  },
  {
    id: 'doc-sedg-8k-credit-covenant-2025',
    title: 'SolarEdge Form 8-K Credit Facility Amendment & Senior Waivers (Synthetic Model)',
    sourceName: 'U.S. Securities and Exchange Commission (EDGAR Simulation Archive)',
    sourceType: 'SEC_FILING',
    identifier: 'SYNTHETIC-SEC-Form-8K-SEDG-202509 · Item 1.01 Agreement',
    publicationDate: '2025-09-30',
    reportingPeriod: 'Q3 2025 Liquidity Emergency',
    dataTimestamp: '2025-09-30T00:00:00Z',
    retrievalTimestamp: '2026-02-15T08:00:00Z',
    url: 'synthetic://sec-edgar.internal.archive/sedg-8k-202509',
    isAudited: false,
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'adequate',
    isSyntheticDemonstration: true,
    notes: 'Synthetic model of binding material contract disclosure proving bank credit covenant breach.'
  }
];


export const SYNTHETIC_EVIDENCE_FINDINGS: EvidenceFinding[] = [
  // MSFT Findings
  {
    id: 'ev-msft-1',
    holdingId: 'h-msft',
    sourceDocId: 'doc-msft-10k-2025',
    claim: 'Microsoft Cloud gross margins remained resilient at 71% despite elevated capital intensity.',
    excerpt: 'Intelligent Cloud server and cloud services revenue increased 19%, driven by Azure growth of 30%. Intelligent Cloud operating income was $44.9 billion with operating margin of 48%.',
    type: 'verified_fact',
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'adequate',
    evidenceQuality: 'high_statutory',
    dataTimestamp: '2025-06-30T00:00:00Z',
    retrievalTimestamp: '2026-02-15T08:00:00Z',
    isSyntheticDemonstration: true,
    confidenceNotes: 'Simulated audited financial statements based on statutory SEC Form 10-K standards.',
    lastVerifiedDate: '2025-08-05'
  },
  {
    id: 'ev-msft-2',
    holdingId: 'h-msft',
    sourceDocId: 'doc-msft-10q-q2-2026',
    claim: 'Azure commercial backlog expanded to $298B with an average contract duration of 38 months.',
    excerpt: 'Commercial remaining performance obligations (RPO) increased 22% YoY to $298 billion. Roughly 44% will be recognized in the next 12 months, indicating high revenue durability.',
    type: 'verified_fact',
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'fresh',
    evidenceQuality: 'high_statutory',
    dataTimestamp: '2025-12-31T00:00:00Z',
    retrievalTimestamp: '2026-02-15T08:00:00Z',
    isSyntheticDemonstration: true,
    confidenceNotes: 'Simulated quarterly filing reviewed by independent accountants. Strong forward visibility.',
    lastVerifiedDate: '2026-02-01'
  },
  {
    id: 'ev-msft-3',
    holdingId: 'h-msft',
    sourceDocId: 'doc-msft-ftc-antitrust-2025',
    claim: 'Regulatory scrutiny may constrain Windows/Office bundle pricing leverage in EU markets.',
    excerpt: 'Preliminary findings recommend behavioral remedies prohibiting punitive license markups for customers hosting Microsoft 365 workloads on rival sovereign cloud infrastructures.',
    type: 'conflicting_evidence',
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'fresh',
    evidenceQuality: 'conflicting',
    dataTimestamp: '2025-11-14T00:00:00Z',
    retrievalTimestamp: '2026-02-15T08:00:00Z',
    isSyntheticDemonstration: true,
    confidenceNotes: 'Regulatory enforcement in deliberation phase; ultimate behavioral remedies remain unresolved.',
    lastVerifiedDate: '2025-12-10',
    isConflicting: true,
    conflictDescription: 'Management asserts bundling represents natural product synergy, whereas regulators view it as anticompetitive tying.'
  },
  {
    id: 'ev-msft-4',
    holdingId: 'h-msft',
    sourceDocId: 'doc-msft-10q-q2-2026',
    claim: 'Annualized CapEx run-rate reached $64B, creating near-term free cash flow margin compression.',
    excerpt: 'Capital expenditures including assets acquired under finance leases were $16.8 billion for the quarter, supporting AI datacenter capacity investments.',
    type: 'model_interpretation',
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'fresh',
    evidenceQuality: 'moderate_analytical',
    dataTimestamp: '2025-12-31T00:00:00Z',
    retrievalTimestamp: '2026-02-15T08:00:00Z',
    isSyntheticDemonstration: true,
    confidenceNotes: 'Analytical forecast: Cash outlays are factual, but permanent ROIC dilution depends on enterprise monetization.',
    lastVerifiedDate: '2026-02-02'
  },

  // VT Findings
  {
    id: 'ev-vt-1',
    holdingId: 'h-vt',
    sourceDocId: 'doc-vt-prospectus-2025',
    claim: 'Total annual operating expense ratio is guaranteed at 0.07%, minimizing fee drag over decade-long horizons.',
    excerpt: 'Management fees: 0.06%; 12b-1 distribution fees: None; Other expenses: 0.01%; Total annual operating expenses: 0.07%.',
    type: 'verified_fact',
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'fresh',
    evidenceQuality: 'high_statutory',
    dataTimestamp: '2025-10-25T00:00:00Z',
    retrievalTimestamp: '2026-02-15T08:00:00Z',
    isSyntheticDemonstration: true,
    confidenceNotes: 'Verified via statutory SEC prospectus model. Eliminates single-manager headline risk.',
    lastVerifiedDate: '2025-11-01'
  },
  {
    id: 'ev-vt-2',
    holdingId: 'h-vt',
    sourceDocId: 'doc-vt-factsheet-q4-2025',
    claim: 'FTSE Global All Cap tracking index holds 9,842 constituent stocks with top-10 concentration of 21.4%.',
    excerpt: 'The fund employs an indexing investment approach designed to track the performance of the FTSE Global All Cap Index, a market-capitalization-weighted index representing 98% of the world’s investable market capitalization.',
    type: 'verified_fact',
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'fresh',
    evidenceQuality: 'high_statutory',
    dataTimestamp: '2025-12-31T00:00:00Z',
    retrievalTimestamp: '2026-02-15T08:00:00Z',
    isSyntheticDemonstration: true,
    confidenceNotes: 'Confirmed by institutional holdings ledger model.',
    lastVerifiedDate: '2026-01-20'
  },
  {
    id: 'ev-vt-3',
    holdingId: 'h-vt',
    sourceDocId: 'doc-vt-factsheet-q4-2025',
    claim: 'US equity weighting sits at 62.8%, creating structural exposure to US Dollar valuation and mega-cap tech valuations.',
    excerpt: 'Geographic allocation: North America 63.4%, Europe 15.2%, Pacific 10.1%, Emerging Markets 10.9%, Other 0.4%.',
    type: 'model_interpretation',
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'fresh',
    evidenceQuality: 'moderate_analytical',
    dataTimestamp: '2025-12-31T00:00:00Z',
    retrievalTimestamp: '2026-02-15T08:00:00Z',
    isSyntheticDemonstration: true,
    confidenceNotes: 'Reflects free-float market cap weighting model.',
    lastVerifiedDate: '2026-01-20'
  },

  // BTC Findings
  {
    id: 'ev-btc-1',
    holdingId: 'h-btc',
    sourceDocId: 'doc-btc-core-2025',
    claim: 'Algorithmic supply schedule mathematically fixed with block subsidy at 3.125 BTC per 10 minutes.',
    excerpt: 'Consensus rule GetBlockSubsidy enforces halving every 210,000 blocks. Total cumulative emission strictly asymptotes to 20,999,999.9769 BTC.',
    type: 'verified_fact',
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'fresh',
    evidenceQuality: 'high_statutory',
    dataTimestamp: '2025-11-08T00:00:00Z',
    retrievalTimestamp: '2026-02-15T08:00:00Z',
    isSyntheticDemonstration: true,
    confidenceNotes: 'Verified across open-source consensus client specification model.',
    lastVerifiedDate: '2025-12-01'
  },
  {
    id: 'ev-btc-2',
    holdingId: 'h-btc',
    sourceDocId: 'doc-btc-onchain-glassnode-2026',
    claim: 'Illiquid supply held by long-term conviction addresses (>155 days) sits at 71.4% of total supply.',
    excerpt: 'Net flow of coins transitioning from short-term speculator tranches into multi-year cold storage vaults continued throughout 2025, reaching a multi-year high in illiquidity.',
    type: 'verified_fact',
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'fresh',
    evidenceQuality: 'high_statutory',
    dataTimestamp: '2026-01-20T00:00:00Z',
    retrievalTimestamp: '2026-02-15T08:00:00Z',
    isSyntheticDemonstration: true,
    confidenceNotes: 'Simulated on-chain public ledger cluster model.',
    lastVerifiedDate: '2026-01-25'
  },
  {
    id: 'ev-btc-3',
    holdingId: 'h-btc',
    sourceDocId: 'doc-btc-bis-liquidity-2025',
    claim: 'Severe regulatory capital charges (1,250% risk weight) prevent commercial bank balance sheets from adopting direct custody.',
    excerpt: 'Prudential treatment of crypto-asset exposures mandates Group 2 cryptoassets undergo punitive uncollateralized capital deductions, precluding fractional reserve banking integration.',
    type: 'conflicting_evidence',
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'adequate',
    evidenceQuality: 'conflicting',
    dataTimestamp: '2025-09-18T00:00:00Z',
    retrievalTimestamp: '2026-02-15T08:00:00Z',
    isSyntheticDemonstration: true,
    confidenceNotes: 'Limits commercial bank treasury adoption, yet spot exchange-traded products offer non-bank institutional access.',
    lastVerifiedDate: '2025-10-15',
    isConflicting: true,
    conflictDescription: 'Bullish thesis relies on institutional treasury adoption, while global bank regulators actively penalize direct bank balance sheet holding.'
  },

  // Turkish Equities (BIMAS) Findings
  {
    id: 'ev-bimas-1',
    holdingId: 'h-bimas',
    sourceDocId: 'doc-bimas-kap-fin-2025-q3',
    claim: 'BİM maintained positive real EBIT margins of 4.2% under IAS 29 hyperinflation accounting rules.',
    excerpt: 'Under TMS 29 Financial Reporting in Hyperinflationary Economies, 9M 2025 consolidated revenues reached 482.4 billion TL with consolidated net profit of 16.1 billion TL.',
    type: 'verified_fact',
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'adequate',
    evidenceQuality: 'high_statutory',
    dataTimestamp: '2025-09-30T00:00:00Z',
    retrievalTimestamp: '2026-02-15T08:00:00Z',
    isSyntheticDemonstration: true,
    confidenceNotes: 'PwC limited review audit model. Demonstrates negative working capital advantage.',
    lastVerifiedDate: '2025-11-10'
  },
  {
    id: 'ev-bimas-2',
    holdingId: 'h-bimas',
    sourceDocId: 'doc-bimas-kap-investor-pres-2025',
    claim: 'Network density reached 13,420 stores, delivering unmatched private-label purchasing power across suppliers.',
    excerpt: 'Private-label product revenue share represented 67.2% of total domestic sales, shielding gross margins against branded supplier price shocks.',
    type: 'verified_fact',
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'adequate',
    evidenceQuality: 'high_statutory',
    dataTimestamp: '2025-09-30T00:00:00Z',
    retrievalTimestamp: '2026-02-15T08:00:00Z',
    isSyntheticDemonstration: true,
    confidenceNotes: 'KAP regulatory disclosure model.',
    lastVerifiedDate: '2025-11-12'
  },
  {
    id: 'ev-bimas-3',
    holdingId: 'h-bimas',
    sourceDocId: 'doc-bimas-kap-fin-2025-q3',
    claim: 'Negative net debt position (-8.4 billion TL) shields company from domestic 40%+ interest rate refinancing costs.',
    excerpt: 'Cash and cash equivalents plus short-term financial investments exceeded total bank borrowings and lease liabilities by 8,410 million TL as of September 30, 2025.',
    type: 'verified_fact',
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'adequate',
    evidenceQuality: 'high_statutory',
    dataTimestamp: '2025-09-30T00:00:00Z',
    retrievalTimestamp: '2026-02-15T08:00:00Z',
    isSyntheticDemonstration: true,
    confidenceNotes: 'Clean balance sheet verified in audited filings model. High resilience.',
    lastVerifiedDate: '2025-11-10'
  },

  // Turkish Investment Fund (TI2) Findings
  {
    id: 'ev-ti2-1',
    holdingId: 'h-ti2',
    sourceDocId: 'doc-ti2-tefas-summary-2025',
    claim: 'Fund portfolio composition shows significant migration from BIST dividend equities into unlisted lease certificates.',
    excerpt: 'Portföy Dağılımı: Özel Sektör Kira Sertifikaları %34.2, BIST Hisse Senedi %28.5, Vadeli Mevduat/Ters Repo %22.1, Yabancı Menkul Kıymet %15.2.',
    type: 'stale_evidence',
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'stale',
    evidenceQuality: 'insufficient',
    dataTimestamp: '2025-11-30T00:00:00Z',
    retrievalTimestamp: '2026-02-15T08:00:00Z',
    isSyntheticDemonstration: true,
    confidenceNotes: 'Report exceeds TEFAS monthly freshness threshold without subsequent monthly attribution release.',
    lastVerifiedDate: '2025-12-05'
  },
  {
    id: 'ev-ti2-2',
    holdingId: 'h-ti2',
    sourceDocId: 'doc-ti2-kap-mandate-amendment',
    claim: 'Derivatives hedging limit expanded up to 35% without clear counterparty risk disclosures.',
    excerpt: 'Fon tüzüğünde yapılan revizyonla türev araç kullanım tavanı %10 seviyesinden %35 seviyesine yükseltilmiş olup tezgâhüstü swap sözleşmelerine izin verilmiştir.',
    type: 'conflicting_evidence',
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'stale',
    evidenceQuality: 'conflicting',
    dataTimestamp: '2025-10-14T00:00:00Z',
    retrievalTimestamp: '2026-02-15T08:00:00Z',
    isSyntheticDemonstration: true,
    confidenceNotes: 'KAP formal filing confirmed amendment, but underlying OTC counterparties and collateral haircuts are unpopulated.',
    lastVerifiedDate: '2025-10-20',
    isConflicting: true,
    conflictDescription: 'Marketing material emphasizes conservative multi-asset wealth preservation, while the updated mandate permits substantial OTC derivative leverage.'
  },

  // SolarEdge (SEDG) Findings - Thesis Break / SELL Example
  {
    id: 'ev-sedg-1',
    holdingId: 'h-sedg',
    sourceDocId: 'doc-sedg-10k-2025',
    claim: 'Operating gross margin inverted to -8.2% as distributor channels in Europe suffered structural oversupply.',
    excerpt: 'Gross margin decreased to negative 8.2% compared to 27.1% in the prior year, primarily due to inventory obsolescence write-downs of $1.04 billion and underutilization charges.',
    type: 'verified_fact',
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'adequate',
    evidenceQuality: 'high_statutory',
    dataTimestamp: '2024-12-31T00:00:00Z',
    retrievalTimestamp: '2026-02-15T08:00:00Z',
    isSyntheticDemonstration: true,
    confidenceNotes: 'Audited SEC 10-K report model with independent auditor explanatory paragraph regarding internal control deficiencies.',
    lastVerifiedDate: '2025-03-20'
  },
  {
    id: 'ev-sedg-2',
    holdingId: 'h-sedg',
    sourceDocId: 'doc-sedg-8k-credit-covenant-2025',
    claim: 'Senior credit facility forced strict liquidity covenants and punitive interest rate step-ups.',
    excerpt: 'Amendment No. 3 requires maintenance of minimum consolidated liquidity of $150 million and imposes restrictions on capital expenditures and customer financing receivables.',
    type: 'verified_fact',
    verificationStatus: 'simulated_demonstration',
    freshnessStatus: 'adequate',
    evidenceQuality: 'high_statutory',
    dataTimestamp: '2025-09-30T00:00:00Z',
    retrievalTimestamp: '2026-02-15T08:00:00Z',
    isSyntheticDemonstration: true,
    confidenceNotes: 'Legally binding 8-K material contract disclosure model. Severely limits R&D and next-gen roadmap.',
    lastVerifiedDate: '2025-10-05'
  }
];

export const SYNTHETIC_HOLDINGS: Holding[] = [
  // 1. Individual Equity: Microsoft Corporation (MSFT) -> HOLD
  {
    id: 'h-msft',
    ticker: 'MSFT',
    name: 'Microsoft Corporation',
    category: 'equity',
    currency: 'USD',
    currentPrice: 428.50,
    costBasis: 342.10,
    sharesOrUnits: 120,
    currentValue: 51420.00,
    currentWeight: 25.1,
    targetWeight: 25.0,
    driftPercentage: 0.1,
    reviewStatus: 'up_to_date',
    thesisTitle: 'Enterprise OS, Cloud Hyperscaler Duopoly & Enterprise Software Moat',
    thesisPremise: 'Microsoft commands enduring competitive advantages via ubiquitous enterprise software integration (Office 365, Teams, Windows), mission-critical cloud platform lock-in (Azure), and disciplined capital allocation. High customer switching costs and predictable multi-year enterprise contracts provide durable recurring cash flows across business cycles.',
    economicMoatDescription: 'Wide Moat: Massive network effects in enterprise productivity, high switching costs in relational databases and active directory infrastructure, and multi-tenant cloud scale with AWS.',
    investmentHorizonYears: 5,
    capitalAllocationAssessment: 'Exemplary: Balance sheet pristine with AAA equivalent net cash position; disciplined shareholder return through dividend increases and systematic buybacks; aggressive but focused AI infrastructure investments.',
    valuationSummary: 'Valuation is full but reasonable for a business delivering >35% return on invested capital. FCF yield of 2.9% provides adequate downside protection given 15%+ EPS compounding capacity.',
    metrics: [
      { label: 'Forward P/E', currentValue: '30.8x', historicalRangeOrBenchmark: '26x - 34x (5Y Median 29.5x)', context: 'Trades in line with 5-year historical median valuation', isFavorable: null },
      { label: 'Free Cash Flow Yield', currentValue: '2.92%', historicalRangeOrBenchmark: '2.5% - 3.8%', context: 'Compressed temporarily due to peak datacenter CapEx cycle', isFavorable: false },
      { label: 'ROIC (ex-cash)', currentValue: '37.4%', historicalRangeOrBenchmark: '>20% benchmark', context: 'Consistently exceptional capital return profile', isFavorable: true },
      { label: 'Azure YoY Growth', currentValue: '+30% (CC)', historicalRangeOrBenchmark: '+25% - +32%', context: 'Backlog expansion confirms enterprise demand durability', isFavorable: true }
    ],
    downsideScenario: 'Antitrust unbundling in Europe and prolonged payback periods on AI datacenter infrastructure could compress operating margins from 44% to 38%, supporting a baseline valuation floor around $340 (-21%).',
    supportingEvidenceIds: ['ev-msft-1', 'ev-msft-2'],
    counterevidenceIds: ['ev-msft-3', 'ev-msft-4'],
    missingInformation: [
      'Exact ROI breakdown and monetization timeline for enterprise Copilot seats across Fortune 500 customers.',
      'Final terms of European Commission cloud licensing interoperability settlement.'
    ],
    unresolvedQuestions: [
      'Will elevated CapEx ($60B+ annualized) permanently lower incremental capital return or establish an insurmountable moat in enterprise reasoning infrastructure?'
    ],
    decision: {
      outcome: 'HOLD',
      rationale: 'The core long-term investment thesis remains intact. High recurring revenues, durable switching costs, and strong Azure backlog confirm business health. Although the valuation is at historical averages and CapEx is elevated, evidence does not warrant a reduction, and current allocation (25.1%) aligns with the 25.0% target.',
      supportingEvidenceSummary: [
        'Cloud gross margins verified at 71% in audited SEC Form 10-K.',
        'Commercial RPO expanded 22% YoY to $298B, guaranteeing 3+ years of high-visibility cash flows.'
      ],
      counterarguments: [
        'Near-term FCF margin compression from $64B annualized CapEx outlays.',
        'Ongoing EU regulatory inquiries into software bundle pricing parity.'
      ],
      uncertaintyLevel: 'LOW',
      uncertaintyExplanation: 'Financial statements are audited, transparent, and verified across multiple reporting cycles.',
      conditionsForChange: [
        'Increase Condition: Substantial market pullback driving FCF yield above 4.0% combined with target allocation budget room.',
        'Reduce/Sell Condition: Azure constant-currency growth decelerating below 15% for three consecutive quarters alongside evidence of enterprise active directory migration to alternative ecosystems.'
      ],
      ruleComplianceCheck: {
        rule1DefaultHoldChecked: true,
        rule2PriceDropNotTriggeredSell: true,
        rule3AllocationDriftNotSoleReason: true,
        rule6EvidenceSufficiencyChecked: true
      },
      lastReviewedDate: '2026-02-15',
      nextScheduledReviewDate: '2026-05-15'
    }
  },

  // 2. ETF: Vanguard Total World Stock ETF (VT) -> HOLD
  {
    id: 'h-vt',
    ticker: 'VT',
    name: 'Vanguard Total World Stock ETF',
    category: 'etf',
    currency: 'USD',
    currentPrice: 122.40,
    costBasis: 104.80,
    sharesOrUnits: 380,
    currentValue: 46512.00,
    currentWeight: 22.7,
    targetWeight: 25.0,
    driftPercentage: -2.3,
    reviewStatus: 'up_to_date',
    thesisTitle: 'Cost-Minimized Global Capitalist Enterprise Participation',
    thesisPremise: 'Holding VT provides frictionless, ultra-low-cost exposure to global human enterprise across 9,800+ listed corporations in 49 countries. By removing active manager risk, style rotation bets, and regional home bias, VT captures the long-term equity risk premium at 7 basis points per year.',
    economicMoatDescription: 'Structural Vehicle Moat: Vanguard mutual ownership structure continually returns scale economies to investors via fee reduction. Unmatched global liquidity and deep lending revenue offset index tracking error.',
    investmentHorizonYears: 10,
    capitalAllocationAssessment: 'Passive Rule-Based: Free-float capitalization indexing automatically weeds out secular declining firms and scales winning enterprises without discretionary capital misallocation.',
    valuationSummary: 'Aggregate weighted portfolio P/E of 19.8x and dividend yield of 1.95%. Captures broad global enterprise cash generation without single-country concentration risk.',
    metrics: [
      { label: 'Expense Ratio', currentValue: '0.07%', historicalRangeOrBenchmark: '0.07% (Category Avg 0.45%)', context: 'Ultra-low cost leadership confirmed by prospectus', isFavorable: true },
      { label: 'Holdings Count', currentValue: '9,842', historicalRangeOrBenchmark: '>9,000 global equities', context: 'Maximum available global public equity breadth', isFavorable: true },
      { label: 'US Equity Weight', currentValue: '62.8%', historicalRangeOrBenchmark: '55% - 65% (Float-adjusted)', context: 'Reflects global market capitalization distribution', isFavorable: null },
      { label: '10Y Tracking Error', currentValue: '<0.04%', historicalRangeOrBenchmark: '<0.10%', context: 'Near-perfect index replication discipline', isFavorable: true }
    ],
    downsideScenario: 'Global systemic stagflation or synchronized multi-region recession could depress worldwide corporate earnings, resulting in an index drawdown of 30-40% comparable to historic global bear markets.',
    supportingEvidenceIds: ['ev-vt-1', 'ev-vt-2'],
    counterevidenceIds: ['ev-vt-3'],
    missingInformation: [
      'Granular breakdown of tax drag from un-reclaimable withholding taxes across second-tier emerging market holdings.'
    ],
    unresolvedQuestions: [
      'Will US market capitalization dominance (>62%) persist or gradually mean-revert toward international developed and emerging economies over the next decade?'
    ],
    decision: {
      outcome: 'HOLD',
      rationale: 'VT functions as the foundational core asset of the portfolio. Current allocation is 22.7% versus a 25.0% target. While the allocation is slightly below target (-2.3% drift), Rule 1 mandates HOLD as the baseline, and the slight variance is within the standard rebalancing tolerance band (±3%). The thesis is completely sound.',
      supportingEvidenceSummary: [
        'Audited 0.07% expense ratio confirmed in statutory SEC filing.',
        'Full global diversification across 9,842 companies verified in Q4 2025 factsheet.'
      ],
      counterarguments: [
        'Heavy US geographic concentration (62.8%) leaves the fund vulnerable to US dollar strength cycles.'
      ],
      uncertaintyLevel: 'LOW',
      uncertaintyExplanation: 'Audited, regulated statutory investment fund with high transparency and decades of replication fidelity.',
      conditionsForChange: [
        'Increase Condition: Planned quarterly capital contribution will naturally rebalance toward the 25.0% target.',
        'Reduce/Sell Condition: Only if systemic institutional failure at Vanguard or radical tax code changes disallow broad index ETF structures.'
      ],
      ruleComplianceCheck: {
        rule1DefaultHoldChecked: true,
        rule2PriceDropNotTriggeredSell: true,
        rule3AllocationDriftNotSoleReason: true,
        rule6EvidenceSufficiencyChecked: true
      },
      lastReviewedDate: '2026-02-10',
      nextScheduledReviewDate: '2026-08-10'
    }
  },

  // 3. Bitcoin (BTC) -> HOLD
  {
    id: 'h-btc',
    ticker: 'BTC',
    name: 'Bitcoin (Direct Cold Storage & ETP)',
    category: 'bitcoin',
    currency: 'USD',
    currentPrice: 88400.00,
    costBasis: 42100.00,
    sharesOrUnits: 0.28,
    currentValue: 24752.00,
    currentWeight: 12.1,
    targetWeight: 10.0,
    driftPercentage: 2.1,
    reviewStatus: 'review_required',
    reviewReason: 'Portfolio weight (12.1%) exceeds 10.0% target by +2.1% due to price appreciation; requires thesis and risk re-check.',
    thesisTitle: 'Sovereign-Immune, Mathematically Enforced Digital Hard Money',
    thesisPremise: 'Bitcoin provides an unconfiscatable, mathematically constrained (21M cap) digital store of value independent of any sovereign central bank or political apparatus. Over a 5-10 year horizon, it acts as a non-correlated hedge against fiat monetary debasement and sovereign debt expansion.',
    economicMoatDescription: 'Absolute Network Security: Massive distributed proof-of-work hashrate prevents state-level 51% reorganization; absolute monetary immutability enforced by distributed nodes without centralized governance failure points.',
    investmentHorizonYears: 7,
    capitalAllocationAssessment: 'Algorithmic Non-Discretionary: Absolute predictable issuance rate halved every 210,000 blocks; zero human CEO or board capital allocation error risk.',
    valuationSummary: 'Liquid supply is constrained with 71.4% dormant >155 days. Valuation reflects growing institutional and sovereign reserve adoption, offset by inherent volatility and regulatory friction.',
    metrics: [
      { label: 'Circulating Supply Cap', currentValue: '21.0M (19.8M mined)', historicalRangeOrBenchmark: 'Asymptotic ceiling', context: 'Consensus code verified across node network', isFavorable: true },
      { label: 'Illiquid Long-Term Supply', currentValue: '71.4%', historicalRangeOrBenchmark: '65% - 75%', context: 'Glassnode on-chain cluster analysis confirms cold storage accumulation', isFavorable: true },
      { label: 'Annualized 3Y Volatility', currentValue: '48.2%', historicalRangeOrBenchmark: '40% - 65%', context: 'Substantially higher volatility than traditional asset classes', isFavorable: false },
      { label: 'Global Hashrate', currentValue: '740 EH/s', historicalRangeOrBenchmark: 'All-time highs', context: 'Record thermodynamic cost to attack network', isFavorable: true }
    ],
    downsideScenario: 'Coordinated global regulatory crackdowns banning fiat banking rails combined with post-quantum cryptographic breakthrough could cause severe protocol confidence loss (-70% to -80% historical cycle drawdown).',
    supportingEvidenceIds: ['ev-btc-1', 'ev-btc-2'],
    counterevidenceIds: ['ev-btc-3'],
    missingInformation: [
      'Comprehensive data on sovereign nation-state confidential reserve accumulation.',
      'Empirical performance of fee-based security budget 2-3 halving cycles in the future.'
    ],
    unresolvedQuestions: [
      'Will sovereign regulators permit regulated pension funds to allocate >3% without punitive Basel III capital weight penalties?'
    ],
    decision: {
      outcome: 'HOLD',
      rationale: 'Even though allocation has drifted upward from 10.0% to 12.1% (+2.1% drift) due to market appreciation, Rule 3 states that allocation drift alone must never trigger a SELL. The core monetary thesis (hard supply limit, node decentralization, on-chain illiquidity) remains completely uncompromised. HOLD is the disciplined response; opportunistic rebalancing may be executed during next annual asset allocation window without forced liquidations.',
      supportingEvidenceSummary: [
        'Consensus code rules audited in Core v28 release verifying 21M limit.',
        'Over 71% of circulating supply locked in cold storage (>155 days).'
      ],
      counterarguments: [
        'BIS Basel III regulations continue to penalize Tier 1 bank balance sheet holding.',
        'Elevated portfolio volatility impact if a macro liquidity contraction unfolds.'
      ],
      uncertaintyLevel: 'MODERATE',
      uncertaintyExplanation: 'Underlying protocol math is 100% deterministic, but macro regulatory timelines and sovereign policy responses have moderate uncertainty.',
      conditionsForChange: [
        'Increase Condition: Never increase when position weight is already above the 10.0% target cap.',
        'Reduce/Trim Condition: Only if position weight drifts above 15% (triggering disciplined systematic rebalancing trim, not panic liquidation).',
        'Sell Condition: Cryptographic compromise of SHA-256 or hard fork subverting the 21M supply cap.'
      ],
      ruleComplianceCheck: {
        rule1DefaultHoldChecked: true,
        rule2PriceDropNotTriggeredSell: true,
        rule3AllocationDriftNotSoleReason: true,
        rule6EvidenceSufficiencyChecked: true
      },
      lastReviewedDate: '2026-02-18',
      nextScheduledReviewDate: '2026-05-18'
    }
  },

  // 4. Turkish Equity: BİM Birleşik Mağazalar A.Ş. (BIMAS.IS) -> INCREASE
  {
    id: 'h-bimas',
    ticker: 'BIMAS.IS',
    name: 'BİM Birleşik Mağazalar A.Ş.',
    category: 'turkish_equity',
    currency: 'TRY',
    currentPrice: 592.50,
    costBasis: 480.00,
    sharesOrUnits: 2500,
    currentValue: 1481250.00, // in TRY (~$38,474 USD)
    currentWeight: 18.8,
    targetWeight: 22.0,
    driftPercentage: -3.2,
    reviewStatus: 'review_required',
    reviewReason: 'Undervalued relative to inflation-adjusted free cash generation; allocation is -3.2% below target weight; eligible for INCREASE review.',
    thesisTitle: 'Leading Turkish Hard-Discount Grocery with Superior Pricing Power & Negative Working Capital',
    thesisPremise: 'BİM operates Turkey’s largest retail logistics infrastructure with 13,400+ stores. In inflationary and volatile currency regimes, its extreme private-label mix (67%), high stock turnover, and negative working capital enable immediate cost pass-through while extracting supplier scale discounts. Pristine balance sheet with net cash provides immunity to 40%+ domestic benchmark rates.',
    economicMoatDescription: 'Cost Advantage & Scale Density: Over 13,000 stores allow BİM to negotiate wholesale purchase terms unattainable by competitors. High sales density per square meter and lean store format minimize fixed overhead.',
    investmentHorizonYears: 5,
    capitalAllocationAssessment: 'Conservative & Disciplined: Steady organic store rollouts funded entirely by operational cash flows; continuous dividend payout policy maintained through volatile Turkish macro regimes.',
    valuationSummary: 'Trading at an inflation-adjusted Forward P/E of 9.2x and EV/EBITDA of 5.8x, representing a 35% discount to 10-year historical averages and global discount retail peers (18x-22x).',
    metrics: [
      { label: 'Inflation-Adjusted Fwd P/E', currentValue: '9.2x', historicalRangeOrBenchmark: '12x - 16x (Historical Avg 14.1x)', context: 'Trades at multi-year valuation low despite market share gains', isFavorable: true },
      { label: 'Net Cash Position', currentValue: '+8.4B TL', historicalRangeOrBenchmark: 'Net cash positive', context: 'Zero refinancing stress under Central Bank tight monetary policy', isFavorable: true },
      { label: 'Private Label Sales Share', currentValue: '67.2%', historicalRangeOrBenchmark: '>65%', context: 'Provides high supplier substitution and pricing pass-through', isFavorable: true },
      { label: 'Store Footprint', currentValue: '13,420 stores', historicalRangeOrBenchmark: '+600-800 net new stores/yr', context: 'Ongoing expansion in Turkey, Morocco (790) and Egypt (250)', isFavorable: true }
    ],
    downsideScenario: 'Government-mandated retail price freezes or punitive competition authority fines during election cycles could temporarily suppress domestic retail gross margins by 150-200 bps.',
    supportingEvidenceIds: ['ev-bimas-1', 'ev-bimas-2', 'ev-bimas-3'],
    counterevidenceIds: [],
    missingInformation: [
      'Detailed unit economics and profitability timeline for recent logistics center investments in Egypt.'
    ],
    unresolvedQuestions: [
      'How quickly will domestic consumer purchasing power recover if the Central Bank of Turkey achieves single-digit disinflation by late 2027?'
    ],
    decision: {
      outcome: 'INCREASE',
      rationale: 'Meets the strict triple test for INCREASE: 1) Thesis quality is exceptionally high, backed by audited 9M 2025 KAP filings showing positive real EBIT margins and an 8.4B TL net cash fortress; 2) Current portfolio allocation (18.8%) is 3.2% below the target weight of 22.0%, leaving ample risk budget; 3) Valuation is deeply attractive at 9.2x forward P/E (35% discount to historical median).',
      supportingEvidenceSummary: [
        'PwC-audited 9M 2025 financial report confirming 482B TL revenues and net cash balance.',
        '13,420 store network density ensuring unparalleled supplier bargaining leverage.'
      ],
      counterarguments: [
        'Macro risk in Turkish regulatory retail oversight (price monitoring commissions).',
        'Currency devaluation impacts on imported energy and logistics fuel costs.'
      ],
      uncertaintyLevel: 'LOW',
      uncertaintyExplanation: 'Audited KAP disclosures, decades of operational history through multiple currency crises, and non-discretionary grocery demand.',
      conditionsForChange: [
        'Execution Condition: Deploy additional tranche in equal installments up to 22.0% target weight.',
        'Invalidation Condition: Shift back to HOLD if valuation re-rates above 14x P/E or if regulatory margin caps legally restrict private-label pricing flexibility.'
      ],
      ruleComplianceCheck: {
        rule1DefaultHoldChecked: true,
        rule2PriceDropNotTriggeredSell: true,
        rule3AllocationDriftNotSoleReason: true,
        rule4IncreaseTripleTestPassed: true,
        rule6EvidenceSufficiencyChecked: true
      },
      lastReviewedDate: '2026-02-12',
      nextScheduledReviewDate: '2026-05-12'
    }
  },

  // 5. Turkish Investment Fund: TI2 - İş Portföy İki Nolu Değişken Fon -> INSUFFICIENT EVIDENCE
  {
    id: 'h-ti2',
    ticker: 'TI2',
    name: 'İş Portföy İki Nolu Değişken Fon (Turkish Variable Mutual Fund)',
    category: 'turkish_fund',
    currency: 'TRY',
    currentPrice: 4.82,
    costBasis: 4.10,
    sharesOrUnits: 145000,
    currentValue: 698900.00, // in TRY (~$18,153 USD)
    currentWeight: 8.9,
    targetWeight: 10.0,
    driftPercentage: -1.1,
    reviewStatus: 'insufficient_evidence',
    reviewReason: 'Stale TEFAS reporting (>140 days without monthly portfolio attribution); unverified OTC derivative swap counterparty exposures.',
    thesisTitle: 'Active Multi-Asset Absolute Return & Dynamic Asset Allocation in Turkish Markets',
    thesisPremise: 'TI2 was added to provide active macro tactical allocation between BIST equities, sovereign Eurobonds, lease certificates, and cash to capture Turkish real interest rates while dampening equity drawdown volatility.',
    economicMoatDescription: 'Manager Expertise & Institutional Access: Access to wholesale interbank swap curves and primary institutional lease certificate issuances closed to retail investors.',
    investmentHorizonYears: 3,
    capitalAllocationAssessment: 'Uncertain: Recent KAP notifications revealed fund mandate changes elevating derivative limits to 35%, with noticeable departures in portfolio manager roster.',
    valuationSummary: 'NAV per share is published daily on TEFAS, but underlying asset transparency and derivative mark-to-model valuations cannot be independently confirmed from published disclosures.',
    metrics: [
      { label: 'Published NAV / Share', currentValue: '4.82 TL', historicalRangeOrBenchmark: 'Daily TEFAS feed', context: 'Daily liquidity guaranteed by fund rules', isFavorable: null },
      { label: 'Management Fee', currentValue: '2.40% p.a.', historicalRangeOrBenchmark: '1.5% - 2.8%', context: 'Substantial fee burden requiring active alpha generation', isFavorable: false },
      { label: 'Portfolio Transparency', currentValue: 'Stale / Low', historicalRangeOrBenchmark: 'Monthly full disclosure', context: 'Last detailed portfolio composition published >140 days ago', isFavorable: false },
      { label: 'Max Mandate Derivative Exposure', currentValue: '35.0%', historicalRangeOrBenchmark: '10.0% previously', context: 'Expanded via October 2025 KAP amendment without risk breakdown', isFavorable: false }
    ],
    downsideScenario: 'Adverse OTC currency swap movement during sudden lira volatility spikes could result in rapid NAV drawdowns not reflected in historical backward-looking volatility metrics.',
    supportingEvidenceIds: ['ev-ti2-1'],
    counterevidenceIds: ['ev-ti2-2'],
    missingInformation: [
      'Latest monthly portfolio distribution report for December 2025 and January 2026.',
      'Identities and credit collateral terms of the OTC derivative swap counterparties.',
      'Attribution analysis explaining the sudden reduction in BIST equity weighting from 48% to 28%.'
    ],
    unresolvedQuestions: [
      'Has the core management team rotated following the October 2025 mandate change?',
      'Is the fund actively speculating on interest rate derivatives or purely using them for directional foreign currency hedging?'
    ],
    decision: {
      outcome: 'INSUFFICIENT_EVIDENCE',
      rationale: 'In strict compliance with Critical Decision Rule 6: "If evidence is missing, stale, or conflicting, use INSUFFICIENT EVIDENCE rather than inventing facts or forcing a decision." The fund has not published audited asset attribution reports for over 140 days, and the recent regulatory expansion of derivative leverage up to 35% introduces unverified risks. No capital may be allocated or liquidated until disclosures are clarified.',
      supportingEvidenceSummary: [
        'KAP filing confirming derivative ceiling expansion to 35% without counterparty details.',
        'Stale TEFAS portfolio snapshot showing significant unexplained migration to lease certificates.'
      ],
      counterarguments: [
        'Fund has historical 3-year track record of beating benchmark deposit rates.',
        'Daily redemption liquidity is guaranteed by Takasbank.'
      ],
      uncertaintyLevel: 'HIGH',
      uncertaintyExplanation: 'Significant information opacity regarding active derivative positions and stale monthly factsheets.',
      conditionsForChange: [
        'Resolution Condition: Review next quarterly portfolio distribution report upon publication on KAP. If derivative exposure is confirmed to be plain-vanilla currency hedging with top-tier Turkish banks and management clarifies attribution, reinstate thesis to HOLD.',
        'Exit Condition: If transparency remains obscured after the mandatory annual report filing deadline, initiate planned orderly reduction/exit.'
      ],
      ruleComplianceCheck: {
        rule1DefaultHoldChecked: false,
        rule2PriceDropNotTriggeredSell: true,
        rule3AllocationDriftNotSoleReason: true,
        rule6EvidenceSufficiencyChecked: true
      },
      lastReviewedDate: '2026-02-05',
      nextScheduledReviewDate: '2026-03-31'
    }
  },

  // 6. Thesis-Impaired Asset: SolarEdge Technologies (SEDG) -> SELL
  {
    id: 'h-sedg',
    ticker: 'SEDG',
    name: 'SolarEdge Technologies, Inc.',
    category: 'equity',
    currency: 'USD',
    currentPrice: 16.20,
    costBasis: 78.50,
    sharesOrUnits: 350,
    currentValue: 5670.00,
    currentWeight: 2.8,
    targetWeight: 0.0,
    driftPercentage: 2.8,
    reviewStatus: 'review_required',
    reviewReason: 'Material thesis invalidation confirmed by audited SEC 10-K; debt covenant breach and negative gross margins require complete SELL.',
    thesisTitle: 'Distributed Solar Optimizer Monopolist & Residential Clean Tech Powerhouse (INVALIDATED)',
    thesisPremise: 'Original thesis assumed SolarEdge held an unassailable technological and patent moat in module-level power electronics (MLPE / DC optimizers), commanding 30%+ gross margins and structural pricing power over Chinese inverter competitors.',
    economicMoatDescription: 'Moat Destroyed: European distributor inventory channel collapse, rapid commoditization by micro-inverter and hybrid string inverter competitors, and permanent loss of pricing premiums.',
    investmentHorizonYears: 5,
    capitalAllocationAssessment: 'Impaired: Severe capital allocation failure including ill-timed battery cell manufacturing acquisitions, massive inventory write-offs ($1B+), and credit covenant breaches.',
    valuationSummary: 'Negative gross margins (-8.2%), ongoing cash burn exceeding $300M annually, and restrictive bank lender covenants make traditional valuation multiples non-applicable.',
    metrics: [
      { label: 'Gross Margin (FY2025)', currentValue: '-8.2%', historicalRangeOrBenchmark: 'Historical +28% to +35%', context: 'Audited collapse demonstrating structural loss of pricing power', isFavorable: false },
      { label: 'Unrealized Price Loss', currentValue: '-79.4%', historicalRangeOrBenchmark: 'Price decline', context: 'PRICE LOSS ALONE DID NOT TRIGGER SELL - Thesis invalidation did!', isFavorable: false },
      { label: 'Lender Credit Covenant', currentValue: 'Breached / Restructured', historicalRangeOrBenchmark: 'Standard covenants', context: 'Form 8-K confirms 450 bps rate penalty and lender restrictions', isFavorable: false },
      { label: 'Channel Inventory Overhang', currentValue: '>9 Months', historicalRangeOrBenchmark: '2 - 3 months normal', context: 'Distribution partners refusing additional shipments', isFavorable: false }
    ],
    downsideScenario: 'Potential Chapter 11 restructuring or highly dilutive distressed equity recapitalization if residential European solar demand does not rebound sharply in 2026.',
    supportingEvidenceIds: ['ev-sedg-1', 'ev-sedg-2'],
    counterevidenceIds: [],
    missingInformation: [
      'Exact liquidation value of intellectual property portfolio in a hypothetical restructuring.'
    ],
    unresolvedQuestions: [
      'Can management negotiate another debt waiver if Q2 2026 free cash flow remains negative?'
    ],
    decision: {
      outcome: 'SELL',
      rationale: 'Fully compliant with Rule 5: "SELL requires strong, verified evidence that materially invalidates the long-term investment thesis." Note that Rule 2 was strictly enforced: the 79% price drop was NOT the cause of the SELL decision. The SELL was triggered only after audited SEC Form 10-K and Form 8-K filings proved that 1) gross margins structurally collapsed to negative 8.2%, 2) distributor channels suffered permanent technological substitution, and 3) senior bank debt covenants were breached, terminating the investment thesis.',
      supportingEvidenceSummary: [
        'Audited SEC Form 10-K documenting negative 8.2% gross margin and $1.04B inventory obsolescence.',
        'Form 8-K credit agreement amendment proving liquidity emergency and debt covenant restrictions.'
      ],
      counterarguments: [
        'Stock trades near book value; technical short squeeze or surprise takeover offer possible.'
      ],
      uncertaintyLevel: 'LOW',
      uncertaintyExplanation: 'Audited financial filings and binding legal debt restructuring agreements provide indisputable empirical proof.',
      conditionsForChange: [
        'Human Review Required: Simulated decision draft. Fiduciary committee must review debt covenant breach disclosures before manual action. Automated trading is prohibited.',
        'No reversal conditions; company no longer qualifies under long-term quality investment criteria.'
      ],
      ruleComplianceCheck: {
        rule1DefaultHoldChecked: true,
        rule2PriceDropNotTriggeredSell: true,
        rule3AllocationDriftNotSoleReason: true,
        rule5SellHighBarMoatBreak: true,
        rule6EvidenceSufficiencyChecked: true
      },
      lastReviewedDate: '2026-02-14',
      nextScheduledReviewDate: '2026-03-01'
    }
  }
];

export function calculatePortfolioSummary(holdings: Holding[]): PortfolioSummary {
  // Compute total USD equivalent
  let totalUSD = 0;
  let totalTRY = 0;

  holdings.forEach(h => {
    if (h.currency === 'USD') {
      totalUSD += h.currentValue;
    } else if (h.currency === 'TRY') {
      totalTRY += h.currentValue;
      totalUSD += (h.currentValue / SYNTHETIC_USD_TRY_RATE);
    } else {
      totalUSD += h.currentValue;
    }
  });

  // Calculate category breakdowns
  const categoryLabels: Record<string, string> = {
    equity: 'Global Equities',
    etf: 'Broad Index ETFs',
    bitcoin: 'Digital Assets (Bitcoin)',
    turkish_equity: 'Turkish Equities',
    turkish_fund: 'Turkish Mutual Funds'
  };

  const categoriesMap = new Map<string, { valUSD: number; count: number }>();

  holdings.forEach(h => {
    const valUSD = h.currency === 'USD' ? h.currentValue : (h.currentValue / SYNTHETIC_USD_TRY_RATE);
    const existing = categoriesMap.get(h.category) || { valUSD: 0, count: 0 };
    categoriesMap.set(h.category, {
      valUSD: existing.valUSD + valUSD,
      count: existing.count + 1
    });
  });

  const categories = Array.from(categoriesMap.entries()).map(([cat, data]) => {
    const currentWeight = (data.valUSD / totalUSD) * 100;
    // target weights lookup
    const targetMap: Record<string, number> = {
      equity: 25.0,
      etf: 25.0,
      bitcoin: 10.0,
      turkish_equity: 22.0,
      turkish_fund: 10.0
    };
    return {
      category: cat as any,
      label: categoryLabels[cat] || cat,
      currentValueUSD: data.valUSD,
      currentValueTRY: data.valUSD * SYNTHETIC_USD_TRY_RATE,
      currentWeight: parseFloat(currentWeight.toFixed(1)),
      targetWeight: targetMap[cat] || 0,
      holdingCount: data.count
    };
  });

  // Top holdings concentration
  const sortedHoldings = [...holdings].map(h => ({
    ...h,
    valUSD: h.currency === 'USD' ? h.currentValue : (h.currentValue / SYNTHETIC_USD_TRY_RATE)
  })).sort((a, b) => b.valUSD - a.valUSD);

  const top1Val = sortedHoldings[0]?.valUSD || 0;
  const top3Val = (sortedHoldings[0]?.valUSD || 0) + (sortedHoldings[1]?.valUSD || 0) + (sortedHoldings[2]?.valUSD || 0);
  const top5Val = sortedHoldings.slice(0, 5).reduce((acc, h) => acc + h.valUSD, 0);

  const topHoldingsConcentration = {
    top1: parseFloat(((top1Val / totalUSD) * 100).toFixed(1)),
    top3: parseFloat(((top3Val / totalUSD) * 100).toFixed(1)),
    top5: parseFloat(((top5Val / totalUSD) * 100).toFixed(1)),
    top1Ticker: sortedHoldings[0]?.ticker || 'MSFT'
  };

  // Currency exposure
  const usdPortionUSD = holdings.filter(h => h.currency === 'USD').reduce((acc, h) => acc + h.currentValue, 0);
  const tryPortionUSD = holdings.filter(h => h.currency === 'TRY').reduce((acc, h) => acc + (h.currentValue / SYNTHETIC_USD_TRY_RATE), 0);

  const currencyExposure = {
    USD: parseFloat(((usdPortionUSD / totalUSD) * 100).toFixed(1)),
    TRY: parseFloat(((tryPortionUSD / totalUSD) * 100).toFixed(1))
  };

  const reviewQueueCount = holdings.filter(h => h.reviewStatus === 'review_required' || h.reviewStatus === 'insufficient_evidence').length;

  return {
    reportingCurrency: 'USD' as const,
    totalValueUSD: totalUSD,
    totalValueTRY: totalTRY + (totalUSD - (tryPortionUSD)) * SYNTHETIC_USD_TRY_RATE,
    fxRateUSDTRY: SYNTHETIC_USD_TRY_RATE,
    categories,
    topHoldingsConcentration,
    currencyExposure,
    reviewQueueCount,
    evidenceFreshnessStats: {
      freshPercentage: 68.0,
      adequatePercentage: 20.0,
      stalePercentage: 12.0
    }
  };
}
