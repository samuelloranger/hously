import path from "node:path";
import { fileURLToPath } from "node:url";

import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import globals from "globals";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

const sharedTsLanguageOptions = {
  parser: tsParser,
  ecmaVersion: "latest",
  sourceType: "module",
};

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "apps/app/**",
      "apps/web/playwright-report/**",
      "apps/web/test-results/**",
    ],
  },
  ...compat
    .extends(
      "eslint:recommended",
      "plugin:@typescript-eslint/recommended",
      "plugin:react-hooks/recommended",
      "prettier",
    )
    .map((config) => ({
      ...config,
      files: ["apps/web/**/*.{ts,tsx,js,jsx}"],
    })),
  {
    files: ["apps/web/**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      ...sharedTsLanguageOptions,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "react-hooks/exhaustive-deps": "off",
    },
  },
  ...compat
    .extends("eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier")
    .map((config) => ({
      ...config,
      files: ["apps/api/**/*.{ts,tsx,js,jsx}"],
    })),
  {
    files: ["apps/api/**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      ...sharedTsLanguageOptions,
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
];
