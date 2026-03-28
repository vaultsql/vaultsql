import { Page } from '@playwright/test';

/**
 * Authentication helper for E2E tests
 * Uses the /api/auth/devlogin endpoint to get a session token
 */

export interface DevLoginResponse {
  token: string;
  identity: {
    id: string;
    email: string;
    name: string;
  };
  needs_onboarding: boolean;
}

/**
 * Login as a dev user using the /auth/devlogin endpoint
 * 
 * @param page - Playwright page object
 * @param suffix - Optional suffix for the configured dev email
 * @returns The login response with token and identity info
 * 
 * @example
 * // Login as the default dev user
 * await loginAsDev(page);
 * 
 * @example
 * // Login as a specific test user
 * await loginAsDev(page, 'test1');
 */
export async function loginAsDev(page: Page, suffix?: string): Promise<DevLoginResponse> {
  const endpoint = suffix 
    ? `http://localhost:8400/api/auth/devlogin/${suffix}`
    : 'http://localhost:8400/api/auth/devlogin';
  
  // Call the devlogin endpoint
  const response = await page.request.post(endpoint, {
    headers: {
      'Content-Type': 'application/json',
    },
    data: {}
  });
  
  if (!response.ok()) {
    throw new Error(`Dev login failed: ${response.status()} ${response.statusText()}`);
  }
  
  const data: DevLoginResponse = await response.json();
  
  // Set the auth token in localStorage before navigating
  // The app uses 'vaultsql_token' as the key
  await page.goto('http://localhost:8400');
  await page.evaluate((token) => {
    localStorage.setItem('vaultsql_token', token);
  }, data.token);
  
  // Reload to pick up the auth token
  await page.reload();
  await page.waitForLoadState('networkidle');
  
  return data;
}

/**
 * Navigate to the workbench for a specific account
 * Assumes the user is already logged in and has access to the account
 * 
 * @param page - Playwright page object
 * @param accountId - The account ID to navigate to
 */
export async function navigateToWorkbench(page: Page, accountId: string) {
  await page.goto(`http://localhost:8400/workbench/${accountId}`);
  
  // Wait for the page to load
  await page.waitForLoadState('networkidle');
  
  // Give React time to render
  await page.waitForTimeout(2000);
}

/**
 * Get the default dev account ID using the API
 * This assumes the dev account has been seeded with task dev:setup
 * 
 * @param page - Playwright page object
 * @param token - Auth token from devlogin
 * @returns The account ID
 */
export async function getDevAccountId(page: Page, token: string): Promise<string> {
  // Call the identity/me endpoint to get workspaces
  const response = await page.request.get('http://localhost:8400/api/identity/me', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok()) {
    throw new Error(`Failed to get identity info: ${response.status()}`);
  }
  
  const data = await response.json();
  
  if (!data.workspaces || data.workspaces.length === 0) {
    throw new Error('No workspaces found for dev user');
  }
  
  // Return the first workspace ID
  return data.workspaces[0].id;
}

/**
 * Login and navigate to the workbench in one step
 * 
 * @param page - Playwright page object
 * @param suffix - Optional suffix for the email
 * @returns Object with login response and account ID
 */
export async function setupWorkbenchTest(page: Page, suffix?: string) {
  const loginResponse = await loginAsDev(page, suffix);
  
  const accountId = await getDevAccountId(page, loginResponse.token);
  await navigateToWorkbench(page, accountId);
  
  return {
    loginResponse,
    accountId
  };
}
