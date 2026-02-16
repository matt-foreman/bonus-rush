// Legacy UI token type used by medal/badge components.
export type TierName = 'Bronze' | 'Silver' | 'Gold'

export interface StarThresholdsPct {
  oneStar: number
  twoStar: number
  threeStar: number
}

export interface LevelConfig {
  id: number
  title: string
  wheelLetters: string[]
  crosswordGrid: string[][]
  crosswordWords: string[]
  bonusWords: string[]
  allowedWords: string[]
  totalWords: number
  starThresholdsPct: StarThresholdsPct
}

export interface LadderUnlock {
  levelId: number
  unlockDate: string
  label?: string
}

export interface LadderConfig {
  weekStartsOn: string
  unlocks: LadderUnlock[]
}
