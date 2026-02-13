interface TooltipProps {
  text: string
  x: number
  y: number
  placement: 'above' | 'below'
}

export function Tooltip({ text, x, y, placement }: TooltipProps) {
  return (
    <div
      className={`br-node-tooltip ${placement === 'above' ? 'is-above' : 'is-below'}`}
      style={{ left: `${x}px`, top: `${y}px` }}
      role="status"
      aria-live="polite"
    >
      {text}
    </div>
  )
}
