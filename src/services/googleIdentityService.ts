/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Google Identity Services (GIS) In-Memory Client
 * ================================================
 * Integrates Google Identity Services for web authentication using
 * Google's ID Token (JWT) flow.
 *
 * Strict Security Invariants:
 * 1. Zero Persistent Storage: ID tokens are held STRICTLY in private memory.
 *    Tokens are NEVER written to localStorage, sessionStorage, cookies, or IndexedDB.
 * 2. Unverified Claims Safety: Client-side token payload is not treated as verified;
 *    email is not displayed unless confirmed by an authoritative verified source.
 * 3. Authoritative Backend: A successful Google sign-in is NOT proof of backend authorization.
 *    Backend API authorization (allowed users list) remains the sole authoritative gatekeeper.
 * 4. Explicit Sign-Out: Signing out zeroes the in-memory token and notifies listeners.
 */

import { PLACEHOLDER_GOOGLE_CLIENT_ID } from '../config/cloudConfig';

export type GoogleIdentityStatus =
  | 'unconfigured'     // Client ID is missing or set to placeholder
  | 'script_loading'   // Script is being fetched
  | 'script_error'     // Failed to load GIS script
  | 'ready_signed_out' // GIS initialized, user is signed out
  | 'signed_in'        // User completed sign-in, valid in-memory ID token held
  | 'error';           // Authentication or initialization error

export interface GsiCredentialResponse {
  credential?: string;
  select_by?: string;
  clientId?: string;
}

export interface GsiButtonConfiguration {
  type?: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  logo_alignment?: 'left' | 'center';
  width?: number;
  locale?: string;
}

export interface GoogleAccountsIdApi {
  initialize: (config: {
    client_id: string;
    callback: (response: GsiCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }) => void;
  renderButton: (parent: HTMLElement, options: GsiButtonConfiguration) => void;
  disableAutoSelect?: () => void;
  revoke?: (hint: string, done: () => void) => void;
  prompt?: () => void;
}

export interface GoogleIdentityServiceConfig {
  clientId?: string;
  scriptUrl?: string;
  customScriptLoader?: () => Promise<void>;
  googleAccountsId?: GoogleAccountsIdApi;
  onTokenChange?: (token: string | null) => void;
  onStatusChange?: (status: GoogleIdentityStatus, errorMessage: string | null) => void;
}

export class GoogleIdentityService {
  private readonly clientId: string;
  private readonly scriptUrl: string;
  private readonly customScriptLoader?: () => Promise<void>;
  private googleAccountsId?: GoogleAccountsIdApi;

  // In-memory token storage ONLY (Never persisted to disk/storage)
  private idToken: string | null = null;
  private status: GoogleIdentityStatus = 'unconfigured';
  private errorMessage: string | null = null;

  private tokenListeners: Array<(token: string | null) => void> = [];
  private statusListeners: Array<(status: GoogleIdentityStatus, error: string | null) => void> = [];

  constructor(config: GoogleIdentityServiceConfig = {}) {
    this.clientId = config.clientId || PLACEHOLDER_GOOGLE_CLIENT_ID;
    this.scriptUrl = config.scriptUrl || 'https://accounts.google.com/gsi/client';
    this.customScriptLoader = config.customScriptLoader;
    this.googleAccountsId = config.googleAccountsId;

    if (config.onTokenChange) {
      this.tokenListeners.push(config.onTokenChange);
    }
    if (config.onStatusChange) {
      this.statusListeners.push(config.onStatusChange);
    }
  }

  public getStatus(): GoogleIdentityStatus {
    return this.status;
  }

  public getErrorMessage(): string | null {
    return this.errorMessage;
  }

  public getIdToken(): string | null {
    return this.idToken;
  }

  public hasToken(): boolean {
    return Boolean(this.idToken && this.idToken.trim().length > 0);
  }

  public isClientConfigured(): boolean {
    return Boolean(
      this.clientId &&
      this.clientId !== PLACEHOLDER_GOOGLE_CLIENT_ID &&
      !this.clientId.startsWith('PLACEHOLDER_') &&
      this.clientId.includes('.apps.googleusercontent.com')
    );
  }

  public onTokenChange(listener: (token: string | null) => void): () => void {
    this.tokenListeners.push(listener);
    return () => {
      this.tokenListeners = this.tokenListeners.filter(l => l !== listener);
    };
  }

  public onStatusChange(listener: (status: GoogleIdentityStatus, error: string | null) => void): () => void {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter(l => l !== listener);
    };
  }

