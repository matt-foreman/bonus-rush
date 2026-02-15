export type TierName = 'Bronze' | 'Silver' | 'Gold'

export interface TierThresholds {
  oneStar: number
  twoStar: number
  threeStar: number
}

export interface TierConfig {
  name: TierName
  addedBoardLetters: string[]
  totalWords: number
  bonusWordsTotal: number
  thresholds: TierThresholds
  crosswordGrid: string[][]
  allowedWords: string[]
  crosswordWords?: string[]
}

export interface PuzzleConfig {
  id: string
  title: string
  wheelLetters: string[]
  tiers: Record<TierName, TierConfig>
}

export interface LadderUnlock {
  puzzleId: string
  unlockDate: string
  label?: string
}

export interface LadderConfig {
  weekStartsOn: string
  unlocks: LadderUnlock[]
}
