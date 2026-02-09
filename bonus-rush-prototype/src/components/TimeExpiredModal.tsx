import type { TierName } from '../types/bonusRush'
import { PrimaryButton, SecondaryButton } from './Buttons'

interface TimeExpiredModalProps {
  open: boolean
  tier: TierName
  coins: number
  rewardVideosUsed: number
  iapUsed: boolean
  onRewardVideo: () => void
  onCoins: () => void
  onIap: () => void
  onDecline: () => void
}

const coinCostByTier: Record<TierName, number> = {
  Bronze: 50,
  Silver: 100,
  Gold: 150,
}

export function TimeExpiredModal({
  open,
  tier,
  coins,
  rewardVideosUsed,
  iapUsed,
  onRewardVideo,
  onCoins,
  onIap,
  onDecline,
}: TimeExpiredModalProps) {
  if (!open) {
    return null
  }

  const coinCost = coinCostByTier[tier]
  const canUseRewardVideo = rewardVideosUsed < 3
  const canUseCoins = coins >= coinCost
  const canUseIap = !iapUsed

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="time-expired-modal card" role="dialog" aria-modal="true" aria-labelledby="time-expired-title">
        <h2 id="time-expired-title">Time Expired</h2>
        <p>Keep this run going with more time, or finish and view results.</p>

        <div className="time-expired-actions">
          <PrimaryButton onClick={onRewardVideo} disabled={!canUseRewardVideo}>
            Reward Video (+30s) {canUseRewardVideo ? `(${3 - rewardVideosUsed} left)` : '(Used)'}
          </PrimaryButton>

          <PrimaryButton onClick={onCoins} disabled={!canUseCoins}>
            Coins (+30s) {coinCost}
          </PrimaryButton>

          <PrimaryButton onClick={onIap} disabled={!canUseIap}>
            IAP (+60s) {canUseIap ? '' : '(Used)'}
          </PrimaryButton>
        </div>

        <p className="coins-note">Coins available: {coins}</p>

        <SecondaryButton onClick={onDecline}>No Thanks, View Results</SecondaryButton>
      </section>
    </div>
  )
}
