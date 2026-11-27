// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
/** Forwards GitHub webhooks from your smee.io channel (SMEE_URL in .env.local) to the local app. */
import { spawn } from 'node:child_process'

process.loadEnvFile('.env.local')
const source = process.env.SMEE_URL
if (!source) { console.error('Set SMEE_URL in .env.local (create a channel at https://smee.io).'); process.exit(1) }
spawn('npx', ['--yes', 'smee-client@5.0.0', '--url', source, '--target', 'http://localhost:3000/api/github/webhook'], { stdio: 'inherit' })
  .on('exit', (code) => process.exit(code ?? 0))
