import { bonusRushLadderConfig, bonusRushPuzzles } from '../data/bonusRush'
import type { TierName } from '../types/bonusRush'

const PROGRESS_STORAGE_KEY = 'bonus-rush.progress.v1'
const INVENTORY_STORAGE_KEY = 'bonus-rush.inventory.v1'
export const DEBUG_ADVANCE_DAYS_KEY = 'bonus-rush.debugAdvanceDays'
export const DEMO_MODE_KEY = 'bonus-rush.demoMode'
const DAY_MS = 24 * 60 * 60 * 1000

export interface TierProgress {
  bestStars: number
  bestFound: number
}

export type PuzzleProgress = Partial<Record<TierName, TierProgress>>
export type ProgressState = Record<string, PuzzleProgress>

export interface Inventory {
  coins: number
  hints: number
  wildlifeTokens: number
  portraitProgress: number
  premiumPortraitDrops: number
}

export type InventoryDelta = Partial<Inventory>

const tierOrder: TierName[] = ['Bronze', 'Silver', 'Gold']

export interface PuzzleUnlockStatus {
  isUnlocked: boolean
  isComingNextWeek: boolean
  prerequisitesMet: boolean
  weeklyDateReached: boolean
  unlockDate?: string
  daysUntilUnlock: number
}

