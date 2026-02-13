import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CoinPill, DemoModeButton } from '../components'
import { LadderMap, type LadderMapLevel, type LadderNodeState } from '../components/LadderMap'
import { bonusRushPuzzles } from '../data/bonusRush'
import {
  getInventory,
  getLockReason,
  getPuzzleMasterySummary,
  getProgress,
  getPuzzleUnlockStatus,
  isDemoModeEnabled,
  setDemoModeEnabled,
} from '../state/storage'

function resolveNodeState(puzzleId: string, progress: ReturnType<typeof getProgress>): LadderNodeState {
  const unlockStatus = getPuzzleUnlockStatus(puzzleId)

  if (unlockStatus.isComingNextWeek) {
    return 'Coming Next Week'
  }

  if (!unlockStatus.isUnlocked) {
    return 'Locked'
  }

  if ((progress[puzzleId]?.Gold?.bestStars ?? 0) >= 1) {
    return 'Completed'
  }

  return 'In Progress'
}
export function Ladder() {
  const navigate = useNavigate()
  const [demoMode, setDemoMode] = useState(() => isDemoModeEnabled())
  const [showTitleFallback, setShowTitleFallback] = useState(false)
  const progress = useMemo(() => getProgress(), [demoMode])
  const inventory = useMemo(() => getInventory(), [demoMode])
  const levels = useMemo<LadderMapLevel[]>(
    () =>
      bonusRushPuzzles.map((puzzle, index) => {
        const state = resolveNodeState(puzzle.id, progress)
        const mastery = getPuzzleMasterySummary(puzzle.id)

        return {
          puzzleId: puzzle.id,
          levelNumber: index + 1,
          state,
          unlocked: state !== 'Locked' && state !== 'Coming Next Week',
          lockReason: getLockReason(puzzle.id),
          displayTier: mastery.displayTier,
          displayStars: mastery.displayStars,
        }
      }),
    [progress],
  )

  return (
    <section className="ladder-page">
      <header className="card ladder-header">
        <h1 className="sr-only">Bonus Rush</h1>
        <div className="ladder-title-wrap" aria-hidden="true">
          {showTitleFallback ? (
            <span className="ladder-title-fallback">
              {/* TODO: Swap this fallback text lockup with final production title image asset. */}
              Bonus Rush
            </span>
          ) : (
            <img
              className="ladder-title-image"
              src="/inspiration/title-example.jpg"
              alt=""
              onError={() => setShowTitleFallback(true)}
            />
          )}
        </div>
        <p>New puzzles every week</p>
        <CoinPill className="ladder-coin-pill" coins={inventory.coins} />
      </header>

      <LadderMap levels={levels} onSelectLevel={(puzzleId) => navigate(`/puzzle/${puzzleId}?tier=Bronze`)} />
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
