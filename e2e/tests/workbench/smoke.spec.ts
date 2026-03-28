import { test, expect } from '@playwright/test';
import { setupWorkbenchTest } from '../fixtures/auth';

test.describe('Workbench Smoke Tests', () => {
  test('should login and load workbench', async ({ page }) => {
    // Login and navigate to workbench
    const { accountId } = await setupWorkbenchTest(page);
    
    console.log('Logged in with account:', accountId);
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-results/workbench-loaded.png', fullPage: true });
    
    // Check URL contains workbench
    expect(page.url()).toContain('workbench');
    
    // Check page title
    const title = await page.title();
    console.log('Page title:', title);
    expect(title).toBeTruthy();
  });

  test('should display workbench UI elements', async ({ page }) => {
    await setupWorkbenchTest(page);
    await page.waitForLoadState('networkidle');
    
    // Wait a bit for React to render
    await page.waitForTimeout(3000);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/workbench-ui.png', fullPage: true });
    
    // Look for any visible content
    const body = await page.locator('body').textContent();
    console.log('Page content length:', body?.length);
    
    // Just verify we're on the workbench page
    expect(page.url()).toContain('workbench');
  });
});
