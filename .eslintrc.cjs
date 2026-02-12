module.exports = {
  root: true,
  ignorePatterns: ['**/node_modules/**', '**/dist/**'],
  overrides: [
    {
      files: ['apps/web/**/*.{ts,tsx,js,jsx}'],
      env: {
        browser: true,
        es2022: true,
        node: true,
        jest: true,
      },
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      plugins: ['@typescript-eslint', 'react-hooks'],
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:react-hooks/recommended',
        'prettier',
      ],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        'react-hooks/exhaustive-deps': 'off'
      },
    },
    {
      files: ['apps/app/**/*.{ts,tsx,js,jsx}'],
      extends: [
        '@react-native',
        'plugin:@typescript-eslint/recommended',
        'plugin:react/recommended',
        'plugin:react-hooks/recommended',
        'plugin:react-native/all',
        'prettier',
      ],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        tsconfigRootDir: __dirname,
        ecmaFeatures: {
          jsx: true,
        },
        project: './apps/app/tsconfig.json',
      },
      plugins: ['@typescript-eslint', 'react', 'react-hooks', 'react-native'],
      settings: {
        react: {
          version: 'detect',
        },
      },
      rules: {
        'no-catch-shadow': 'off',
        '@typescript-eslint/no-shadow': 'off',
        'react/react-in-jsx-scope': 'off',
        'react-native/no-unused-styles': 'warn',
        'react-native/split-platform-components': 'off',
        'react-native/no-inline-styles': 'off',
        'react-native/no-color-literals': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-explicit-any': 'warn',
        'react-hooks/exhaustive-deps': 'off',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      },
    },
    {
      files: ['apps/api/**/*.{ts,tsx,js,jsx}'],
      env: {
        node: true,
        es2022: true,
      },
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      plugins: ['@typescript-eslint'],
      extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      },
    },
  ],
};
