import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PrimaryButton, SecondaryButton, StarsRow, TierBadge } from '../components'
import { bonusRushPuzzles } from '../data/bonusRush'
import {
  getInventory,
  getProgress,
  isDemoModeEnabled,
  isPuzzleUnlocked,
  recordRun,
  type Inventory,
  type InventoryDelta,
  updateInventory,
} from '../state/storage'
import type { TierConfig, TierName } from '../types/bonusRush'

const STAR_REVEAL_MS = 360
const CLAIMED_RUNS_KEY = 'bonus-rush.claimed-runs.v1'
const tiers: TierName[] = ['Bronze', 'Silver', 'Gold']

function calculateStars(found: number, tier: TierConfig): number {
  if (found >= tier.thresholds.threeStar) {
    return 3
  }
  if (found >= tier.thresholds.twoStar) {
    return 2
  }
  if (found >= tier.thresholds.oneStar) {
    return 1
  }
  return 0
}

function rewardsForTierAndStars(tier: TierName, stars: number): InventoryDelta {
  if (stars <= 0) {
    return {}
  }

  const table: Record<TierName, Record<number, InventoryDelta>> = {
    Bronze: {
      1: { coins: 100 },
      2: { coins: 150, hints: 1 },
      3: { coins: 200, hints: 1, wildlifeTokens: 1 },
    },
    Silver: {
      1: { coins: 150, hints: 1 },
      2: { coins: 200, hints: 2, wildlifeTokens: 1 },
      3: { coins: 250, wildlifeTokens: 1, portraitProgress: 1 },
    },
    Gold: {
      1: { coins: 200, hints: 2 },
      2: { coins: 250, wildlifeTokens: 1, portraitProgress: 1 },
      3: { coins: 300, wildlifeTokens: 1, premiumPortraitDrops: 1 },
    },
  }

  return table[tier][stars] ?? {}
}

function getClaimedRunIds(): Set<string> {
  if (typeof window === 'undefined') {
    return new Set()
  }

  try {
    const raw = window.localStorage.getItem(CLAIMED_RUNS_KEY)
    if (!raw) {
      return new Set()
    }
    const parsed = JSON.parse(raw) as string[]
    return new Set(parsed)
  } catch {
    return new Set()
  }
}

function saveClaimedRunIds(ids: Set<string>): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(CLAIMED_RUNS_KEY, JSON.stringify([...ids]))
}

function rewardRows(delta: InventoryDelta): string[] {
  const rows: string[] = []

  if (delta.coins) {
    rows.push(`+${delta.coins} coins`)
  }
  if (delta.hints) {
    rows.push(`+${delta.hints} hint${delta.hints > 1 ? 's' : ''}`)
  }
  if (delta.wildlifeTokens) {
    rows.push(`+${delta.wildlifeTokens} wildlife token`)
  }
  if (delta.portraitProgress) {
    rows.push(`+${delta.portraitProgress} portrait progress`)
  }
  if (delta.premiumPortraitDrops) {
    rows.push(`+${delta.premiumPortraitDrops} premium portrait drop`)
  }

  return rows
}

