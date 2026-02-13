import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CoinPill, DemoModeButton } from '../components'
import { type LadderMapSceneLevel, LadderMapScene } from '../components/LadderMapScene'
import { bonusRushPuzzles } from '../data/bonusRush'
import {
  getInventory,
  getLockReason,
  getPuzzleMasterySummary,
  getPuzzleUnlockStatus,
  isDemoModeEnabled,
  setDemoModeEnabled,
} from '../state/storage'

function resolveNodeUnlocked(puzzleId: string): boolean {
  const unlockStatus = getPuzzleUnlockStatus(puzzleId)
  return unlockStatus.isUnlocked && !unlockStatus.isComingNextWeek
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
      <header className="card ladder-header ladder-header--compact">
        <h1 className="sr-only">Bonus Rush</h1>
        <CoinPill className="ladder-coin-pill" coins={inventory.coins} />
      </header>

      <LadderMapScene levels={levels} onSelectLevel={(puzzleId) => navigate(`/puzzle/${puzzleId}?tier=Bronze`)} />
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
