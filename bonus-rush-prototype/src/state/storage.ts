import { bonusRushLadderConfig, bonusRushLevels } from '../data/bonusRush'

const PROGRESS_STORAGE_KEY = 'bonus-rush.progress.v2'
const INVENTORY_STORAGE_KEY = 'bonus-rush.inventory.v1'
const TIMER_STORAGE_PREFIX = 'bonusRush.timerEndsAt'
export const DEBUG_ADVANCE_DAYS_KEY = 'bonus-rush.debugAdvanceDays'
export const DEMO_MODE_KEY = 'bonus-rush.demoMode'
const DAY_MS = 24 * 60 * 60 * 1000

export interface LevelProgress {
  bestStars: number
  bestFound: number
}

export type ProgressState = Record<number, LevelProgress>

export interface Inventory {
  coins: number
  hints: number
  wildlifeTokens: number
  portraitProgress: number
  premiumPortraitDrops: number
}

export type InventoryDelta = Partial<Inventory>

export interface LevelUnlockStatus {
  isUnlocked: boolean
  isComingNextWeek: boolean
  prerequisitesMet: boolean
  weeklyDateReached: boolean
  unlockDate?: string
  daysUntilUnlock: number
}

export interface LevelMasterySummary {
  displayTier: 'Bronze' | 'Silver' | 'Gold'
  displayStars: number
  isMastered: boolean
}

export enum LockedReason {
  PreviousLevel = 'PREVIOUS_LEVEL',
  WeeklyUnlock = 'WEEKLY_UNLOCK',
}

const defaultInventory: Inventory = {
  coins: 500,
  hints: 3,
  wildlifeTokens: 0,
  portraitProgress: 0,
  premiumPortraitDrops: 0,
}

const resetInventory: Inventory = {
  coins: 1000,
  hints: 0,
  wildlifeTokens: 0,
  portraitProgress: 0,
  premiumPortraitDrops: 0,
}

function isBrowserStorageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function parseJSON<T>(raw: string | null): T | null {
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function clampMinZero(value: number): number {
  return Math.max(0, value)
}

function clampStars(value: number): number {
  return Math.max(0, Math.min(3, value))
}

function sanitizeProgressState(value: unknown): ProgressState {
  if (!value || typeof value !== 'object') {
    return {}
  }

  const next: ProgressState = {}
  for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>)) {
    const levelId = Number(rawKey)
    if (!Number.isFinite(levelId)) {
      continue
    }
    const maybe = (rawValue as Partial<LevelProgress> | null) ?? {}
    next[levelId] = {
      bestStars: clampStars(Number(maybe.bestStars ?? 0)),
      bestFound: clampMinZero(Number(maybe.bestFound ?? 0)),
    }
  }
  return next
}

function sanitizeInventory(value: unknown): Inventory {
  const maybe = (value as Partial<Inventory> | null) ?? {}
  return {
    coins: clampMinZero(Number(maybe.coins ?? defaultInventory.coins)),
    hints: clampMinZero(Number(maybe.hints ?? defaultInventory.hints)),
    wildlifeTokens: clampMinZero(Number(maybe.wildlifeTokens ?? defaultInventory.wildlifeTokens)),
    portraitProgress: clampMinZero(Number(maybe.portraitProgress ?? defaultInventory.portraitProgress)),
    premiumPortraitDrops: clampMinZero(Number(maybe.premiumPortraitDrops ?? defaultInventory.premiumPortraitDrops)),
  }
}

function getDebugAdvanceDays(): number {
  if (!isBrowserStorageAvailable()) {
    return 0
  }
  const raw = window.localStorage.getItem(DEBUG_ADVANCE_DAYS_KEY)
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0
}

function getEffectiveTodayDate(): Date {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const debugAdvanceDays = getDebugAdvanceDays()
  return debugAdvanceDays === 0 ? now : new Date(now.getTime() + debugAdvanceDays * DAY_MS)
}

function parseISODate(dateISO: string | undefined): Date | null {
  if (!dateISO) {
    return null
  }
  const [year, month, day] = dateISO.split('-').map((part) => Number(part))
  if (!year || !month || !day) {
    return null
  }
  const parsed = new Date(year, month - 1, day)
  parsed.setHours(0, 0, 0, 0)
  return parsed
}

export function getProgress(): ProgressState {
  if (!isBrowserStorageAvailable()) {
    return {}
  }
  return sanitizeProgressState(parseJSON(window.localStorage.getItem(PROGRESS_STORAGE_KEY)))
}

