import type { TierName } from '../types/bonusRush'

interface MedalBadgeProps {
  tier: TierName
  stars: number
  className?: string
}

function clampStars(value: number): number {
  return Math.max(0, Math.min(3, Math.floor(value)))
}

export function MedalBadge({ tier, stars, className = '' }: MedalBadgeProps) {
  const safeStars = clampStars(stars)

  return (
    <div className={`medal-badge medal-${tier.toLowerCase()} ${safeStars === 0 ? 'is-empty' : ''} ${className}`.trim()}>
      <span className="medal-ribbon medal-ribbon-left" aria-hidden="true" />
      <span className="medal-ribbon medal-ribbon-right" aria-hidden="true" />
      <span className="medal-core" aria-hidden="true" />
      <span className="medal-stars" aria-label={`${safeStars} stars`}>
        {safeStars}
      </span>
    </div>
  )
}
