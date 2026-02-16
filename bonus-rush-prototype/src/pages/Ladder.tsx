import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { type LadderMapSceneLevel, LadderMapScene } from '../components/LadderMapScene'
import { bonusRushLevels } from '../data/bonusRush'
import { getInventory, getLevelMasterySummary, getLevelUnlockStatus, getLockReason } from '../state/storage'

export function Ladder() {
  const navigate = useNavigate()
  const inventory = useMemo(() => getInventory(), [])

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
      <LadderMapScene levels={levels} coins={inventory.coins} onSelectLevel={(levelId) => navigate(`/puzzle/${levelId}`)} />
    </section>
  )
}

