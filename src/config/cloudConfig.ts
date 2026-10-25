/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Cloud Configuration & Placeholders
 * ===================================
 * Configurable via Vite environment variables:
 * - VITE_GOOGLE_CLIENT_ID: Google OAuth 2.0 Web Client ID
 * - VITE_CLOUD_API_BASE_URL: Backend base URL (e.g. 'https://investment-agent-cloud.onrender.com' or relative '')
 * - VITE_CLOUD_API_TIMEOUT_MS: Request timeout in milliseconds (default: 45000ms for Render cold starts)
 *
 * Architectural & Security Rules:
 * 1. No hardcoded production endpoints or client IDs.
 * 2. Unconfigured values fall back to safe explicit placeholders.
 * 3. Never log or leak secrets or tokens.
 */

export const PLACEHOLDER_GOOGLE_CLIENT_ID = 'PLACEHOLDER_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
export const DEFAULT_CLOUD_TIMEOUT_MS = 45000; // 45 seconds to accommodate Render free-tier cold starts

export interface CloudConfig {
  googleClientId: string;
  baseUrl: string;
  timeoutMs: number;
  isConfigured: boolean;
}

export function getCloudConfig(): CloudConfig {
  const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {} as Record<string, string | undefined>;

  const googleClientId = env.VITE_GOOGLE_CLIENT_ID || PLACEHOLDER_GOOGLE_CLIENT_ID;
  const baseUrl = (env.VITE_CLOUD_API_BASE_URL || '').replace(/\/+$/, '');
  const timeoutMs = env.VITE_CLOUD_API_TIMEOUT_MS
    ? Number(env.VITE_CLOUD_API_TIMEOUT_MS) || DEFAULT_CLOUD_TIMEOUT_MS
    : DEFAULT_CLOUD_TIMEOUT_MS;

  const isConfigured = Boolean(
    googleClientId &&
    googleClientId !== PLACEHOLDER_GOOGLE_CLIENT_ID &&
    !googleClientId.startsWith('PLACEHOLDER_') &&
    googleClientId.includes('.apps.googleusercontent.com')
  );

  return {
    googleClientId,
    baseUrl,
    timeoutMs,
    isConfigured
  };
}
