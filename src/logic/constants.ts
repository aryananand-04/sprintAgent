import type { AutonomyConfig } from '../types'

export const LOAD_ELIGIBILITY_THRESHOLD = 80  // above this: ineligible for new assignments
export const LOAD_MODERATE_THRESHOLD = 60      // below this: low load (good for confidence scoring)
export const LOAD_MAX = 99
export const LOAD_BASELINE = 30               // baseline overhead % (meetings, reviews, etc.) added to every member

export const DEFAULT_AUTONOMY_CONFIG: AutonomyConfig = {
  actMinClarity: 3,
  askMaxClarity: 2,
  escalateIfCriticalUnassignedHours: 1,
  neverAutoAssignTypes: [],
  capacityBreachThreshold: 90,
  blockedHoursThreshold: 2,
  escNudgeHours: 4,
  velocityDeficitPts: 6,
}
