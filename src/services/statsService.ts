import { computeGlobalStats, computeRecentWeeklyAvg, type GlobalStats, type RecentWeeklyAvg } from '../utils/stats'
import type { DaysMap, DaysOffMap } from '../types'

export function getGlobalStats(days: DaysMap, daysOff: DaysOffMap, dailyTargetHours?: number): GlobalStats {
  return computeGlobalStats(days, daysOff, dailyTargetHours)
}

export function getRecentWeeklyAvg(days: DaysMap, daysOff: DaysOffMap, weeksBack: number = 4, dailyTargetHours?: number): RecentWeeklyAvg {
  return computeRecentWeeklyAvg(days, daysOff, weeksBack, dailyTargetHours)
}
