import type { TierName } from '../types/bonusRush'

interface TierBadgeProps {
  tier: TierName
  className?: string
}

export function TierBadge({ tier, className = '' }: TierBadgeProps) {
  return <span className={`tier-badge tier-badge-${tier.toLowerCase()} ${className}`.trim()}>{tier}</span>
}
