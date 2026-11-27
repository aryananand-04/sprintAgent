// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { serve } from 'inngest/next'
import { inngest } from '@/server/inngest/client'
import { functions } from '@/server/inngest/functions'

// Inngest calls this endpoint to run functions; requests are signed with INNGEST_SIGNING_KEY in production.
export const { GET, POST, PUT } = serve({ client: inngest, functions })
