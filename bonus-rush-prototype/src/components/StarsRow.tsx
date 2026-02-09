interface StarsRowProps {
  stars: number
  maxStars?: number
  locked?: boolean
  className?: string
}

function clampStars(stars: number, maxStars: number): number {
  return Math.max(0, Math.min(maxStars, Math.floor(stars)))
}

export function StarsRow({ stars, maxStars = 3, locked = false, className = '' }: StarsRowProps) {
  const count = clampStars(stars, maxStars)

  return (
    <span className={`stars-row ${locked ? 'stars-row-locked' : ''} ${className}`.trim()}>
      {Array.from({ length: maxStars }).map((_, index) => (
        <span key={index} className={`stars-row-star ${index < count ? 'filled' : ''}`}>
          ★
        </span>
      ))}
    </span>
  )
}
