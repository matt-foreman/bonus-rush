import { useEffect, useState } from 'react'
import { MedalBadge } from './MedalBadge'
import { Tooltip } from './Tooltip'
import { LockedReason } from '../state/storage'
import type { TierName } from '../types/bonusRush'

export type LadderNodeState = 'Locked' | 'In Progress' | 'Completed' | 'Coming Next Week'

export interface LadderMapLevel {
  puzzleId: string
  levelNumber: number
  state: LadderNodeState
  unlocked: boolean
  lockReason: LockedReason | null
  displayTier: TierName
  displayStars: number
}

interface LadderMapProps {
  levels: LadderMapLevel[]
  onSelectLevel: (puzzleId: string) => void
}

interface Point {
  x: number
  y: number
}

const MAP_WIDTH = 360
const TOP_PADDING = 96
const BOTTOM_PADDING = 120
const STEP_Y = 200
const TOOLTIP_AUTO_CLOSE_MS = 2500

interface ActiveTooltip {
  puzzleId: string
  text: string
  x: number
  y: number
  placement: 'above' | 'below'
}

function buildNodePoints(count: number): Point[] {
  const centerX = MAP_WIDTH / 2
  const amplitude = MAP_WIDTH * 0.24
  const frequency = 1.05
  const maxIndex = Math.max(1, count - 1)
  const mapHeight = TOP_PADDING + BOTTOM_PADDING + maxIndex * STEP_Y

  return Array.from({ length: count }).map((_, index) => {
    const progress = index / maxIndex
    const y = mapHeight - BOTTOM_PADDING - progress * (mapHeight - TOP_PADDING - BOTTOM_PADDING)
    const x = centerX + Math.sin(index * frequency) * amplitude
    return { x, y }
  })
}

function buildSmoothPath(points: Point[]): string {
  if (points.length === 0) {
    return ''
  }

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`
  }

  let path = `M ${points[0].x} ${points[0].y}`

  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1]
    const current = points[index]
    const midX = (prev.x + current.x) / 2
    const midY = (prev.y + current.y) / 2
    path += ` Q ${prev.x} ${prev.y} ${midX} ${midY}`
  }

  const last = points[points.length - 1]
  path += ` T ${last.x} ${last.y}`
  return path
}

export function LadderMap({ levels, onSelectLevel }: LadderMapProps) {
  const points = buildNodePoints(levels.length)
  const mapHeight = TOP_PADDING + BOTTOM_PADDING + Math.max(1, levels.length - 1) * STEP_Y
  const pathData = buildSmoothPath(points)
  const [activeTooltip, setActiveTooltip] = useState<ActiveTooltip | null>(null)

  useEffect(() => {
    if (!activeTooltip) {
      return
    }

    const timeout = window.setTimeout(() => {
      setActiveTooltip(null)
    }, TOOLTIP_AUTO_CLOSE_MS)

    return () => window.clearTimeout(timeout)
  }, [activeTooltip])

  useEffect(() => {
    if (!activeTooltip) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) {
        return
      }
      if (target.closest('.br-node-tooltip') || target.closest('.br-waypoint.locked')) {
        return
      }

      setActiveTooltip(null)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [activeTooltip])

  const messageForReason = (reason: LockedReason | null): string => {
    if (reason === LockedReason.WeeklyUnlock) {
      return 'Coming next week'
    }
    return 'Finish the previous level'
  }

  return (
    <div className="ladder-map-surface br-map-shell" role="list" aria-label="Bonus Rush progression map">
      <div className="br-map-scroll">
        <div className="br-map-canvas" style={{ height: `${mapHeight}px` }}>
          <svg className="br-map-svg" viewBox={`0 0 ${MAP_WIDTH} ${mapHeight}`} preserveAspectRatio="none" aria-hidden="true">
            <path className="br-map-path-shadow" d={pathData} />
            <path className="br-map-path" d={pathData} />
          </svg>

          {levels.map((level, index) => {
            const point = points[index]
            const isLocked = !level.unlocked || level.state === 'Coming Next Week'

            return (
              <button
                key={level.puzzleId}
                type="button"
                role="listitem"
                className={`ladder-node-base br-waypoint ${isLocked ? 'locked disabled' : ''}`}
                aria-disabled={isLocked}
                style={{ left: `${point.x}px`, top: `${point.y}px` }}
                onClick={() => {
                  if (isLocked) {
                    setActiveTooltip({
                      puzzleId: level.puzzleId,
                      text: messageForReason(level.lockReason),
                      x: point.x,
                      y: point.y,
                      placement: point.y < 138 ? 'below' : 'above',
                    })
                    return
                  }
                  setActiveTooltip(null)
                  onSelectLevel(level.puzzleId)
                }}
              >
                <span className="br-waypoint-level">Lv {level.levelNumber}</span>
                <MedalBadge tier={level.displayTier} stars={level.displayStars} />
                {isLocked ? (
                  <span className="br-waypoint-lock-overlay" aria-hidden="true">
                    <span className="br-waypoint-lock-icon">🔒</span>
                  </span>
                ) : null}
              </button>
            )
          })}

          {activeTooltip ? (
            <Tooltip text={activeTooltip.text} x={activeTooltip.x} y={activeTooltip.y} placement={activeTooltip.placement} />
          ) : null}
        </div>
      </div>
    </div>
  )
}