export function setProgress(progress: ProgressState): void {
  if (!isBrowserStorageAvailable()) {
    return
  }
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(sanitizeProgressState(progress)))
}

export function resetAllProgress(): void {
  setProgress({})
  if (!isBrowserStorageAvailable()) {
    return
  }
  window.localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(resetInventory))
  for (const level of bonusRushLevels) {
    window.localStorage.removeItem(`${TIMER_STORAGE_PREFIX}.${level.id}`)
  }
}

export function recordRun(levelId: number, found: number, stars: number): ProgressState {
  const progress = getProgress()
  const current = progress[levelId] ?? { bestFound: 0, bestStars: 0 }
  const next: ProgressState = {
    ...progress,
    [levelId]: {
      bestFound: Math.max(current.bestFound, clampMinZero(found)),
      bestStars: Math.max(current.bestStars, clampStars(stars)),
    },
  }
  setProgress(next)
  return next
}

export function getLevelUnlockStatus(levelId: number): LevelUnlockStatus {
  const levelIndex = bonusRushLevels.findIndex((level) => level.id === levelId)
  if (levelIndex === -1) {
    return {
      isUnlocked: false,
      isComingNextWeek: false,
      prerequisitesMet: false,
      weeklyDateReached: false,
      daysUntilUnlock: 0,
    }
  }

  const unlock = bonusRushLadderConfig.unlocks.find((item) => item.levelId === levelId)
  const today = getEffectiveTodayDate()
  const unlockDate = parseISODate(unlock?.unlockDate)
  const daysUntilUnlock = unlockDate ? Math.ceil((unlockDate.getTime() - today.getTime()) / DAY_MS) : 0
  const weeklyDateReached = !unlockDate || daysUntilUnlock <= 0

  let prerequisitesMet = true
  if (levelIndex > 0) {
    const previousLevelId = bonusRushLevels[levelIndex - 1].id
    const previousStars = getProgress()[previousLevelId]?.bestStars ?? 0
    prerequisitesMet = previousStars >= 1
  }

  const isUnlocked = prerequisitesMet && weeklyDateReached
  const isComingNextWeek = !isUnlocked && daysUntilUnlock > 0 && daysUntilUnlock <= 7

  return {
    isUnlocked,
    isComingNextWeek,
    prerequisitesMet,
    weeklyDateReached,
    unlockDate: unlock?.unlockDate,
    daysUntilUnlock: Math.max(0, daysUntilUnlock),
  }
}

export function isLevelUnlocked(levelId: number): boolean {
  return getLevelUnlockStatus(levelId).isUnlocked
}

export function getLockReason(levelId: number): LockedReason | null {
  const unlockStatus = getLevelUnlockStatus(levelId)
  if (unlockStatus.isUnlocked) {
    return null
  }
  if (!unlockStatus.prerequisitesMet) {
    return LockedReason.PreviousLevel
  }
  if (!unlockStatus.weeklyDateReached) {
    return LockedReason.WeeklyUnlock
  }
  return LockedReason.PreviousLevel
}

export function getLevelMasterySummary(levelId: number): LevelMasterySummary {
  const stars = getProgress()[levelId]?.bestStars ?? 0
  if (stars >= 3) {
    return { displayTier: 'Gold', displayStars: stars, isMastered: true }
  }
  if (stars >= 2) {
    return { displayTier: 'Silver', displayStars: stars, isMastered: false }
  }
  return { displayTier: 'Bronze', displayStars: stars, isMastered: false }
}

export function getInventory(): Inventory {
  if (!isBrowserStorageAvailable()) {
    return { ...defaultInventory }
  }

  const parsed = parseJSON(window.localStorage.getItem(INVENTORY_STORAGE_KEY))
  if (!parsed) {
    window.localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(defaultInventory))
    return { ...defaultInventory }
  }
  const sanitized = sanitizeInventory(parsed)
  window.localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(sanitized))
  return sanitized
}

export function updateInventory(delta: InventoryDelta): Inventory {
  const current = getInventory()
  const next: Inventory = {
    coins: clampMinZero(current.coins + (delta.coins ?? 0)),
    hints: clampMinZero(current.hints + (delta.hints ?? 0)),
    wildlifeTokens: clampMinZero(current.wildlifeTokens + (delta.wildlifeTokens ?? 0)),
    portraitProgress: clampMinZero(current.portraitProgress + (delta.portraitProgress ?? 0)),
    premiumPortraitDrops: clampMinZero(current.premiumPortraitDrops + (delta.premiumPortraitDrops ?? 0)),
  }
  if (isBrowserStorageAvailable()) {
    window.localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(next))
  }
  return next
}
