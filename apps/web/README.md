# Hously Web App

React TypeScript frontend for the Hously family utility app.

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **TanStack Router** - Client-side routing
- **TanStack Query** - Server state management
- **Tailwind CSS** - Styling
- **Vitest** - Testing framework
- **Vite** - Build tool

## Development

```bash
# Install dependencies (from root)
bun install

# Run dev server
bun run dev

# Run tests
bun run test

# Build for production
bun run build
```

The dev server runs on `http://localhost:5173` and proxies API requests to Flask backend at `http://localhost:5000`.

## Project Structure

```
apps/web/
├── src/
│   ├── components/      # Reusable React components
│   ├── routes/         # Route components (pages)
│   ├── lib/            # API client and utilities
│   ├── hooks/          # Custom React hooks
│   └── test/           # Test setup files
├── public/             # Static assets
└── dist/              # Production build output
```

## Testing

All components have corresponding test files in `__tests__` directories. Run tests with:

```bash
bun run test
```

## Production Build

The build output goes to `apps/web/dist/` which is served by Flask in production.

