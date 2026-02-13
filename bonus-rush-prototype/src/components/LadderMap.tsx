import { useEffect, useState } from 'react'
import { MapBackground } from './MapBackground'
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
  isNextPlayable: boolean
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
const SINGLE_SCREEN_MAP_HEIGHT = 560
const STEP_Y = 200
const TOOLTIP_AUTO_CLOSE_MS = 2500
const PRESET_NODE_POINTS: Point[] = [
  { x: 98, y: 500 }, // level 1 bottom-left-ish
  { x: 262, y: 372 }, // level 2 mid-right
  { x: 122, y: 246 }, // level 3 mid-left
  { x: 270, y: 124 }, // level 4 top-right-ish
]

interface ActiveTooltip {
  puzzleId: string
  text: string
  x: number
  y: number
  placement: 'above' | 'below'
}

function getNodePositions(count: number): Point[] {
  if (count <= 0) {
    return []
  }

  if (count <= 4) {
    return PRESET_NODE_POINTS.slice(0, count)
  }

  const points = [...PRESET_NODE_POINTS]
  const amplitude = MAP_WIDTH * 0.24
  const frequency = 1.05
  const highestPresetY = PRESET_NODE_POINTS[3].y

  for (let index = 4; index < count; index += 1) {
    const x = MAP_WIDTH / 2 + Math.sin(index * frequency) * amplitude
    const y = highestPresetY - (index - 3) * STEP_Y
    points.push({ x, y })
  }

  return points
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
  const isSingleScreenPreset = levels.length <= 4
  const points = getNodePositions(levels.length)
  const mapHeight = isSingleScreenPreset
    ? SINGLE_SCREEN_MAP_HEIGHT
    : SINGLE_SCREEN_MAP_HEIGHT + Math.max(0, levels.length - 4) * STEP_Y
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
    <div
      className={`ladder-map-surface br-map-shell ${isSingleScreenPreset ? 'single-screen' : 'multi-screen'}`}
      role="list"
      aria-label="Bonus Rush progression map"
    >
      <div className="br-map-scroll">
        <div className="br-map-canvas" style={{ height: `${mapHeight}px` }}>
          <div className="br-layer-bg">
            <MapBackground width={MAP_WIDTH} height={mapHeight} nodePoints={points} />
          </div>
          <div className="br-layer-path">
            <svg className="br-map-svg" viewBox={`0 0 ${MAP_WIDTH} ${mapHeight}`} preserveAspectRatio="none" aria-hidden="true">
              <path className="br-map-path-shadow" d={pathData} />
              <path className="br-map-path" d={pathData} />
            </svg>
          </div>
          <div className="br-layer-nodes">
            {levels.map((level, index) => {
              const point = points[index]
              const isLocked = !level.unlocked || level.state === 'Coming Next Week'

              return (
                <button
                  key={level.puzzleId}
                  type="button"
                  role="listitem"
                  className={`ladder-node-base br-waypoint ${isLocked ? 'locked disabled' : ''} ${level.isNextPlayable ? 'next-playable' : ''}`}
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
          </div>
          <div className="br-layer-fg-vignette" aria-hidden="true" />

          {activeTooltip ? (
            <Tooltip text={activeTooltip.text} x={activeTooltip.x} y={activeTooltip.y} placement={activeTooltip.placement} />
          ) : null}
        </div>
      </div>
    </div>
  )
}
