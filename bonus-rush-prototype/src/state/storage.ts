import { bonusRushLadderConfig, bonusRushPuzzles } from '../data/bonusRush'
import type { TierName } from '../types/bonusRush'

const PROGRESS_STORAGE_KEY = 'bonus-rush.progress.v1'
const INVENTORY_STORAGE_KEY = 'bonus-rush.inventory.v1'

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

const defaultInventory: Inventory = {
  coins: 500,
  hints: 3,
  wildlifeTokens: 0,
  portraitProgress: 0,
  premiumPortraitDrops: 0,
}

function getTodayLocalISODate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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
  const puzzleIndex = bonusRushPuzzles.findIndex((puzzle) => puzzle.id === puzzleId)
  if (puzzleIndex === -1) {
    return false
  }

  const unlock = bonusRushLadderConfig.unlocks.find((item) => item.puzzleId === puzzleId)
  const today = getTodayLocalISODate()
  const weeklyDateReached = !unlock || today >= unlock.unlockDate

  if (puzzleIndex === 0) {
    return weeklyDateReached
  }

  const previousPuzzleId = bonusRushPuzzles[puzzleIndex - 1].id
  const previousBronzeStars = getProgress()[previousPuzzleId]?.Bronze?.bestStars ?? 0

  return previousBronzeStars >= 1 && weeklyDateReached
}

export function getInventory(): Inventory {
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
