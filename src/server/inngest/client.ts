// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import { Inngest } from 'inngest'

/** Background jobs. Locally: `npm run jobs:dev` (no account). In production: INNGEST_EVENT_KEY + INNGEST_SIGNING_KEY. */
export const inngest = new Inngest({ id: 'sprint-agent' })

/** True when a job runner is configured (Inngest cloud keys, or the local dev server). */
export const jobsEnabled = () => !!(process.env.INNGEST_EVENT_KEY || process.env.INNGEST_DEV)