export function Results() {
  const navigate = useNavigate()
  const { puzzleId } = useParams<{ puzzleId: string }>()
  const [searchParams] = useSearchParams()
  const demoMode = useMemo(() => isDemoModeEnabled(), [])

  const puzzle = useMemo(() => bonusRushPuzzles.find((entry) => entry.id === puzzleId), [puzzleId])
  const tier = useMemo<TierName>(() => {
    const raw = searchParams.get('tier') as TierName | null
    return raw && tiers.includes(raw) ? raw : 'Bronze'
  }, [searchParams])

  const tierConfig = puzzle?.tiers[tier]

  const found = useMemo(() => {
    if (!puzzle || !tierConfig) {
      return 0
    }

    const fromQuery = Number(searchParams.get('found'))
    if (Number.isFinite(fromQuery)) {
      return Math.max(0, Math.min(tierConfig.totalWords, Math.floor(fromQuery)))
    }

    return getProgress()[puzzle.id]?.[tier]?.bestFound ?? 0
  }, [puzzle, tier, tierConfig, searchParams])

  const stars = tierConfig ? calculateStars(found, tierConfig) : 0
  const [revealedStars, setRevealedStars] = useState(0)
  const [inventory, setInventory] = useState<Inventory>(() => getInventory())
  const [alreadyClaimed, setAlreadyClaimed] = useState(false)

  const rewards = useMemo(() => rewardsForTierAndStars(tier, stars), [tier, stars])
  const rewardList = useMemo(() => rewardRows(rewards), [rewards])

  useEffect(() => {
    setRevealedStars(0)
    if (stars <= 0) {
      return
    }

    const interval = window.setInterval(() => {
      setRevealedStars((value) => {
        if (value >= stars) {
          window.clearInterval(interval)
          return value
        }
        return value + 1
      })
    }, STAR_REVEAL_MS)

    return () => window.clearInterval(interval)
  }, [stars])

  useEffect(() => {
    if (!puzzle || !tierConfig) {
      return
    }

    recordRun(puzzle.id, tier, found, stars)

    const runId = searchParams.get('run') ?? `${puzzle.id}:${tier}:${found}`
    const claimId = `${puzzle.id}:${tier}:${runId}`
    const claimed = getClaimedRunIds()

    if (claimed.has(claimId) || stars <= 0) {
      setAlreadyClaimed(claimed.has(claimId))
      setInventory(getInventory())
      return
    }

    const nextInventory = updateInventory(rewards)
    claimed.add(claimId)
    saveClaimedRunIds(claimed)
    setInventory(nextInventory)
    setAlreadyClaimed(false)
  }, [puzzle, tierConfig, tier, found, stars, rewards, searchParams])

  if (!puzzle || !tierConfig) {
    return (
      <section className="card page">
        <h2>Results unavailable</h2>
        <SecondaryButton onClick={() => navigate('/')}>Back to Ladder</SecondaryButton>
      </section>
    )
  }

  const puzzleIndex = bonusRushPuzzles.findIndex((entry) => entry.id === puzzle.id)
  const nextPuzzle = puzzleIndex >= 0 ? bonusRushPuzzles[puzzleIndex + 1] : undefined
  const nextPuzzleUnlocked = nextPuzzle ? isPuzzleUnlocked(nextPuzzle.id) : false

  return (
    <section className="results-page card page">
      <header className="results-header">
        <h2>Run Complete</h2>
        {demoMode ? <span className="demo-badge">Demo Mode</span> : null}
        <TierBadge tier={tier} />
      </header>

      <div className="results-stars" aria-label={`${stars} stars`}>
        <StarsRow stars={revealedStars} />
      </div>

      <div className="result-grid">
        <article className="result-pill">
          <span>Found</span>
          <strong>{found}</strong>
        </article>
        <article className="result-pill">
          <span>Threshold</span>
          <strong>{tierConfig.thresholds.oneStar} / {tierConfig.thresholds.twoStar} / {tierConfig.thresholds.threeStar}</strong>
        </article>
        <article className="result-pill">
          <span>Best Stars</span>
          <strong>{getProgress()[puzzle.id]?.[tier]?.bestStars ?? stars}</strong>
        </article>
      </div>

      <section className="rewards-panel" aria-label="Rewards">
        <h3>Rewards</h3>
        {stars <= 0 ? (
          <p>No rewards earned this run.</p>
        ) : (
          <ul>
            {rewardList.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        {alreadyClaimed ? <p className="reward-note">Rewards already claimed for this run.</p> : null}
      </section>

      <section className="inventory-panel" aria-label="Inventory">
        <h3>Inventory</h3>
        <div className="result-grid">
          <article className="result-pill">
            <span>Coins</span>
            <strong>{inventory.coins}</strong>
          </article>
          <article className="result-pill">
            <span>Hints</span>
            <strong>{inventory.hints}</strong>
          </article>
          <article className="result-pill">
            <span>Wildlife</span>
            <strong>{inventory.wildlifeTokens}</strong>
          </article>
        </div>
      </section>

      <div className="results-actions">
        <PrimaryButton onClick={() => navigate(`/puzzle/${puzzle.id}?tier=${tier}`)}>Replay</PrimaryButton>
        <PrimaryButton
          onClick={() => nextPuzzle && navigate(`/puzzle/${nextPuzzle.id}?tier=Bronze`)}
          disabled={!nextPuzzle || !nextPuzzleUnlocked}
        >
          Next Puzzle
        </PrimaryButton>
      </div>
    </section>
  )
}
