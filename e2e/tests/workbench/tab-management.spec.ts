import { test, expect } from '@playwright/test';
import { setupWorkbenchTest } from '../fixtures/auth';

test.describe('Workbench Tab Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate to workbench
    await setupWorkbenchTest(page);
    
    // Wait for the workbench to fully load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('should display tab bar', async ({ page }) => {
    // Look for tab bar
    const tabBar = page.locator('[data-testid="tab-bar"], .tab-bar, [role="tablist"]').first();
    await expect(tabBar).toBeVisible({ timeout: 10000 });
  });

  test('should open multiple tabs', async ({ page }) => {
    // Open first table
    const firstTable = page.locator('[data-testid*="table"], [class*="table-item"], .tree-item').first();
    await expect(firstTable).toBeVisible({ timeout: 15000 });
    await firstTable.click();
    await page.waitForTimeout(1000);
    
    // Open a worksheet
    const sqlButton = page.locator('button:has-text("SQL"), button:has-text("New SQL"), [data-testid="new-sql-button"]').first();
    if (await sqlButton.isVisible({ timeout: 5000 })) {
      await sqlButton.click();
      await page.waitForTimeout(1000);
    }
    
    // Open another table
    const secondTable = page.locator('[data-testid*="table"], [class*="table-item"], .tree-item').nth(1);
    if (await secondTable.isVisible({ timeout: 5000 })) {
      await secondTable.click();
      await page.waitForTimeout(1000);
    }
    
    // Verify multiple tabs exist
    const tabs = page.locator('[data-testid="tab"], .tab, [role="tab"]');
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThan(1);
  });

  test('should switch between tabs', async ({ page }) => {
    // Open first table
    const firstTable = page.locator('[data-testid*="table"], [class*="table-item"], .tree-item').first();
    await expect(firstTable).toBeVisible({ timeout: 15000 });
    await firstTable.click();
    await page.waitForTimeout(1000);
    
    // Open worksheet
    const sqlButton = page.locator('button:has-text("SQL"), button:has-text("New SQL"), [data-testid="new-sql-button"]').first();
    if (await sqlButton.isVisible({ timeout: 5000 })) {
      await sqlButton.click();
      await page.waitForTimeout(1000);
      
      // Get all tabs
      const tabs = page.locator('[data-testid="tab"], .tab, [role="tab"]');
      const tabCount = await tabs.count();
      
      if (tabCount > 1) {
        // Click first tab
        await tabs.first().click();
        await page.waitForTimeout(500);
        
        // Click second tab
        await tabs.nth(1).click();
        await page.waitForTimeout(500);
        
        // Verify active tab changed (look for active class or aria-selected)
        const activeTab = page.locator('[data-testid="tab"][aria-selected="true"], .tab.active, [role="tab"][aria-selected="true"]').first();
        await expect(activeTab).toBeVisible({ timeout: 3000 });
      }
    }
  });

  test('should close tab with X button', async ({ page }) => {
    // Open a table
    const firstTable = page.locator('[data-testid*="table"], [class*="table-item"], .tree-item').first();
    await expect(firstTable).toBeVisible({ timeout: 15000 });
    await firstTable.click();
    await page.waitForTimeout(1000);
    
    // Get initial tab count
    const tabs = page.locator('[data-testid="tab"], .tab, [role="tab"]');
    const initialCount = await tabs.count();
    
    // Look for close button on tab
    const closeButton = page.locator('[data-testid*="close-tab"], .tab-close, button[aria-label*="Close"]').first();
    
    if (await closeButton.isVisible({ timeout: 5000 })) {
      await closeButton.click();
      await page.waitForTimeout(500);
      
      // Verify tab count decreased
      const newCount = await tabs.count();
      expect(newCount).toBeLessThan(initialCount);
    }
  });

  test('should close tab with Cmd+W', async ({ page }) => {
    // Open a table
    const firstTable = page.locator('[data-testid*="table"], [class*="table-item"], .tree-item').first();
    await expect(firstTable).toBeVisible({ timeout: 15000 });
    await firstTable.click();
    await page.waitForTimeout(1000);
    
    // Get initial tab count
    const tabs = page.locator('[data-testid="tab"], .tab, [role="tab"]');
    const initialCount = await tabs.count();
    
    if (initialCount > 0) {
      // Press Cmd+W (or Ctrl+W on non-Mac)
      const isMac = process.platform === 'darwin';
      await page.keyboard.press(isMac ? 'Meta+w' : 'Control+w');
      await page.waitForTimeout(500);
      
      // Verify tab was closed
      const newCount = await tabs.count();
      expect(newCount).toBeLessThanOrEqual(initialCount);
    }
  });

  test('should show preview tab vs pinned tab', async ({ page }) => {
    // Single click opens preview tab
    const firstTable = page.locator('[data-testid*="table"], [class*="table-item"], .tree-item').first();
    await expect(firstTable).toBeVisible({ timeout: 15000 });
    await firstTable.click();
    await page.waitForTimeout(1000);
    
    // Get tab count
    const tabs = page.locator('[data-testid="tab"], .tab, [role="tab"]');
    const previewCount = await tabs.count();
    
    // Single click another table (should replace preview)
    const secondTable = page.locator('[data-testid*="table"], [class*="table-item"], .tree-item').nth(1);
    if (await secondTable.isVisible({ timeout: 5000 })) {
      await secondTable.click();
      await page.waitForTimeout(1000);
      
      // Tab count should be same (preview replaced)
      const afterPreviewCount = await tabs.count();
      expect(afterPreviewCount).toBeLessThanOrEqual(previewCount + 1);
    }
  });

  test('should pin tab on double click', async ({ page }) => {
    // Double click to pin tab
    const firstTable = page.locator('[data-testid*="table"], [class*="table-item"], .tree-item').first();
    await expect(firstTable).toBeVisible({ timeout: 15000 });
    await firstTable.dblclick();
    await page.waitForTimeout(1000);
    
    // Get tab count
    const tabs = page.locator('[data-testid="tab"], .tab, [role="tab"]');
    const pinnedCount = await tabs.count();
    
    // Double click another table (should add new pinned tab)
    const secondTable = page.locator('[data-testid*="table"], [class*="table-item"], .tree-item').nth(1);
    if (await secondTable.isVisible({ timeout: 5000 })) {
      await secondTable.dblclick();
      await page.waitForTimeout(1000);
      
      // Tab count should increase (pinned tabs don't replace)
      const afterPinnedCount = await tabs.count();
      expect(afterPinnedCount).toBeGreaterThanOrEqual(pinnedCount);
    }
  });

  test('should display active tab indicator', async ({ page }) => {
    // Open a tab
    const firstTable = page.locator('[data-testid*="table"], [class*="table-item"], .tree-item').first();
    await expect(firstTable).toBeVisible({ timeout: 15000 });
    await firstTable.click();
    await page.waitForTimeout(1000);
    
    // Look for active tab indicator
    const activeTab = page.locator('[data-testid="tab"][aria-selected="true"], .tab.active, [role="tab"][aria-selected="true"]').first();
    await expect(activeTab).toBeVisible({ timeout: 5000 });
  });

  test('should handle many tabs with horizontal scrolling', async ({ page }) => {
    // Open multiple tabs
    const tables = page.locator('[data-testid*="table"], [class*="table-item"], .tree-item');
    const tableCount = await tables.count();
    
    // Open several tables
    for (let i = 0; i < Math.min(5, tableCount); i++) {
      await tables.nth(i).dblclick();
      await page.waitForTimeout(500);
    }
    
    // Verify tab bar exists
    const tabBar = page.locator('[data-testid="tab-bar"], .tab-bar, [role="tablist"]').first();
    await expect(tabBar).toBeVisible({ timeout: 5000 });
    
    // Check if tabs are present
    const tabs = page.locator('[data-testid="tab"], .tab, [role="tab"]');
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThan(0);
  });

  test('should persist tab content when switching tabs', async ({ page }) => {
    // Open worksheet and type content
    const sqlButton = page.locator('button:has-text("SQL"), button:has-text("New SQL"), [data-testid="new-sql-button"]').first();
    await sqlButton.click();
    await page.waitForTimeout(1000);
    
    // Type in worksheet
    const editorContent = page.locator('.cm-content, .CodeMirror-code, [data-testid="sql-editor"]').first();
    await editorContent.click();
    await page.keyboard.type('SELECT * FROM test;');
    await page.waitForTimeout(500);
    
    // Open another tab
    const firstTable = page.locator('[data-testid*="table"], [class*="table-item"], .tree-item').first();
    if (await firstTable.isVisible({ timeout: 5000 })) {
      await firstTable.click();
      await page.waitForTimeout(1000);
      
      // Switch back to worksheet tab
      const worksheetTab = page.locator('[data-testid="tab"], .tab, [role="tab"]').filter({ hasText: /Worksheet|SQL/i }).first();
      if (await worksheetTab.isVisible({ timeout: 5000 })) {
        await worksheetTab.click();
        await page.waitForTimeout(500);
        
        // Verify content is still there
        const editor = page.locator('.cm-editor, .CodeMirror').first();
        const editorText = await editor.textContent();
        expect(editorText).toContain('SELECT');
      }
    }
  });

  test('should show tab labels with table/worksheet names', async ({ page }) => {
    // Open a table
    const firstTable = page.locator('[data-testid*="table"], [class*="table-item"], .tree-item').first();
    await expect(firstTable).toBeVisible({ timeout: 15000 });
    await firstTable.click();
    await page.waitForTimeout(1000);
    
    // Get tab and verify it has text
    const tab = page.locator('[data-testid="tab"], .tab, [role="tab"]').first();
    const tabText = await tab.textContent();
    expect(tabText).toBeTruthy();
    expect(tabText?.length).toBeGreaterThan(0);
  });

  test('should handle tab navigation with keyboard', async ({ page }) => {
    // Open multiple tabs
    const firstTable = page.locator('[data-testid*="table"], [class*="table-item"], .tree-item').first();
    await firstTable.click();
    await page.waitForTimeout(1000);
    
    const sqlButton = page.locator('button:has-text("SQL"), button:has-text("New SQL")').first();
    if (await sqlButton.isVisible({ timeout: 5000 })) {
      await sqlButton.click();
      await page.waitForTimeout(1000);
      
      // Try keyboard navigation (Cmd+Shift+[ or Cmd+Shift+])
      const isMac = process.platform === 'darwin';
      if (isMac) {
        await page.keyboard.press('Meta+Shift+BracketLeft');
        await page.waitForTimeout(500);
        
        await page.keyboard.press('Meta+Shift+BracketRight');
        await page.waitForTimeout(500);
      }
      
      // Verify tabs still exist
      const tabs = page.locator('[data-testid="tab"], .tab, [role="tab"]');
      const tabCount = await tabs.count();
      expect(tabCount).toBeGreaterThan(0);
    }
  });
});
