import tseslint from 'typescript-eslint';

// `src/generated` is orval output and is never linted — the same rule the web client applies to its
// own generated client. What is left to police is `src/transport.ts`, whose whole job is to hold the
// seam open: it must stay free of app concerns (no auth, no storage, no navigation), because the two
// apps authenticate differently and each installs its own transport.
export default [
  { ignores: ['node_modules/**', 'src/generated/**', '*.config.ts'] },
  {
    files: ['src/**/*.ts', '*.test.ts'],
    languageOptions: { parser: tseslint.parser },
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@lupira/*', '**/data/*', '**/state/*', '**/ui/*'], message: 'transport.ts is the seam — it must not reach into an app.' },
        ],
      }],
    },
  },
];
