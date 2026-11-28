// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import { after } from 'next/server'

/** Runs `fn` after the response when there is one; inline when called outside a request (jobs, tests). */
export async function afterResponse(fn: () => Promise<unknown>): Promise<void> {
  try { after(fn) } catch { await fn() }
}
