# Investment Intelligence

Deterministic Long-Term Decision-Support Terminal for Buy-and-Hold Investors.

## Architecture & Principles
- **Decision Support Only:** Non-custodial, deterministic rule-based evaluation.
- **Zero Automated Trading:** Automated order execution is permanently blocked by architectural design.
- **Authoritative Reporting Currency:** Exclusively denominated in TRY.
- **Multi-Source Resilience:** Operates with Synthetic Demonstration data, offline local JSON snapshots, and authenticated cloud live synchronization via Google Identity Services.
- **Statutory Evidence Traceability:** Decisions are grounded in primary statutory filings and audited reports.

## Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run unit and contract test suite
npm test

# Run TypeScript analysis
npm run lint

# Build production static bundle
npm run build
```

## Cloud Integration
Configured via Vite environment variables:
- `VITE_GOOGLE_CLIENT_ID`: Google OAuth 2.0 Web Client ID
- `VITE_CLOUD_API_BASE_URL`: Investment Agent Cloud backend URL
- `VITE_CLOUD_API_TIMEOUT_MS`: Request timeout (default: 45000ms)
