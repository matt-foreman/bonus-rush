import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { bonusRushPuzzles } from '../data/bonusRush'
import {
  getInventory,
  getProgress,
  getPuzzleUnlockStatus,
  isDemoModeEnabled,
  isTierUnlocked,
  setDemoModeEnabled,
} from '../state/storage'
import type { TierName } from '../types/bonusRush'

type NodeState = 'Locked' | 'In Progress' | 'Completed' | 'Coming Next Week'

const tiers: TierName[] = ['Bronze', 'Silver', 'Gold']

function resolveNodeState(puzzleId: string, progress: ReturnType<typeof getProgress>): NodeState {
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

function StarsRow({ count, locked }: { count: number; locked: boolean }) {
  return (
    <span className={`stars ${locked ? 'is-locked' : ''}`} aria-label={locked ? 'Locked tier' : `${count} stars`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`star ${count > i ? 'filled' : ''}`}>
          ★
        </span>
      ))}
    </span>
  )
}

export function Ladder() {
  const navigate = useNavigate()
  const [demoMode, setDemoMode] = useState(() => isDemoModeEnabled())
  const progress = useMemo(() => getProgress(), [])
  const inventory = useMemo(() => getInventory(), [])

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

      <div className="ladder-scroll card" role="list" aria-label="Bonus Rush ladder">
        <div className="ladder-path" aria-hidden="true" />

        {bonusRushPuzzles.map((puzzle, index) => {
          const state = resolveNodeState(puzzle.id, progress)
          const disabled = state === 'Locked' || state === 'Coming Next Week'

          return (
            <button
              key={puzzle.id}
              type="button"
              role="listitem"
              className={`puzzle-node ${disabled ? 'disabled' : ''}`}
              disabled={disabled}
              onClick={() => navigate(`/puzzle/${puzzle.id}?tier=Bronze`)}
            >
              <div className="node-top">
                <span className="node-rank">{index + 1}</span>
                <h2>{puzzle.title}</h2>
                <span className={`state-badge state-${state.toLowerCase().replace(/\s+/g, '-')}`}>{state}</span>
              </div>

              <div className="tier-stars">
                {tiers.map((tier) => {
                  const tierProgress = progress[puzzle.id]?.[tier]
                  const tierLocked = !isTierUnlocked(puzzle.id, tier)
                  return (
                    <div key={tier} className="tier-row">
                      <span className="tier-name">{tier}</span>
                      <StarsRow count={tierProgress?.bestStars ?? 0} locked={tierLocked} />
                    </div>
                  )
                })}
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
