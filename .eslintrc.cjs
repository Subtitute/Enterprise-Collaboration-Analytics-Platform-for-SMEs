// Root-level ESLint configuration (ESLint 8.x / eslintrc format — matches the
// `eslint@^8.57.0` pinned in the root package.json devDependencies).
//
// This is a SINGLE config for the whole npm-workspaces monorepo (9 workspaces:
// apps/gateway, apps/iam-service, apps/project-task-service, apps/document-service,
// apps/notification-service, apps/analytics-service, apps/web, packages/common-dto,
// packages/common-guard). ESLint's classic (eslintrc) config cascades: it walks up
// from each linted file until it finds a config with `root: true`, so every
// workspace's `lint` script (`eslint "src/**/*.ts[x]"`, run via `npm run lint -w ...`)
// picks this file up automatically without needing a per-workspace `.eslintrc.*`.
//
// `parserOptions.project: true` (below) tells @typescript-eslint/parser to resolve,
// for EACH linted file, the nearest `tsconfig.json` found by walking up from that
// file's directory (see @typescript-eslint/typescript-estree's
// `getProjectConfigFiles`). Every workspace here has its own `tsconfig.json` right at
// its root (extending the shared `tsconfig.base.json`), so this transparently gives
// every file the correct, workspace-specific compiler settings (e.g. apps/web's JSX +
// DOM lib vs the NestJS services' CommonJS + Node settings) WITHOUT needing 9
// per-workspace `overrides` blocks here. A single shared project pointing directly at
// `tsconfig.base.json` was considered and rejected: `tsconfig.base.json` has no
// `jsx`/DOM `lib` entries, so apps/web's `.tsx` files would fail to parse under it.
//
// We intentionally only extend `plugin:@typescript-eslint/recommended` (NOT the
// `-type-checked` variant): none of its rules require type information, so linting
// stays fast and — combined with the CI pipeline's separate `tsc --noEmit` step per
// workspace (see .github/workflows/ci.yml) — full type safety is still covered
// without ESLint needing to duplicate the type checker's work.
module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
    project: true,
    tsconfigRootDir: __dirname,
    warnOnUnsupportedTypeScriptVersion: false,
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  ignorePatterns: [
    'dist/',
    'node_modules/',
    'coverage/',
    'build/',
    '*.tsbuildinfo',
    '**/*.tsbuildinfo',
  ],
  rules: {
    // TypeScript (via the per-workspace `tsc --noEmit` CI step) is the source of
    // truth for "is this identifier defined" — base ESLint's `no-undef` doesn't
    // understand TS ambient/global types and produces false positives on them.
    'no-undef': 'off',

    // --- Retrofit baseline ---
    // This config is being added retroactively to a codebase that was never linted
    // before (no .eslintrc existed until now). Keep `error` only for rules that
    // reliably indicate real bugs; everything more stylistic/opinionated is a `warn`
    // so that `npm run lint` becomes a useful, passing CI gate on day one instead of
    // failing outright on hundreds of pre-existing style nits.
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-empty-function': 'warn',
    '@typescript-eslint/no-empty-interface': 'warn',
    '@typescript-eslint/no-inferrable-types': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/ban-ts-comment': 'warn',
    '@typescript-eslint/no-var-requires': 'warn',
    '@typescript-eslint/no-empty-object-type': 'warn',
    'no-empty': 'warn',
    'no-constant-condition': ['warn', { checkLoops: false }],
    'no-console': 'off',
  },
  overrides: [
    {
      // apps/web is a React SPA (Vite) — layer React-specific linting on top of the
      // shared TS rules above, scoped only to this workspace.
      files: ['apps/web/**/*.ts', 'apps/web/**/*.tsx'],
      env: { browser: true, es2021: true },
      plugins: ['react', 'react-hooks'],
      extends: ['plugin:react/recommended', 'plugin:react-hooks/recommended'],
      settings: {
        react: { version: 'detect' },
      },
      rules: {
        // React 18 + Vite's automatic JSX runtime (tsconfig `jsx: "react-jsx"`)
        // means `React` doesn't need to be in scope for JSX to work.
        'react/react-in-jsx-scope': 'off',
        // Prop typing is already enforced by TypeScript; no need to duplicate via PropTypes.
        'react/prop-types': 'off',
      },
    },
    {
      files: ['**/*.spec.ts', '**/*.test.ts', '**/*.test.tsx'],
      env: { jest: true },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
};
