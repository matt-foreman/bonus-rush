import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DemoModeButton } from '../components'
import { type LadderMapSceneLevel, LadderMapScene } from '../components/LadderMapScene'
import { bonusRushPuzzles } from '../data/bonusRush'
import {
  getInventory,
  getLockReason,
  getPuzzleMasterySummary,
  getProgress,
  getPuzzleUnlockStatus,
  isDemoModeEnabled,
  isTierUnlocked,
  setDemoModeEnabled,
} from '../state/storage'
import type { TierName } from '../types/bonusRush'

function resolveNodeUnlocked(puzzleId: string): boolean {
  const unlockStatus = getPuzzleUnlockStatus(puzzleId)
  return unlockStatus.isUnlocked && !unlockStatus.isComingNextWeek
}

const tierOrder: TierName[] = ['Bronze', 'Silver', 'Gold']

function resolveEntryTier(puzzleId: string): TierName {
  const puzzle = bonusRushPuzzles.find((item) => item.id === puzzleId)
  if (!puzzle) {
    return 'Bronze'
  }

  const progress = getProgress()[puzzleId]
  const nextTier = tierOrder.find((tier) => {
    if (!isTierUnlocked(puzzleId, tier)) {
      return false
    }
    const bestFound = progress?.[tier]?.bestFound ?? 0
    return bestFound < puzzle.tiers[tier].allowedWords.length
  })

  return nextTier ?? (tierOrder.find((tier) => isTierUnlocked(puzzleId, tier)) ?? 'Bronze')
}

export function Ladder() {
  const navigate = useNavigate()
  const [demoMode, setDemoMode] = useState(() => isDemoModeEnabled())
  const inventory = useMemo(() => getInventory(), [demoMode])

  const levels = useMemo<LadderMapSceneLevel[]>(
    () =>
      bonusRushPuzzles.map((puzzle, index) => {
        const mastery = getPuzzleMasterySummary(puzzle.id)

        return {
          puzzleId: puzzle.id,
          levelNumber: index + 1,
          unlocked: resolveNodeUnlocked(puzzle.id),
          lockReason: getLockReason(puzzle.id),
          displayTier: mastery.displayTier,
          displayStars: mastery.displayStars,
        }
      }),
    [demoMode],
  )

  return (
    <section className="ladder-page">
      <LadderMapScene
        levels={levels}
        coins={inventory.coins}
        onSelectLevel={(puzzleId) => navigate(`/puzzle/${puzzleId}?tier=${resolveEntryTier(puzzleId)}`)}
      />
      <DemoModeButton
        enabled={demoMode}
        onToggle={() => {
          const next = !demoMode
          setDemoModeEnabled(next)
          setDemoMode(next)
        }}
      />
    </section>
  )
}
