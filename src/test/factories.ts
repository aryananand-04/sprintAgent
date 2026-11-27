import type { Task, TeamMember, Sprint } from '../types'

export const makeTask = (over: Partial<Task> = {}): Task => ({
  id: 'task-1',
  title: 'Fix login button',
  description: 'Button does nothing on Safari',
  type: 'bug',
  status: 'backlog',
  urgency: 'high',
  impact: 4,
  effort: 2,
  risk: 2,
  clarity: 4,
  dependencies: [],
  source: 'PM',
  tags: ['frontend'],
  storyPoints: 3,
  createdAt: '2026-11-01T00:00:00.000Z',
  ...over,
})

export const makeMember = (over: Partial<TeamMember> = {}): TeamMember => ({
  id: 'm-1',
  name: 'Ada',
  initials: 'AD',
  role: 'Engineer',
  skills: ['frontend'],
  currentLoad: 50,
  capacity: 5,
  color: 'bg-blue-500',
  ...over,
})

export const makeSprint = (over: Partial<Sprint> = {}): Sprint => ({
  id: 's-1',
  name: 'Sprint 23',
  goal: 'Ship checkout v2',
  startDate: '2026-11-01',
  endDate: '2026-11-14',
  totalPoints: 50,
  committedPoints: 40,
  completedPoints: 20,
  health: 'green',
  daysRemaining: 5,
  velocity: 40,
  ...over,
})
