interface DemoModeButtonProps {
  enabled: boolean
  onToggle: () => void
}

export function DemoModeButton({ enabled, onToggle }: DemoModeButtonProps) {
  return (
    <div className="demo-mode-fab-wrap" aria-live="polite">
      <button
        type="button"
        className={`demo-mode-fab ${enabled ? 'is-enabled' : ''}`}
        aria-label={enabled ? 'Disable Demo Mode' : 'Enable Demo Mode'}
        onClick={onToggle}
      >
        <span className="demo-mode-fab-letter">D</span>
      </button>
      {enabled ? <span className="demo-mode-indicator">Demo</span> : null}
    </div>
  )
}