  private setStatus(status: GoogleIdentityStatus, errorMessage: string | null = null): void {
    this.status = status;
    this.errorMessage = errorMessage;
    for (const listener of this.statusListeners) {
      try {
        listener(status, errorMessage);
      } catch {
        // Prevent listener failures from interrupting core flow
      }
    }
  }

  private setToken(token: string | null): void {
    this.idToken = token;
    for (const listener of this.tokenListeners) {
      try {
        listener(token);
      } catch {
        // Prevent listener failures from interrupting core flow
      }
    }
  }

  /**
   * Initializes Google Identity Services.
   * Resolves to true if GIS is ready for user sign-in; false if unconfigured or error.
   */
  public async initialize(): Promise<boolean> {
    if (!this.isClientConfigured()) {
      this.setStatus('unconfigured', 'Google OAuth Client ID is not configured (Placeholder). Live cloud sync is unavailable until configured.');
      return false;
    }

    this.setStatus('script_loading', null);

    // 1. Ensure GIS script is loaded
    try {
      if (this.customScriptLoader) {
        await this.customScriptLoader();
      } else if (!this.googleAccountsId && typeof window !== 'undefined') {
        await this.loadGsiScript();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.setStatus('script_error', `Failed to load Google Identity Services library: ${msg}`);
      return false;
    }

    // 2. Resolve google.accounts.id API
    const gsiApi = this.googleAccountsId || (typeof window !== 'undefined' ? (window as unknown as { google?: { accounts?: { id?: GoogleAccountsIdApi } } })?.google?.accounts?.id : undefined);

    if (!gsiApi) {
      this.setStatus('script_error', 'Google Identity Services library loaded but window.google.accounts.id is unavailable.');
      return false;
    }

    this.googleAccountsId = gsiApi;

    // 3. Initialize GIS with client_id and callback
    try {
      this.googleAccountsId.initialize({
        client_id: this.clientId,
        callback: (resp: GsiCredentialResponse) => this.handleCredentialResponse(resp),
        auto_select: false,
        cancel_on_tap_outside: true
      });
      this.setStatus('ready_signed_out', null);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.setStatus('error', `Failed to initialize Google Identity Services: ${msg}`);
      return false;
    }
  }

  /**
   * Handles credential callback from GIS.
   * Extracts ID token strictly into in-memory state.
   */
  public handleCredentialResponse(response: GsiCredentialResponse): void {
    if (!response || !response.credential || !response.credential.trim()) {
      this.setToken(null);
      this.setStatus('error', 'Google Identity callback returned an empty or invalid credential.');
      return;
    }

    // Store in memory strictly. Never persist to localStorage, sessionStorage, or cookies.
    this.setToken(response.credential.trim());
    this.setStatus('signed_in', null);
  }

  /**
   * Renders the standard Google Sign-In button into a host DOM element.
   */
  public renderButton(parent: HTMLElement, options: GsiButtonConfiguration = {}): void {
    if (!this.googleAccountsId || this.status === 'unconfigured' || this.status === 'script_error') {
      return;
    }

    try {
      this.googleAccountsId.renderButton(parent, {
        type: 'standard',
        theme: 'filled_black',
        size: 'medium',
        text: 'signin_with',
        shape: 'rectangular',
        ...options
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.setStatus('error', `Failed to render Google Sign-In button: ${msg}`);
    }
  }

  /**
   * Explicit sign-out action:
   * Clears in-memory ID token, disables auto-select, and transitions state to ready_signed_out.
   */
  public signOut(): void {
    this.setToken(null);
    if (this.googleAccountsId?.disableAutoSelect) {
      try {
        this.googleAccountsId.disableAutoSelect();
      } catch {
        // Safe ignore
      }
    }
    this.setStatus('ready_signed_out', null);
  }

  /**
   * Private helper to load the official GIS script via a DOM <script> element.
   */
  private loadGsiScript(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (typeof document === 'undefined') {
        return reject(new Error('Document is undefined in current environment.'));
      }

      // Check if already injected
      const existingScript = document.querySelector(`script[src="${this.scriptUrl}"]`);
      if (existingScript) {
        return resolve();
      }

      const script = document.createElement('script');
      script.src = this.scriptUrl;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Network error loading ${this.scriptUrl}`));

      document.head.appendChild(script);
    });
  }
}

/**
 * Factory helper for creating GoogleIdentityService instances.
 */
export function createGoogleIdentityService(config?: GoogleIdentityServiceConfig): GoogleIdentityService {
  return new GoogleIdentityService(config);
}
