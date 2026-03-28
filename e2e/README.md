# VaultSQL Workbench E2E Tests

Playwright-based end-to-end tests for the VaultSQL workbench feature.

## Overview

These tests run against `localhost:8400` and focus on testing the workbench functionality including:
- Schema browser and navigation
- Table tabs with data grids and filters
- SQL worksheet editor and query execution
- Tab management (opening, closing, switching)

## Prerequisites

Before running the tests, ensure your development environment is set up:

1. **Start all services:**
   ```bash
   task dev:up:d
   ```

2. **Setup dev environment (first time only):**
   ```bash
   task dev:setup
   ```
   This will:
   - Initialize test databases (PostgreSQL and MySQL)
   - Run Django migrations
   - Seed the configured dev account

3. **Start frontend dev server:**
   ```bash
   task frontend:dev
   ```

## Running Tests

### Basic Commands

```bash
# Run all tests (headless)
task test:e2e:workbench

# Run tests with UI mode (interactive)
task test:e2e:workbench:ui

# Run tests in headed mode (visible browser)
task test:e2e:workbench:headed

# Run tests in debug mode (step through)
task test:e2e:workbench:debug
```

### Direct npm Commands

If you prefer to use npm directly:

```bash
cd e2e

# Install dependencies
npm ci

# Run all tests
npx playwright test

# Run specific test file
npx playwright test tests/workbench/schema-browser.spec.ts

# Run tests with UI
npx playwright test --ui

# Run tests in headed mode
npx playwright test --headed

# Run tests in debug mode
npx playwright test --debug

# Show test report
npx playwright show-report
```

## Test Structure

```
e2e/
├── playwright.config.ts       # Playwright configuration
├── package.json               # Dependencies
├── tests/
│   ├── fixtures/
│   │   └── auth.ts            # Authentication helpers
│   └── workbench/
│       ├── schema-browser.spec.ts    # Schema navigation tests
│       ├── table-tab.spec.ts         # Table viewing and filtering tests
│       ├── worksheet.spec.ts         # SQL editor tests
│       └── tab-management.spec.ts    # Tab operations tests
└── README.md
```

## Authentication

Tests use the `/api/auth/devlogin` endpoint to authenticate without requiring email/password:

- Default user: the configured dev identity (created by `task dev:seed`)
- The auth fixture automatically logs in and navigates to the workbench
- Each test gets a fresh browser context

## Test Data

Tests use the `kitchen_sink` databases (PostgreSQL and MySQL) that are seeded when you run `task dev:setup`. These databases contain:
- Multiple tables with various data types
- Foreign key relationships
- Indexes
- Views and materialized views
- Stored procedures and functions

To reset the test data:

```bash
# Reset entire dev environment
task dev:reset

# Or just reload kitchen_sink databases
task dev:db:seed:kitchen_sink
```

## Writing New Tests

1. Create a new spec file in `tests/workbench/`
2. Import the auth fixture:
   ```typescript
   import { test, expect } from '@playwright/test';
   import { setupWorkbenchTest } from '../fixtures/auth';
   ```

3. Use the fixture in `beforeEach`:
   ```typescript
   test.beforeEach(async ({ page }) => {
     await setupWorkbenchTest(page);
     await page.waitForLoadState('networkidle');
   });
   ```

4. Write your tests using Playwright's API

## Debugging Tests

### Visual Debugging

```bash
# Open UI mode for interactive debugging
task test:e2e:workbench:ui
```

### Debug Mode

```bash
# Run in debug mode (step through with inspector)
task test:e2e:workbench:debug
```

### Headed Mode

```bash
# See the browser while tests run
task test:e2e:workbench:headed
```

### Traces

Traces are automatically captured on first retry. To view:

```bash
npx playwright show-trace test-results/path-to-trace.zip
```

## CI/CD

These tests are designed to run locally and are **not** included in the CI pipeline. They require:
- A running development environment
- Seeded test data
- The frontend dev server

To run in CI, you would need to:
1. Start all services with `docker-compose.dev.yml`
2. Run migrations and seed data
3. Start the frontend dev server
4. Run the tests

## Troubleshooting

### Tests fail with "navigation timeout"

- Ensure all services are running: `docker compose -f docker-compose.dev.yml ps`
- Check frontend dev server is running on port 5173
- Verify Caddy is proxying correctly on port 8400

### Tests fail with "devlogin" errors

- Ensure `API_DEBUG=true` in your `env.txt`
- Verify dev account is seeded: `task dev:seed`

### Tests fail with "table not found"

- Reset test databases: `task dev:db:seed:kitchen_sink`

### Flaky tests

- Increase timeouts in test files
- Add more explicit waits: `await page.waitForTimeout(1000)`
- Use `waitForLoadState('networkidle')` before assertions

## Configuration

Edit `playwright.config.ts` to customize:
- Browser types (Chrome, Firefox, Safari)
- Viewport sizes
- Timeouts
- Retries
- Reporters
- Base URL

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Tests](https://playwright.dev/docs/debug)
