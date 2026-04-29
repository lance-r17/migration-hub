import type { Project } from '@/types'

const MONTH_NAMES = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']

export function parseDate(value: string): Date | null {
  const trimmed = value.trim()

  // 1. ISO / RFC strings (includes backend timestamps like 2026-04-29T12:21:37.918Z)
  const iso = new Date(trimmed)
  if (!isNaN(iso.getTime())) return iso

  // 2. Pattern: "20 Mar 2026"
  const dayMonYear = trimmed.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/)
  if (dayMonYear) {
    const day = parseInt(dayMonYear[1], 10)
    const month = MONTH_NAMES.indexOf(dayMonYear[2].toLowerCase().slice(0, 3))
    const year = parseInt(dayMonYear[3], 10)
    if (!isNaN(day) && month !== -1 && !isNaN(year)) {
      const parsed = new Date(year, month, day)
      if (!isNaN(parsed.getTime())) return parsed
    }
  }

  // 3. Legacy pattern: "Apr 29, 08:21 PM" (no year — assume current year)
  const monDayTime = trimmed.match(/^([A-Za-z]{3,})\s+(\d{1,2}),\s+(\d{1,2}):(\d{2})\s+(AM|PM)$/i)
  if (monDayTime) {
    const month = MONTH_NAMES.indexOf(monDayTime[1].toLowerCase().slice(0, 3))
    const day = parseInt(monDayTime[2], 10)
    let hour = parseInt(monDayTime[3], 10)
    const minute = parseInt(monDayTime[4], 10)
    const meridian = monDayTime[5].toUpperCase()
    const year = new Date().getFullYear()

    if (meridian === 'PM' && hour !== 12) hour += 12
    if (meridian === 'AM' && hour === 12) hour = 0

    if (!isNaN(day) && month !== -1 && !isNaN(hour) && !isNaN(minute)) {
      const parsed = new Date(year, month, day, hour, minute)
      if (!isNaN(parsed.getTime())) return parsed
    }
  }

  return null
}

export function getSignoffCompletionDate(project: Project): Date | null {
  if (!project.approvals || project.approvals.length === 0) return null

  const allApproved = project.approvals.every((a) => a.status === 'approved')
  if (project.stageProgress?.signoff !== 100 && !allApproved) return null

  const approvedDates = project.approvals
    .filter((a) => a.status === 'approved' && a.timestamp)
    .map((a) => parseDate(a.timestamp!))
    .filter((d): d is Date => d !== null)

  if (approvedDates.length === 0) return null
  return new Date(Math.max(...approvedDates.map((d) => d.getTime())))
}
