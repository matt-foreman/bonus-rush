interface ProgressBarProps {
  current: number
  total: number
  label?: string
  className?: string
}

export function ProgressBar({ current, total, label = 'Words Found', className = '' }: ProgressBarProps) {
  const safeTotal = Math.max(1, total)
  const displayTotal = Math.max(0, total)
  const safeCurrent = Math.max(0, Math.min(current, safeTotal))
  const displayCurrent = Math.max(0, Math.min(current, Math.max(0, total)))
  const progressPct = Math.max(0, Math.min(1, safeCurrent / safeTotal))

  return (
    <div className={`progress-bar ${className}`.trim()} aria-label={`${label}: ${displayCurrent} out of ${displayTotal}`}>
      <div className="progress-bar-label">
        {label}: {displayCurrent} / {displayTotal}
      </div>
      <div className="progress-bar-track" aria-hidden="true">
        <span className="progress-bar-fill" style={{ width: `${progressPct * 100}%` }} />
      </div>
    </div>
  )
}
