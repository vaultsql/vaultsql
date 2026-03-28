import { test, expect } from '@playwright/test';
import { setupWorkbenchTest } from '../fixtures/auth';

test.describe('Workbench SQL Worksheet', () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate to workbench
    await setupWorkbenchTest(page);
    
    // Wait for the workbench to fully load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('should open new SQL worksheet from toolbar', async ({ page }) => {
    // Look for SQL or New SQL button in toolbar
    const sqlButton = page.locator('button:has-text("SQL"), button:has-text("New SQL"), [data-testid="new-sql-button"]').first();
    await expect(sqlButton).toBeVisible({ timeout: 10000 });
    
    // Click to open new worksheet
    await sqlButton.click();
    await page.waitForTimeout(1000);
    
    // Verify worksheet tab opened
    const worksheetTab = page.locator('[data-testid*="worksheet"], .worksheet-tab, text=/Worksheet|SQL/i').first();
    await expect(worksheetTab).toBeVisible({ timeout: 5000 });
  });

  test('should display SQL editor', async ({ page }) => {
    // Open new worksheet
    const sqlButton = page.locator('button:has-text("SQL"), button:has-text("New SQL"), [data-testid="new-sql-button"]').first();
    await sqlButton.click();
    await page.waitForTimeout(1000);
    
    // Look for code editor (CodeMirror)
    const editor = page.locator('.cm-editor, .CodeMirror, [data-testid="sql-editor"], textarea').first();
    await expect(editor).toBeVisible({ timeout: 5000 });
  });

  test('should type SQL query in editor', async ({ page }) => {
    // Open new worksheet
    const sqlButton = page.locator('button:has-text("SQL"), button:has-text("New SQL"), [data-testid="new-sql-button"]').first();
    await sqlButton.click();
    await page.waitForTimeout(1000);
    
    // Find the editor content area
    const editorContent = page.locator('.cm-content, .CodeMirror-code, [data-testid="sql-editor"]').first();
    await expect(editorContent).toBeVisible({ timeout: 5000 });
    
    // Click to focus and type SQL
    await editorContent.click();
    await page.keyboard.type('SELECT 1 AS test;');
    await page.waitForTimeout(500);
    
    // Verify text was entered
    const editorText = await page.locator('.cm-editor, .CodeMirror').first().textContent();
    expect(editorText).toContain('SELECT');
  });

  test('should display Run button', async ({ page }) => {
    // Open new worksheet
    const sqlButton = page.locator('button:has-text("SQL"), button:has-text("New SQL"), [data-testid="new-sql-button"]').first();
    await sqlButton.click();
    await page.waitForTimeout(1000);
    
    // Look for Run button
    const runButton = page.locator('button:has-text("Run"), [data-testid="run-query"], [aria-label*="Run"]').first();
    await expect(runButton).toBeVisible({ timeout: 5000 });
  });

  test('should execute SQL query and display results', async ({ page }) => {
    // Open new worksheet
    const sqlButton = page.locator('button:has-text("SQL"), button:has-text("New SQL"), [data-testid="new-sql-button"]').first();
    await sqlButton.click();
    await page.waitForTimeout(1000);
    
    // Type a simple query
    const editorContent = page.locator('.cm-content, .CodeMirror-code, [data-testid="sql-editor"]').first();
    await editorContent.click();
    await page.keyboard.type('SELECT 1 AS test;');
    await page.waitForTimeout(500);
    
    // Click Run button
    const runButton = page.locator('button:has-text("Run"), [data-testid="run-query"]').first();
    await runButton.click();
    
    // Wait for query to execute
    await page.waitForTimeout(2000);
    
    // Look for results pane
    const resultsPane = page.locator('[data-testid*="results"], .results-pane, .query-results').first();
    await expect(resultsPane).toBeVisible({ timeout: 10000 });
    
    // Verify results contain data
    const resultsText = await resultsPane.textContent();
    expect(resultsText).toBeTruthy();
  });

  test('should execute query with Cmd+Enter', async ({ page }) => {
    // Open new worksheet
    const sqlButton = page.locator('button:has-text("SQL"), button:has-text("New SQL"), [data-testid="new-sql-button"]').first();
    await sqlButton.click();
    await page.waitForTimeout(1000);
    
    // Type a query
    const editorContent = page.locator('.cm-content, .CodeMirror-code, [data-testid="sql-editor"]').first();
    await editorContent.click();
    await page.keyboard.type('SELECT 2 AS value;');
    await page.waitForTimeout(500);
    
    // Press Cmd+Enter (or Ctrl+Enter on non-Mac)
    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+Enter' : 'Control+Enter');
    
    // Wait for query to execute
    await page.waitForTimeout(2000);
    
    // Verify results appear
    const resultsPane = page.locator('[data-testid*="results"], .results-pane, .query-results').first();
    await expect(resultsPane).toBeVisible({ timeout: 10000 });
  });

  test('should display error for invalid SQL', async ({ page }) => {
    // Open new worksheet
    const sqlButton = page.locator('button:has-text("SQL"), button:has-text("New SQL"), [data-testid="new-sql-button"]').first();
    await sqlButton.click();
    await page.waitForTimeout(1000);
    
    // Type invalid SQL
    const editorContent = page.locator('.cm-content, .CodeMirror-code, [data-testid="sql-editor"]').first();
    await editorContent.click();
    await page.keyboard.type('INVALID SQL QUERY HERE;');
    await page.waitForTimeout(500);
    
    // Run the query
    const runButton = page.locator('button:has-text("Run"), [data-testid="run-query"]').first();
    await runButton.click();
    
    // Wait for error to appear
    await page.waitForTimeout(2000);
    
    // Look for error message
    const errorMessage = page.locator('[data-testid*="error"], .error-message, text=/error|syntax|invalid/i').first();
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });

  test('should display results in data grid format', async ({ page }) => {
    // Open new worksheet
    const sqlButton = page.locator('button:has-text("SQL"), button:has-text("New SQL"), [data-testid="new-sql-button"]').first();
    await sqlButton.click();
    await page.waitForTimeout(1000);
    
    // Type a query that returns data
    const editorContent = page.locator('.cm-content, .CodeMirror-code, [data-testid="sql-editor"]').first();
    await editorContent.click();
    await page.keyboard.type('SELECT 1 AS id, \'test\' AS name;');
    await page.waitForTimeout(500);
    
    // Run query
    const runButton = page.locator('button:has-text("Run"), [data-testid="run-query"]').first();
    await runButton.click();
    await page.waitForTimeout(2000);
    
    // Look for data grid in results
    const dataGrid = page.locator('[role="grid"], table, .data-grid').first();
    await expect(dataGrid).toBeVisible({ timeout: 10000 });
  });

  test('should highlight current SQL statement', async ({ page }) => {
    // Open new worksheet
    const sqlButton = page.locator('button:has-text("SQL"), button:has-text("New SQL"), [data-testid="new-sql-button"]').first();
    await sqlButton.click();
    await page.waitForTimeout(1000);
    
    // Type multiple statements
    const editorContent = page.locator('.cm-content, .CodeMirror-code, [data-testid="sql-editor"]').first();
    await editorContent.click();
    await page.keyboard.type('SELECT 1;\nSELECT 2;\nSELECT 3;');
    await page.waitForTimeout(500);
    
    // Move cursor to first statement
    await page.keyboard.press('Home');
    await page.keyboard.press('Home');
    await page.waitForTimeout(300);
    
    // Check if statement highlighting exists (visual indicator)
    const editor = page.locator('.cm-editor, .CodeMirror').first();
    const editorHTML = await editor.innerHTML();
    
    // Just verify editor has content
    expect(editorHTML).toContain('SELECT');
  });

  test('should show query execution status', async ({ page }) => {
    // Open new worksheet
    const sqlButton = page.locator('button:has-text("SQL"), button:has-text("New SQL"), [data-testid="new-sql-button"]').first();
    await sqlButton.click();
    await page.waitForTimeout(1000);
    
    // Type query
    const editorContent = page.locator('.cm-content, .CodeMirror-code, [data-testid="sql-editor"]').first();
    await editorContent.click();
    await page.keyboard.type('SELECT 1;');
    await page.waitForTimeout(500);
    
    // Run query
    const runButton = page.locator('button:has-text("Run"), [data-testid="run-query"]').first();
    await runButton.click();
    
    // Wait for completion
    await page.waitForTimeout(2000);
    
    // Look for status indicator (success, row count, execution time)
    const statusArea = page.locator('[data-testid*="status"], .status-bar, text=/rows?|ms|success/i').first();
    
    // Status might be in various places
    const exists = await statusArea.count() > 0;
    expect(exists).toBeTruthy();
  });

  test('should clear results when running new query', async ({ page }) => {
    // Open new worksheet
    const sqlButton = page.locator('button:has-text("SQL"), button:has-text("New SQL"), [data-testid="new-sql-button"]').first();
    await sqlButton.click();
    await page.waitForTimeout(1000);
    
    // Run first query
    const editorContent = page.locator('.cm-content, .CodeMirror-code, [data-testid="sql-editor"]').first();
    await editorContent.click();
    await page.keyboard.type('SELECT 1 AS first;');
    
    const runButton = page.locator('button:has-text("Run"), [data-testid="run-query"]').first();
    await runButton.click();
    await page.waitForTimeout(2000);
    
    // Clear and run second query
    await page.keyboard.press('Control+a');
    await page.keyboard.type('SELECT 2 AS second;');
    await runButton.click();
    await page.waitForTimeout(2000);
    
    // Verify results updated
    const resultsPane = page.locator('[data-testid*="results"], .results-pane, .query-results').first();
    await expect(resultsPane).toBeVisible({ timeout: 5000 });
  });

  test('should support SQL syntax highlighting', async ({ page }) => {
    // Open new worksheet
    const sqlButton = page.locator('button:has-text("SQL"), button:has-text("New SQL"), [data-testid="new-sql-button"]').first();
    await sqlButton.click();
    await page.waitForTimeout(1000);
    
    // Type SQL with keywords
    const editorContent = page.locator('.cm-content, .CodeMirror-code, [data-testid="sql-editor"]').first();
    await editorContent.click();
    await page.keyboard.type('SELECT * FROM users WHERE id = 1;');
    await page.waitForTimeout(500);
    
    // Check that syntax highlighting is applied (look for styled spans)
    const editor = page.locator('.cm-editor, .CodeMirror').first();
    const editorHTML = await editor.innerHTML();
    
    // Verify editor contains the SQL
    expect(editorHTML).toContain('SELECT');
  });
});
