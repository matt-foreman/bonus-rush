interface BonusCounterProps {
  found: number
  bonusTotal: number
  className?: string
}

export function BonusCounter({ found, bonusTotal, className = '' }: BonusCounterProps) {
  return (
    <div className={`bonus-counter ${className}`.trim()} aria-label={`Bonus words ${found} out of ${bonusTotal}`}>
      <span>Bonus</span>
      <strong>
        {found} / {bonusTotal}
      </strong>
    </div>
  )
}
