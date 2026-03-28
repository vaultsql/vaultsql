# VaultSQL Frontend

React + TypeScript + Vite frontend for VaultSQL. Supports both web (SPA) and desktop (Tauri) modes.

## Quick Start

**Prerequisites**: Backend services must be running in Docker

```bash
# Start backend services first
task dev:up:d

# Install dependencies
npm install

# Start development server (web mode)
npm run dev
# Access at http://localhost:5173

# Start desktop mode
npm run dev:desktop
# Access at http://localhost:5174
```

## Project Structure

- `src/webapp/` - Web application (SPA) with authentication and routing
- `src/desktop/` - Tauri desktop application wrapper
- `src/workbench/` - SQL workbench (query editor, schema browser, results viewer)
- `src/components/` - Shared UI components (shadcn/ui)
- `src/lib/` - Shared utilities (API client, auth, types)
- `src/queries/` - React Query hooks for API calls

## Development

```bash
# Run tests
npm run test:run

# Lint
npm run lint

# Build for production
npm run build

# Type check
npm run type-check
```

## Authentication

**Dev Login**: When `API_DEBUG=true`, visit http://localhost:8400/auth/devlogin to auto-login as the configured dev user.

**Production**: Users authenticate via email/password or Google OAuth.

## OpenAPI Type Generation

After API changes, regenerate TypeScript types:

```bash
# Requires backend running in Docker
task dev:up:d

# Generate types
npx openapi-typescript 'http://localhost:8400/api/openapi.json' -o 'src/lib/openapi.d.ts'
```

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **TanStack Query** - Server state management
- **React Router** - Routing (webapp)
- **shadcn/ui** - UI components (Radix + Tailwind)
- **Monaco Editor** - SQL editor
- **Tauri** - Desktop wrapper (Rust)

## Testing

Tests use Vitest and React Testing Library:

```bash
# Run all tests
npm run test:run

# Run workbench DB adapter tests (requires Docker databases)
task test:workbench

# Watch mode
npm run test:watch
```
