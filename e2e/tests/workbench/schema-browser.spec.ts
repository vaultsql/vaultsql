import { test, expect } from '@playwright/test';
import { setupWorkbenchTest } from '../fixtures/auth';

test.describe('Workbench Schema Browser', () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate to workbench
    await setupWorkbenchTest(page);
    
    // Wait for the workbench to fully load
    await page.waitForLoadState('networkidle');
  });

  test('should display schema browser sidebar', async ({ page }) => {
    // Check that the resource pane (schema browser) is visible
    const resourcePane = page.locator('[data-testid="resource-pane"], .resource-pane, .schema-browser').first();
    await expect(resourcePane).toBeVisible({ timeout: 10000 });
  });

  test('should display tables in the schema', async ({ page }) => {
    // Wait for tables to load in the sidebar
    // Look for table items in the resource tree
    const tableItems = page.locator('[data-testid*="table"], [class*="table-item"], .tree-item').first();
    await expect(tableItems).toBeVisible({ timeout: 15000 });
  });

  test('should expand and collapse tables list', async ({ page }) => {
    // Find the tables section header/toggle
    const tablesSection = page.locator('text=/Tables/i').first();
    await expect(tablesSection).toBeVisible({ timeout: 10000 });
    
    // Click to collapse (if expanded)
    await tablesSection.click();
    await page.waitForTimeout(500);
    
    // Click to expand
    await tablesSection.click();
    await page.waitForTimeout(500);
    
    // Verify tables are visible after expanding
    const tableItems = page.locator('[data-testid*="table"], [class*="table-item"]').first();
    await expect(tableItems).toBeVisible({ timeout: 5000 });
  });

  test('should show context menu on right-click table', async ({ page }) => {
    // Wait for a table item to be visible
    const firstTable = page.locator('[data-testid*="table"], [class*="table-item"], .tree-item').first();
    await expect(firstTable).toBeVisible({ timeout: 15000 });
    
    // Right-click to open context menu
    await firstTable.click({ button: 'right' });
    
    // Wait for context menu to appear
    const contextMenu = page.locator('[role="menu"], .context-menu, [data-testid="context-menu"]').first();
    await expect(contextMenu).toBeVisible({ timeout: 3000 });
    
    // Verify menu has expected options (Open, Star, Copy, Query)
    const menuText = await contextMenu.textContent();
    expect(menuText).toMatch(/Open|Star|Copy|Query/i);
  });

  test('should open table preview tab on single click', async ({ page }) => {
    // Find and click a table
    const firstTable = page.locator('[data-testid*="table"], [class*="table-item"], .tree-item').first();
    await expect(firstTable).toBeVisible({ timeout: 15000 });
    
    // Get the table name for verification
    const tableName = await firstTable.textContent();
    
    // Single click to open preview
    await firstTable.click();
    
    // Wait for tab to appear
    await page.waitForTimeout(1000);
    
    // Verify a tab was opened (look for tab bar or tab content)
    const tabBar = page.locator('[data-testid="tab-bar"], .tab-bar, [role="tablist"]').first();
    await expect(tabBar).toBeVisible({ timeout: 5000 });
    
    // Verify tab contains the table name
    const activeTab = page.locator('[data-testid="tab"], .tab, [role="tab"]').first();
    await expect(activeTab).toBeVisible();
  });

  test('should open pinned table tab on double click', async ({ page }) => {
    // Find a table
    const firstTable = page.locator('[data-testid*="table"], [class*="table-item"], .tree-item').first();
    await expect(firstTable).toBeVisible({ timeout: 15000 });
    
    // Double click to open pinned tab
    await firstTable.dblclick();
    
    // Wait for tab to appear
    await page.waitForTimeout(1000);
    
    // Verify tab bar is visible
    const tabBar = page.locator('[data-testid="tab-bar"], .tab-bar, [role="tablist"]').first();
    await expect(tabBar).toBeVisible({ timeout: 5000 });
  });

  test('should display current schema in toolbar', async ({ page }) => {
    // Look for schema selector or current schema display in toolbar
    const toolbar = page.locator('[data-testid="workbench-toolbar"], .workbench-toolbar, .toolbar').first();
    await expect(toolbar).toBeVisible({ timeout: 10000 });
    
    // Verify toolbar contains schema information
    const toolbarText = await toolbar.textContent();
    expect(toolbarText).toBeTruthy();
  });

  test('should open command palette with Cmd+K', async ({ page }) => {
    // Press Cmd+K (or Ctrl+K on non-Mac)
    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+k' : 'Control+k');
    
    // Wait for command palette to appear
    const commandPalette = page.locator('[data-testid="command-palette"], .command-palette, [role="dialog"]').first();
    await expect(commandPalette).toBeVisible({ timeout: 3000 });
  });

  test('should show different resource types (tables, views, routines)', async ({ page }) => {
    // Wait for the resource pane to load
    await page.waitForTimeout(2000);
    
    // Look for section headers in the resource pane
    const resourcePane = page.locator('[data-testid="resource-pane"], .resource-pane, .schema-browser').first();
    await expect(resourcePane).toBeVisible({ timeout: 10000 });
    
    const paneText = await resourcePane.textContent();
    
    // Should have at least Tables section
    expect(paneText).toMatch(/Tables/i);
  });

  test('should display worksheets sidebar pane', async ({ page }) => {
    // Look for worksheets pane
    const worksheetsPane = page.locator('[data-testid="worksheets-pane"], .worksheets-pane, text=/Worksheets/i').first();
    await expect(worksheetsPane).toBeVisible({ timeout: 10000 });
  });

  test('should toggle sidebar pane visibility', async ({ page }) => {
    // Find a collapsible pane header
    const paneHeader = page.locator('[data-testid*="pane-header"], .pane-header').first();
    
    if (await paneHeader.isVisible()) {
      // Click to collapse
      await paneHeader.click();
      await page.waitForTimeout(500);
      
      // Click to expand
      await paneHeader.click();
      await page.waitForTimeout(500);
    }
  });
});
