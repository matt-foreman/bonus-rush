import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LadderMap, type LadderMapLevel, type LadderNodeState } from '../components/LadderMap'
import { bonusRushPuzzles } from '../data/bonusRush'
import {
  getInventory,
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
  const progress = useMemo(() => getProgress(), [])
  const inventory = useMemo(() => getInventory(), [])
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
          displayTier: mastery.displayTier,
          displayStars: mastery.displayStars,
        }
      }),
    [progress],
  )

  return (
    <section className="ladder-page">
      <header className="card ladder-header">
        <h1>Bonus Rush</h1>
        <p>New puzzles every week</p>
        <div className="header-controls">
          {demoMode ? <span className="demo-badge">Demo Mode</span> : null}
          <button
            type="button"
            className={`demo-toggle ${demoMode ? 'active' : ''}`}
            onClick={() => {
              const next = !demoMode
              setDemoModeEnabled(next)
              setDemoMode(next)
              window.location.reload()
            }}
          >
            Demo Mode: {demoMode ? 'On' : 'Off'}
          </button>
        </div>
        <div className="inventory-strip" aria-label="Inventory">
          <span className="inventory-chip">Coins: {inventory.coins}</span>
          <span className="inventory-chip">Hints: {inventory.hints}</span>
        </div>
      </header>

      <LadderMap levels={levels} onSelectLevel={(puzzleId) => navigate(`/puzzle/${puzzleId}?tier=Bronze`)} />
    </section>
  )
}
