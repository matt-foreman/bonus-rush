import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { bonusRushLadderConfig, bonusRushPuzzles } from '../data/bonusRush'
import { getProgress, isPuzzleUnlocked, isTierUnlocked } from '../state/storage'
import type { TierName } from '../types/bonusRush'

type NodeState = 'Locked' | 'In Progress' | 'Completed' | 'Coming Next Week'

const tiers: TierName[] = ['Bronze', 'Silver', 'Gold']

function todayISODate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function resolveNodeState(puzzleId: string, progress: ReturnType<typeof getProgress>): NodeState {
  const unlock = bonusRushLadderConfig.unlocks.find((item) => item.puzzleId === puzzleId)
  const today = todayISODate()

  if (unlock?.label === 'Coming Next Week' && today < unlock.unlockDate) {
    return 'Coming Next Week'
  }

  if (!isPuzzleUnlocked(puzzleId)) {
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
  const progress = useMemo(() => getProgress(), [])

  return (
    <section className="ladder-page">
      <header className="card ladder-header">
        <h1>Bonus Rush</h1>
        <p>New puzzles every week</p>
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
