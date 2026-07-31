import { computeGlobalStats, computeRecentWeeklyAvg, type GlobalStats, type RecentWeeklyAvg } from '../utils/stats'
import type { DaysMap, DaysOffMap } from '../types'

export function getGlobalStats(days: DaysMap, daysOff: DaysOffMap): GlobalStats {
  return computeGlobalStats(days, daysOff)
}

export function getRecentWeeklyAvg(days: DaysMap, daysOff: DaysOffMap, weeksBack: number = 4): RecentWeeklyAvg {
  return computeRecentWeeklyAvg(days, daysOff, weeksBack)
}