export interface PuzzleMasterySummary {
  displayTier: TierName
  displayStars: number
  isCompletedBronze: boolean
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

const demoInventory: Inventory = {
  coins: 99999,
  hints: 99,
  wildlifeTokens: 99,
  portraitProgress: 99,
  premiumPortraitDrops: 99,
}

function getTodayLocalISODate(): string {
  const now = getEffectiveTodayDate()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDebugAdvanceDays(): number {
  if (!isBrowserStorageAvailable()) {
    return 0
  }

  const raw = window.localStorage.getItem(DEBUG_ADVANCE_DAYS_KEY)
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) {
    return 0
  }

  return Math.trunc(parsed)
}

function getEffectiveTodayDate(): Date {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const debugAdvanceDays = getDebugAdvanceDays()
  if (debugAdvanceDays !== 0) {
    return new Date(now.getTime() + debugAdvanceDays * DAY_MS)
  }

  return now
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

export function getEffectiveTodayISODate(): string {
  return getTodayLocalISODate()
}

export function isDemoModeEnabled(): boolean {
  if (!isBrowserStorageAvailable()) {
    return false
  }

  return window.localStorage.getItem(DEMO_MODE_KEY) === 'true'
}

export function setDemoModeEnabled(enabled: boolean): void {
  if (!isBrowserStorageAvailable()) {
    return
  }

  window.localStorage.setItem(DEMO_MODE_KEY, enabled ? 'true' : 'false')

  if (enabled) {
    window.localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(demoInventory))
  }
}

function clampMinZero(value: number): number {
  return Math.max(0, value)
}

function clampStars(value: number): number {
  return Math.max(0, Math.min(3, value))
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

function isBrowserStorageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function sanitizeTierProgress(value: unknown): TierProgress {
  const maybe = value as Partial<TierProgress> | undefined
  return {
    bestStars: clampStars(Number(maybe?.bestStars ?? 0)),
    bestFound: clampMinZero(Number(maybe?.bestFound ?? 0)),
  }
}

function sanitizeProgressState(value: unknown): ProgressState {
  if (!value || typeof value !== 'object') {
    return {}
  }

  const entries = Object.entries(value as Record<string, unknown>).map(([puzzleId, puzzleValue]) => {
    const puzzleProgress: PuzzleProgress = {}
    if (puzzleValue && typeof puzzleValue === 'object') {
      for (const tier of tierOrder) {
        const maybeTier = (puzzleValue as Record<string, unknown>)[tier]
        if (maybeTier) {
          puzzleProgress[tier] = sanitizeTierProgress(maybeTier)
        }
      }
    }
    return [puzzleId, puzzleProgress] as const
  })

  return Object.fromEntries(entries)
}

function sanitizeInventory(value: unknown): Inventory {
  const maybe = (value as Partial<Inventory> | null) ?? {}
  return {
    coins: clampMinZero(Number(maybe.coins ?? defaultInventory.coins)),
    hints: clampMinZero(Number(maybe.hints ?? defaultInventory.hints)),
    wildlifeTokens: clampMinZero(Number(maybe.wildlifeTokens ?? defaultInventory.wildlifeTokens)),
    portraitProgress: clampMinZero(Number(maybe.portraitProgress ?? defaultInventory.portraitProgress)),
    premiumPortraitDrops: clampMinZero(
      Number(maybe.premiumPortraitDrops ?? defaultInventory.premiumPortraitDrops),
    ),
  }
}

export function getProgress(): ProgressState {
  if (!isBrowserStorageAvailable()) {
    return {}
  }

  const parsed = parseJSON<unknown>(window.localStorage.getItem(PROGRESS_STORAGE_KEY))
  return sanitizeProgressState(parsed)
}

export function setProgress(progress: ProgressState): void {
  if (!isBrowserStorageAvailable()) {
    return
  }

  const sanitized = sanitizeProgressState(progress)
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(sanitized))
}

export function recordRun(puzzleId: string, tier: TierName, found: number, stars: number): ProgressState {
  const progress = getProgress()
  const puzzleProgress = progress[puzzleId] ?? {}
  const current = puzzleProgress[tier] ?? { bestFound: 0, bestStars: 0 }

  const nextTierProgress: TierProgress = {
    bestFound: Math.max(current.bestFound, clampMinZero(found)),
    bestStars: Math.max(current.bestStars, clampStars(stars)),
  }

  const nextProgress: ProgressState = {
    ...progress,
    [puzzleId]: {
      ...puzzleProgress,
      [tier]: nextTierProgress,
    },
  }

  setProgress(nextProgress)
  return nextProgress
}

export function isTierUnlocked(puzzleId: string, tier: TierName): boolean {
  if (isDemoModeEnabled()) {
    return true
  }

  if (!isPuzzleUnlocked(puzzleId)) {
    return false
  }

  if (tier === 'Bronze') {
    return true
  }

  const progress = getProgress()
  const puzzleProgress = progress[puzzleId]

  if (tier === 'Silver') {
    return (puzzleProgress?.Bronze?.bestStars ?? 0) >= 1
  }

  return (puzzleProgress?.Silver?.bestStars ?? 0) >= 1
}

export function isPuzzleUnlocked(puzzleId: string): boolean {
  return getPuzzleUnlockStatus(puzzleId).isUnlocked
}

export function getPuzzleUnlockStatus(puzzleId: string): PuzzleUnlockStatus {
  if (isDemoModeEnabled()) {
    return {
      isUnlocked: true,
      isComingNextWeek: false,
      prerequisitesMet: true,
      weeklyDateReached: true,
      daysUntilUnlock: 0,
    }
  }

  const puzzleIndex = bonusRushPuzzles.findIndex((puzzle) => puzzle.id === puzzleId)
  if (puzzleIndex === -1) {
    return {
      isUnlocked: false,
      isComingNextWeek: false,
      prerequisitesMet: false,
      weeklyDateReached: false,
      daysUntilUnlock: 0,
    }
  }

  const unlock = bonusRushLadderConfig.unlocks.find((item) => item.puzzleId === puzzleId)
  const today = getEffectiveTodayDate()
  const unlockDate = parseISODate(unlock?.unlockDate)
  const daysUntilUnlock = unlockDate ? Math.ceil((unlockDate.getTime() - today.getTime()) / DAY_MS) : 0
  const weeklyDateReached = !unlockDate || daysUntilUnlock <= 0

  let prerequisitesMet = true

  if (puzzleIndex > 0) {
    const previousPuzzleId = bonusRushPuzzles[puzzleIndex - 1].id
    const previousBronzeStars = getProgress()[previousPuzzleId]?.Bronze?.bestStars ?? 0
    prerequisitesMet = previousBronzeStars >= 1
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

export function getLockReason(puzzleId: string): LockedReason | null {
  const unlockStatus = getPuzzleUnlockStatus(puzzleId)
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

export function getInventory(): Inventory {
  if (isDemoModeEnabled()) {
    return { ...demoInventory }
  }

  if (!isBrowserStorageAvailable()) {
    return { ...defaultInventory }
  }

  const parsed = parseJSON<unknown>(window.localStorage.getItem(INVENTORY_STORAGE_KEY))
  if (!parsed) {
    window.localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(defaultInventory))
    return { ...defaultInventory }
  }

  const sanitized = sanitizeInventory(parsed)
  window.localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(sanitized))
  return sanitized
}

export function getPuzzleMasterySummary(puzzleId: string): PuzzleMasterySummary {
  const progress = getProgress()[puzzleId]
  const bronzeStars = progress?.Bronze?.bestStars ?? 0
  const silverStars = progress?.Silver?.bestStars ?? 0
  const goldStars = progress?.Gold?.bestStars ?? 0

  if (goldStars > 0) {
    return {
      displayTier: 'Gold',
      displayStars: goldStars,
      isCompletedBronze: bronzeStars >= 1,
    }
  }

  if (silverStars > 0) {
    return {
      displayTier: 'Silver',
      displayStars: silverStars,
      isCompletedBronze: bronzeStars >= 1,
    }
  }

  return {
    displayTier: 'Bronze',
    displayStars: bronzeStars,
    isCompletedBronze: bronzeStars >= 1,
  }
}

export function updateInventory(delta: InventoryDelta): Inventory {
  const current = getInventory()
  const next: Inventory = {
    coins: clampMinZero(current.coins + (delta.coins ?? 0)),
    hints: clampMinZero(current.hints + (delta.hints ?? 0)),
    wildlifeTokens: clampMinZero(current.wildlifeTokens + (delta.wildlifeTokens ?? 0)),
    portraitProgress: clampMinZero(current.portraitProgress + (delta.portraitProgress ?? 0)),
    premiumPortraitDrops: clampMinZero(
      current.premiumPortraitDrops + (delta.premiumPortraitDrops ?? 0),
    ),
  }

  if (isBrowserStorageAvailable()) {
    window.localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(next))
  }

  return next
}
