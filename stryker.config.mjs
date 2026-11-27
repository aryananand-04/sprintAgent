// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
/** Mutation testing for the decision engine. Weekly in CI (.github/workflows/weekly.yml). */
export default {
  testRunner: 'vitest',
  mutate: ['src/logic/**/*.ts', '!src/logic/**/*.test.ts', '!src/logic/autonomy.ts'],
  vitest: { configFile: 'vitest.config.ts', related: true },
  // Copy text isn't behaviour; mutating strings only measures wording.
  mutator: { excludedMutations: ['StringLiteral'] },
  reporters: ['clear-text', 'progress', 'html'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  thresholds: { high: 85, low: 70, break: 50 }, // baseline 54% (2026-11-27); ratchet up,
  concurrency: 4,
  timeoutMS: 20000,
  tempDirName: '.stryker-tmp',
}
