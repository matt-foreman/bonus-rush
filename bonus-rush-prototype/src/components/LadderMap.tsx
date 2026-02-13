import { MedalBadge } from './MedalBadge'
import type { TierName } from '../types/bonusRush'

export type LadderNodeState = 'Locked' | 'In Progress' | 'Completed' | 'Coming Next Week'

export interface LadderMapLevel {
  puzzleId: string
  levelNumber: number
  state: LadderNodeState
  unlocked: boolean
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
            const isDisabled = !level.unlocked || level.state === 'Coming Next Week'

            return (
              <button
                key={level.puzzleId}
                type="button"
                role="listitem"
                className={`ladder-node-base br-waypoint ${isDisabled ? 'disabled' : ''}`}
                disabled={isDisabled}
                style={{ left: `${point.x}px`, top: `${point.y}px` }}
                onClick={() => onSelectLevel(level.puzzleId)}
              >
                <span className="br-waypoint-level">Lv {level.levelNumber}</span>
                <MedalBadge tier={level.displayTier} stars={level.displayStars} />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
