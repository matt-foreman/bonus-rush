import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DemoModeButton, PrimaryButton, SecondaryButton, StarsRow } from '../components'
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
const MASTERY_STARS = 3
const SHOW_DEMO_MODE_UI = false

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
    const bestStars = progress?.[tier]?.bestStars ?? 0
    return bestStars < MASTERY_STARS
  })

  return nextTier ?? (tierOrder.find((tier) => isTierUnlocked(puzzleId, tier)) ?? 'Bronze')
}

export function Ladder() {
  const navigate = useNavigate()
  const [demoMode, setDemoMode] = useState(() => isDemoModeEnabled())
  const [resultsModalPuzzleId, setResultsModalPuzzleId] = useState<string | null>(null)
  const inventory = useMemo(() => getInventory(), [demoMode])
  const progress = useMemo(() => getProgress(), [demoMode, resultsModalPuzzleId])

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

  const modalPuzzle = useMemo(
    () => bonusRushPuzzles.find((puzzle) => puzzle.id === resultsModalPuzzleId) ?? null,
    [resultsModalPuzzleId],
  )

  const modalRows = useMemo(() => {
    if (!modalPuzzle) {
      return []
    }

    return tierOrder.map((tier) => {
      const stars = progress[modalPuzzle.id]?.[tier]?.bestStars ?? 0
      const unlocked = isTierUnlocked(modalPuzzle.id, tier)
      return { tier, stars, unlocked, replayable: unlocked && stars < MASTERY_STARS }
    })
  }, [modalPuzzle, progress])
  const modalAllMastered = modalRows.length > 0 && modalRows.every((row) => row.stars >= MASTERY_STARS)

  const nextLevelTarget = useMemo(() => {
    if (!modalPuzzle) {
      return null
    }

    const currentIndex = bonusRushPuzzles.findIndex((puzzle) => puzzle.id === modalPuzzle.id)
    if (currentIndex < 0) {
      return null
    }

    const nextLevel = bonusRushPuzzles[currentIndex + 1]
    if (!nextLevel || !resolveNodeUnlocked(nextLevel.id)) {
      return null
    }

    const nextProgress = progress[nextLevel.id]
    const nextTier = tierOrder.find((tier) => {
      if (!isTierUnlocked(nextLevel.id, tier)) {
        return false
      }
      const stars = nextProgress?.[tier]?.bestStars ?? 0
      return stars < MASTERY_STARS
    })

    if (!nextTier) {
      return null
    }

    return { puzzleId: nextLevel.id, tier: nextTier }
  }, [modalPuzzle, progress, demoMode])

  const hasMasteredAnyTier = (puzzleId: string): boolean =>
    tierOrder.some((tier) => (progress[puzzleId]?.[tier]?.bestStars ?? 0) >= MASTERY_STARS)

  const openPuzzle = (puzzleId: string, tier?: TierName) => {
    const entryTier = tier ?? resolveEntryTier(puzzleId)
    navigate(`/puzzle/${puzzleId}?tier=${entryTier}`)
    setResultsModalPuzzleId(null)
  }

  return (
    <section className="ladder-page">
      <LadderMapScene
        levels={levels}
        coins={inventory.coins}
        onSelectLevel={(puzzleId) => {
          if (hasMasteredAnyTier(puzzleId)) {
            setResultsModalPuzzleId(puzzleId)
            return
          }
          openPuzzle(puzzleId)
        }}
      />

      {modalPuzzle ? (
        <div className="modal-backdrop ladder-modal-backdrop" role="presentation">
          <section className="tier-results-modal card" role="dialog" aria-modal="true" aria-labelledby="tier-results-title">
            <h2 id="tier-results-title">{modalPuzzle.title} Tier Results</h2>
            <div className="tier-results-rows">
              {modalRows.map((row) => (
                <article key={row.tier} className="tier-results-row">
                  <div className="tier-results-meta">
                    <strong>{row.tier}</strong>
                    <StarsRow stars={row.stars} />
                  </div>
                  {row.replayable ? (
                    <SecondaryButton onClick={() => openPuzzle(modalPuzzle.id, row.tier)}>Replay</SecondaryButton>
                  ) : (
                    <span className="tier-results-state">{row.unlocked ? 'Mastered' : 'Locked'}</span>
                  )}
                </article>
              ))}
            </div>
            <div className="tier-results-actions">
              <PrimaryButton
                onClick={() => {
                  if (modalAllMastered) {
                    if (nextLevelTarget) {
                      openPuzzle(nextLevelTarget.puzzleId, nextLevelTarget.tier)
                    }
                    return
                  }
                  openPuzzle(modalPuzzle.id)
                }}
                disabled={modalAllMastered && !nextLevelTarget}
              >
                {modalAllMastered ? 'Play Next Level' : 'Play Next Available Tier'}
              </PrimaryButton>
              <SecondaryButton onClick={() => setResultsModalPuzzleId(null)}>Close</SecondaryButton>
            </div>
          </section>
        </div>
      ) : null}

      {SHOW_DEMO_MODE_UI ? (
        <DemoModeButton
          enabled={demoMode}
          onToggle={() => {
            const next = !demoMode
            setDemoModeEnabled(next)
            setDemoMode(next)
          }}
        />
      ) : null}
    </section>
  )
}
