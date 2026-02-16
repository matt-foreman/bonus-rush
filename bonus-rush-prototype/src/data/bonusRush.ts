import type { LadderConfig, LevelConfig } from '../types/bonusRush'

export const bonusRushLevels: LevelConfig[] = [
  {
    id: 1,
    title: 'Wordscapes Level 12',
    wheelLetters: ['R', 'N', 'A', 'B'],
    crosswordGrid: [
      ['#', 'B', 'A', 'R', '#', 'B'],
      ['#', 'R', '#', 'A', '#', 'R'],
      ['B', 'A', 'R', 'N', '#', 'A'],
      ['A', '#', '#', '#', '#', 'N'],
      ['N', 'A', 'B', '#', '#', '#'],
    ],
    crosswordWords: ['BAN', 'BAR', 'BRA', 'NAB', 'RAN', 'BARN', 'BRAN'],
    bonusWords: ['ARB'],
    allowedWords: ['BAN', 'BAR', 'BRA', 'NAB', 'RAN', 'BARN', 'BRAN', 'ARB'],
    totalWords: 8,
    starThresholdsPct: {
      oneStar: 0.4,
      twoStar: 0.66,
      threeStar: 1,
    },
  },
  {
    id: 2,
    title: 'Wordscapes Level 13',
    wheelLetters: ['S', 'A', 'V', 'E', 'D'],
    crosswordGrid: [
      ['S', 'A', 'V', 'E', '#'],
      ['A', '#', 'A', '#', 'A'],
      ['V', '#', 'S', 'A', 'D'],
      ['E', '#', 'E', '#', 'S'],
      ['D', '#', '#', '#', '#'],
    ],
    crosswordWords: ['ADS', 'SAD', 'SAVE', 'SAVED', 'VASE'],
    bonusWords: ['DEV', 'SEA'],
    allowedWords: ['ADS', 'SAD', 'SAVE', 'SAVED', 'VASE', 'DEV', 'SEA'],
    totalWords: 7,
    starThresholdsPct: {
      oneStar: 0.4,
      twoStar: 0.66,
      threeStar: 1,
    },
  },
  {
    id: 3,
    title: 'Wordscapes Level 14',
    wheelLetters: ['L', 'O', 'V', 'E', 'D'],
    crosswordGrid: [
      ['#', '#', 'D', '#', '#', '#', '#'],
      ['#', '#', 'O', '#', '#', '#', '#'],
      ['#', '#', 'L', 'O', 'V', 'E', 'D'],
      ['O', 'D', 'E', '#', '#', '#', 'O'],
      ['L', '#', '#', 'L', 'O', 'V', 'E'],
      ['D', 'O', 'V', 'E', '#', '#', '#'],
      ['#', '#', '#', 'D', '#', '#', '#'],
    ],
    crosswordWords: ['LOVE', 'LOVED', 'DOVE', 'OLD', 'DOE', 'ODE', 'DOLE', 'LED'],
    bonusWords: ['DEL', 'DEV', 'ELD', 'LODE', 'VELD', 'VOLE'],
    allowedWords: ['LOVE', 'LOVED', 'DOVE', 'OLD', 'DOE', 'ODE', 'DOLE', 'LED', 'DEL', 'DEV', 'ELD', 'LODE', 'VELD', 'VOLE'],
    totalWords: 14,
    starThresholdsPct: {
      oneStar: 0.4,
      twoStar: 0.66,
      threeStar: 1,
    },
  },
  {
    id: 4,
    title: 'Wordscapes Level 15',
    wheelLetters: ['T', 'H', 'I', 'S', 'G'],
    crosswordGrid: [
      ['S', 'I', 'G', 'H', '#', '#', '#'],
      ['I', '#', '#', 'I', '#', '#', '#'],
      ['T', 'H', 'I', 'S', '#', '#', 'H'],
      ['#', '#', 'T', '#', '#', '#', 'I'],
      ['#', '#', 'S', 'I', 'G', 'H', 'T'],
    ],
    crosswordWords: ['HIS', 'SIT', 'SIGH', 'THIS', 'SIGHT', 'HIT', 'ITS'],
    bonusWords: ['GIT', 'GITS', 'GIST', 'HITS', 'TIS'],
    allowedWords: ['HIS', 'SIT', 'SIGH', 'THIS', 'SIGHT', 'HIT', 'ITS', 'GIT', 'GITS', 'GIST', 'HITS', 'TIS'],
    totalWords: 12,
    starThresholdsPct: {
      oneStar: 0.4,
      twoStar: 0.66,
      threeStar: 1,
    },
  },
]

export const bonusRushLadderConfig: LadderConfig = {
  weekStartsOn: '2026-01-26',
  unlocks: [
    { levelId: 1, unlockDate: '2026-01-26' },
    { levelId: 2, unlockDate: '2026-02-02' },
    { levelId: 3, unlockDate: '2026-02-09' },
    { levelId: 4, unlockDate: '2026-02-16', label: 'Coming Next Week' },
  ],
}
