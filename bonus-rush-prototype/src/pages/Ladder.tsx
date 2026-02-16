import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { type LadderMapSceneLevel, LadderMapScene } from '../components/LadderMapScene'
import { bonusRushLevels } from '../data/bonusRush'
import { getInventory, getLevelMasterySummary, getLevelUnlockStatus, getLockReason, getProgress } from '../state/storage'

export function Ladder() {
  const navigate = useNavigate()
  const inventory = useMemo(() => getInventory(), [])
  const progress = useMemo(() => getProgress(), [])

  const levels = useMemo<LadderMapSceneLevel[]>(
    () =>
      bonusRushLevels.map((level) => {
        const mastery = getLevelMasterySummary(level.id)
        const unlock = getLevelUnlockStatus(level.id)
        return {
          levelId: level.id,
          levelNumber: level.id,
          unlocked: unlock.isUnlocked && !unlock.isComingNextWeek,
          lockReason: getLockReason(level.id),
          displayTier: mastery.displayTier,
          displayStars: mastery.displayStars,
        }
      }),
    [],
  )

  return (
    <section className="ladder-page">
      <LadderMapScene
        levels={levels}
        coins={inventory.coins}
        onSelectLevel={(levelId) => {
          const bestStars = progress[levelId]?.bestStars ?? 0
          if (bestStars >= 3) {
            navigate(`/results/${levelId}`)
            return
          }
          navigate(`/puzzle/${levelId}`)
        }}
      />
    </section>
  )
}
