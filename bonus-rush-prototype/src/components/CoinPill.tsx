interface CoinPillProps {
  coins: number
  className?: string
}

export function CoinPill({ coins, className = '' }: CoinPillProps) {
  return (
    <div className={`coin-pill ${className}`.trim()} aria-label={`Coins ${coins}`}>
      <span className="coin-pill-icon" aria-hidden="true">
        <span className="coin-pill-icon-core">$</span>
      </span>
      <strong className="coin-pill-value">{coins.toLocaleString()}</strong>
    </div>
  )
}
