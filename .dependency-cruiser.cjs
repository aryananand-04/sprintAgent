// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
/** Architecture rules. Run: npm run arch */
module.exports = {
  forbidden: [
    {
      name: 'logic-is-pure',
      comment: 'src/logic is the decision engine: no React, framework, IO, store or service imports.',
      severity: 'error',
      from: { path: '^src/logic' },
      to: { path: '^src/(components|hooks|store|services|lib|app|db|server)|node_modules/(react|react-dom|next|@supabase|zustand|framer-motion)' },
    },
    {
      name: 'server-only-stays-on-server',
      comment: 'Client code must never import server modules (secrets, LLM keys).',
      severity: 'error',
      from: { path: '^src/(components|hooks|store|services|logic)' },
      to: { path: '^src/server/|^src/lib/supabase/server|^src/lib/data/loadWorkspace' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'tests-not-imported',
      severity: 'error',
      from: { pathNot: '\\.test\\.ts$|^src/test/' },
      to: { path: '\\.test\\.ts$|^src/test/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    exclude: { path: '\\.next|node_modules' },
  },
}
