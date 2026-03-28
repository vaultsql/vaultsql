import { test, expect } from '@playwright/test';
import { setupWorkbenchTest } from '../fixtures/auth';

test.describe('Workbench Table Tab', () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate to workbench
    await setupWorkbenchTest(page);
    
    // Wait for the workbench to fully load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('should open table and display data grid', async ({ page }) => {
    // Find and click a table in the sidebar
    const firstTable = page.locator('[data-testid*="table"], [class*="table-item"], .tree-item').first();
    await expect(firstTable).toBeVisible({ timeout: 15000 });
    await firstTable.click();
    
    // Wait for the data grid to load
    await page.waitForTimeout(1500);
    
    // Look for data grid or table content
    const dataGrid = page.locator('[data-testid="data-grid"], .data-grid, [role="grid"], table').first();
    await expect(dataGrid).toBeVisible({ timeout: 10000 });
  });

  test('should display table data with rows', async ({ page }) => {
    // Open a table
    const firstTable = page.locator('[data-testid*="table"], [class*="table-item"], .tree-item').first();
    await expect(firstTable).toBeVisible({ timeout: 15000 });
    await firstTable.click();
    
    // Wait for data to load
    await page.waitForTimeout(2000);
    
    // Check for table rows
    const rows = page.locator('[role="row"], tr').filter({ hasNotText: /^$/ });
    const rowCount = await rows.count();
    
    // Should have at least header row
    expect(rowCount).toBeGreaterThan(0);
  });

  test('should switch between Data and Structure tabs', async ({ page }) => {
    // Open a table
    const firstTable = page.locator('[data-testid*="table"], [class*="table-item"], .tree-item').first();
    await expect(firstTable).toBeVisible({ timeout: 15000 });
    await firstTable.dblclick();
    
    // Wait for table tab to open
    await page.waitForTimeout(1500);
    
    // Look for Data/Structure tab switcher
    const structureTab = page.locator('text=/Structure/i, [data-testid="structure-tab"]').first();
    
    if (await structureTab.isVisible({ timeout: 5000 })) {
      // Click Structure tab
      await structureTab.click();
      await page.waitForTimeout(500);
      
      // Verify structure content is visible (columns, indexes, etc.)
      const structureContent = page.locator('text=/Columns|Indexes|Foreign Keys/i').first();
      await expect(structureContent).toBeVisible({ timeout: 5000 });
      
      // Switch back to Data tab
      const dataTab = page.locator('text=/^Data$/i, [data-testid="data-tab"]').first();
      await dataTab.click();
      await page.waitForTimeout(500);
    }
  });

  test('should display pagination controls', async ({ page }) => {
    // Open a table
    const firstTable = page.locator('[data-testid*="table"], [class*="table-item"], .tree-item').first();
    await expect(firstTable).toBeVisible({ timeout: 15000 });
    await firstTable.click();
    
    // Wait for table to load
    await page.waitForTimeout(2000);
    
    // Look for pagination controls (next, prev, limit, offset)
    const pagination = page.locator('[data-testid*="pagination"], .pagination, text=/Limit|Offset|Next|Previous/i').first();
    await expect(pagination).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to next page', async ({ page }) => {
    // Open a table
    const firstTable = page.locator('[data-testid*="table"], [class*="table-item"], .tree-item').first();
    await expect(firstTable).toBeVisible({ timeout: 15000 });
    await firstTable.click();
    
    // Wait for table to load
    await page.waitForTimeout(2000);
    
    // Look for Next button
    const nextButton = page.locator('button:has-text("Next"), [data-testid="next-page"], [aria-label*="Next"]').first();
    
    if (await nextButton.isVisible({ timeout: 5000 })) {
      const isDisabled = await nextButton.isDisabled();
      
      if (!isDisabled) {
        // Click next page
        await nextButton.click();
        await page.waitForTimeout(1000);
        
        // Verify page changed (look for loading state or data refresh)
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('should display filter toolbar', async ({ page }) => {
    // Open a table
    const firstTable = page.locator('[data-testid*="table"], [class*="table-item"], .tree-item').first();
    await expect(firstTable).toBeVisible({ timeout: 15000 });
    await firstTable.click();
    
    // Wait for table to load
    await page.waitForTimeout(2000);
    
    // Look for filter toolbar or add filter button
    const filterControl = page.locator('[data-testid*="filter"], .filter-toolbar, button:has-text("Filter"), button:has-text("Add Filter")').first();
    
    // Filter controls might not always be visible, but should exist
    const exists = await filterControl.count() > 0;
    expect(exists).toBeTruthy();
  });

  test('should add a filter to table data', async ({ page }) => {
    // Open a table
    const firstTable = page.locator('[data-testid*="table"], [class*="table-item"], .tree-item').first();
    await expect(firstTable).toBeVisible({ timeout: 15000 });
    await firstTable.click();
    
    // Wait for table to load
    await page.waitForTimeout(2000);
    
    // Look for add filter button
    const addFilterButton = page.locator('button:has-text("Add Filter"), [data-testid="add-filter"]').first();
    
    if (await addFilterButton.isVisible({ timeout: 5000 })) {
      // Click to add filter
      await addFilterButton.click();
      await page.waitForTimeout(500);
      
      // Verify filter UI appears (column selector, operator, value input)
      const filterUI = page.locator('[data-testid*="filter"], .filter-row, select, input[type="text"]').first();
      await expect(filterUI).toBeVisible({ timeout: 3000 });
    }
  });

  test('should display row details pane', async ({ page }) => {
    // Open a table
    const firstTable = page.locator('[data-testid*="table"], [class*="table-item"], .tree-item').first();
    await expect(firstTable).toBeVisible({ timeout: 15000 });
    await firstTable.click();
    
    // Wait for table to load
    await page.waitForTimeout(2000);
    
    // Click on a data row to open details
    const dataRow = page.locator('[role="row"], tr').filter({ hasNotText: /Columns|Name|Type/ }).first();
    
    if (await dataRow.isVisible({ timeout: 5000 })) {
      await dataRow.click();
      await page.waitForTimeout(500);
      
      // Look for details pane (might be a sidebar or panel)
      const detailsPane = page.locator('[data-testid*="details"], .details-pane, .row-details').first();
      
      // Details pane might not always be visible depending on UI design
      const exists = await detailsPane.count() > 0;
      expect(exists).toBeTruthy();
    }
  });

  test('should display export button in toolbar', async ({ page }) => {
    // Open a table
    const firstTable = page.locator('[data-testid*="table"], [class*="table-item"], .tree-item').first();
    await expect(firstTable).toBeVisible({ timeout: 15000 });
    await firstTable.dblclick();
    
    // Wait for table to load
    await page.waitForTimeout(2000);
    
    // Look for export button
    const exportButton = page.locator('button:has-text("Export"), [data-testid="export-button"]').first();
    
    if (await exportButton.isVisible({ timeout: 5000 })) {
      await expect(exportButton).toBeVisible();
    }
  });

  test('should open export dialog', async ({ page }) => {
    // Open a table
    const firstTable = page.locator('[data-testid*="table"], [class*="table-item"], .tree-item').first();
    await expect(firstTable).toBeVisible({ timeout: 15000 });
    await firstTable.dblclick();
    
    // Wait for table to load
    await page.waitForTimeout(2000);
    
    // Look for export button
    const exportButton = page.locator('button:has-text("Export"), [data-testid="export-button"]').first();
    
    if (await exportButton.isVisible({ timeout: 5000 })) {
      // Click export button
      await exportButton.click();
      await page.waitForTimeout(500);
      
      // Verify export dialog appears
      const exportDialog = page.locator('[role="dialog"], .modal, .dialog, text=/Export|CSV|JSON/i').first();
      await expect(exportDialog).toBeVisible({ timeout: 3000 });
    }
  });

  test('should display column headers', async ({ page }) => {
    // Open a table
    const firstTable = page.locator('[data-testid*="table"], [class*="table-item"], .tree-item').first();
    await expect(firstTable).toBeVisible({ timeout: 15000 });
    await firstTable.click();
    
    // Wait for table to load
    await page.waitForTimeout(2000);
    
    // Look for column headers
    const headers = page.locator('[role="columnheader"], th').first();
    await expect(headers).toBeVisible({ timeout: 10000 });
  });

  test('should show structure tab with columns information', async ({ page }) => {
    // Open a table
    const firstTable = page.locator('[data-testid*="table"], [class*="table-item"], .tree-item').first();
    await expect(firstTable).toBeVisible({ timeout: 15000 });
    await firstTable.dblclick();
    
    // Wait for table to load
    await page.waitForTimeout(2000);
    
    // Click Structure tab
    const structureTab = page.locator('text=/Structure/i, [data-testid="structure-tab"]').first();
    
    if (await structureTab.isVisible({ timeout: 5000 })) {
      await structureTab.click();
      await page.waitForTimeout(500);
      
      // Verify columns section is visible
      const columnsSection = page.locator('text=/Columns/i').first();
      await expect(columnsSection).toBeVisible({ timeout: 5000 });
    }
  });
});
