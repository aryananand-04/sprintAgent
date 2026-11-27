// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand

/**
 * Provenance marker. It is unique to this codebase and appears in source headers, SVG metadata and page meta,
 * so copies can be found by searching for it (.github/workflows/canary-watch.yml). Never change it.
 */
export const CANARY = 'sprintagent-prov-7c1e94d2b85a'

/** Build fingerprint: commit the bundle was built from (set in next.config.ts). */
export const BUILD_SHA = process.env.NEXT_PUBLIC_BUILD_SHA ?? 'dev'
