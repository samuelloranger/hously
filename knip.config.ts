import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  workspaces: {
    '.': {
      entry: [],
      project: [],
    },
    'apps/api': {
      project: ['src/**/*.ts'],
      // @parse/node-apn: used via raw HTTP/crypto (no JS import), types pkg still needed
      // @react-email/*: JSX imports in emailService — knip misses JSX-only deps
      ignoreDependencies: ['@parse/node-apn', '@react-email/components', '@react-email/tailwind'],
    },
    'apps/web': {
      entry: ['src/sw/index.ts'],
      project: ['src/**/*.{ts,tsx}'],
      // @tailwindcss/typography: CSS @plugin directive — not a JS import, knip can't see it
      // ESLint deps: referenced by .eslintrc config file, not by source imports
      // @types/dompurify: dompurify IS imported in SafeHtml.tsx; knip incorrectly flags the @types pkg
      ignoreDependencies: [
        '@tailwindcss/typography',
        '@typescript-eslint/eslint-plugin',
        '@typescript-eslint/parser',
        'eslint-config-prettier',
        'eslint-plugin-react-hooks',
        '@types/dompurify',
      ],
    },
    'apps/shared': {
      project: ['src/**/*.ts'],
      // includeEntryExports: report unused exports from src/index.ts so dead
      // shared code is surfaced even though it's an "entry" file.
      includeEntryExports: true,
    },
    'apps/cli': {
      project: ['src/**/*.ts'],
    },
  },
  // elysia at root is a workspace-hoisted dep; the real consumer is apps/api
  ignoreDependencies: ['elysia'],
};

export default config;
