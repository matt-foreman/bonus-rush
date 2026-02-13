import { useEffect, useMemo, useRef, useState } from 'react'
import mapBackground from '../assets/bonus-rush-map-bg.png'
import { LockedReason } from '../state/storage'
import type { TierName } from '../types/bonusRush'
import { MedalBadge } from './MedalBadge'
import { Tooltip } from './Tooltip'

const IMAGE_NATURAL_WIDTH = 1024
const IMAGE_NATURAL_HEIGHT = 1536
const TOOLTIP_AUTO_CLOSE_MS = 2500
const RESIZE_DEBOUNCE_MS = 100
const DEBUG_MAP = false

const NODE_ANCHORS: NodeAnchor[] = [
  { level: 1, x: 185, y: 1180 },
  { level: 2, x: 865, y: 1025 },
  { level: 3, x: 555, y: 430 },
  { level: 4, x: 595, y: 730 },
]

interface NodeAnchor {
  level: number
  x: number
  y: number
}

interface ScreenPoint {
  left: number
  top: number
}

interface ActiveTooltip {
  text: string
  x: number
  y: number
  placement: 'above' | 'below'
}

export interface LadderMapSceneLevel {
  puzzleId: string
  levelNumber: number
  unlocked: boolean
  lockReason: LockedReason | null
  displayTier: TierName
  displayStars: number
}

interface LadderMapSceneProps {
  levels: LadderMapSceneLevel[]
  onSelectLevel: (puzzleId: string) => void
}

function imageToScreenPoint(
  imgNaturalW: number,
  imgNaturalH: number,
  containerRect: DOMRect,
  x: number,
  y: number,
): ScreenPoint {
  const scale = Math.max(containerRect.width / imgNaturalW, containerRect.height / imgNaturalH)
  const drawnW = imgNaturalW * scale
  const drawnH = imgNaturalH * scale
  const offsetX = (containerRect.width - drawnW) / 2
  const offsetY = (containerRect.height - drawnH) / 2

  return {
    left: offsetX + x * scale,
    top: offsetY + y * scale,
  }
}

function buildPathD(points: ScreenPoint[]): string {
  if (points.length === 0) {
    return ''
  }

  if (points.length === 1) {
    return `M ${points[0].left} ${points[0].top}`
  }

  let d = `M ${points[0].left} ${points[0].top}`
  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1]
    const current = points[index]
    const controlX = (prev.left + current.left) / 2
    d += ` Q ${controlX} ${prev.top}, ${current.left} ${current.top}`
  }
  return d
}

function buildAnchors(count: number): NodeAnchor[] {
  if (count <= NODE_ANCHORS.length) {
    return NODE_ANCHORS.slice(0, count)
  }

  const anchors = [...NODE_ANCHORS]
  for (let index = NODE_ANCHORS.length; index < count; index += 1) {
    const step = index - NODE_ANCHORS.length + 1
    anchors.push({
      level: index + 1,
      x: 540 + Math.sin(index * 0.9) * 210,
      y: 730 - step * 235,
    })
  }
  return anchors
}

export function LadderMapScene({ levels, onSelectLevel }: LadderMapSceneProps) {
  const sceneRef = useRef<HTMLDivElement | null>(null)
  const [screenPoints, setScreenPoints] = useState<ScreenPoint[]>([])
  const [activeTooltip, setActiveTooltip] = useState<ActiveTooltip | null>(null)

  const isSingleScreen = levels.length <= 4
  const anchors = useMemo(() => buildAnchors(levels.length), [levels.length])
  const extraHeightPx = Math.max(0, levels.length - 4) * 220

  useEffect(() => {
    const computePoints = () => {
      const sceneEl = sceneRef.current
      if (!sceneEl) {
        return
      }

      const rect = sceneEl.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) {
        return
      }

      const points = anchors.map((anchor) =>
        imageToScreenPoint(IMAGE_NATURAL_WIDTH, IMAGE_NATURAL_HEIGHT, rect, anchor.x, anchor.y),
      )

      setScreenPoints(points)
    }

    computePoints()

    let timeoutId: number | null = null
    const onResize = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
      timeoutId = window.setTimeout(computePoints, RESIZE_DEBOUNCE_MS)
    }

    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [anchors])

  useEffect(() => {
    if (!activeTooltip) {
      return
    }
    const timeout = window.setTimeout(() => setActiveTooltip(null), TOOLTIP_AUTO_CLOSE_MS)
    return () => window.clearTimeout(timeout)
  }, [activeTooltip])

  useEffect(() => {
    if (!activeTooltip) {
      return
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) {
        return
      }
      if (target.closest('.br-node-tooltip') || target.closest('.mapNode.locked')) {
        return
      }
      setActiveTooltip(null)
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [activeTooltip])

  const getLockMessage = (reason: LockedReason | null): string => {
    if (reason === LockedReason.WeeklyUnlock) {
      return 'Coming next week'
    }
    return 'Finish the previous level'
  }

  const subtlePathD = useMemo(() => buildPathD(screenPoints.slice(0, levels.length)), [screenPoints, levels.length])

  return (
    <div className={`mapSceneHost ${isSingleScreen ? 'single' : 'multi'}`}>
      <div className={`mapScene ${isSingleScreen ? 'single' : 'multi'}`}>
        <div
          ref={sceneRef}
          className="mapSceneContent"
          style={{
            height: isSingleScreen ? '100%' : `calc(100% + ${extraHeightPx}px)`,
          }}
        >
          <img className="mapBg" src={mapBackground} alt="" />

          <svg className="mapOverlay" viewBox={`0 0 ${IMAGE_NATURAL_WIDTH} ${IMAGE_NATURAL_HEIGHT}`} aria-hidden="true">
            <path
              id="dirtPath"
              d="M 230 1480 C 210 1290, 430 1180, 700 1030 C 892 922, 882 756, 676 640 C 502 542, 474 456, 562 382 C 616 334, 664 256, 676 192"
              fill="none"
              stroke={DEBUG_MAP ? 'rgba(56, 118, 88, 0.85)' : 'transparent'}
              strokeWidth={DEBUG_MAP ? 8 : 0}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <svg className="mapPathHighlight" aria-hidden="true">
            <path d={subtlePathD} />
          </svg>

          <div className="nodeLayer">
            {levels.map((level, index) => {
              const point = screenPoints[index]
              if (!point) {
                return null
              }

              const isLocked = !level.unlocked

              return (
                <button
                  key={level.puzzleId}
                  type="button"
                  className={`mapNode ${isLocked ? 'locked' : ''}`}
                  style={{ left: `${point.left}px`, top: `${point.top}px`, transform: 'translate(-50%, -50%)' }}
                  aria-disabled={isLocked}
                  onClick={() => {
                    if (isLocked) {
                      setActiveTooltip({
                        text: getLockMessage(level.lockReason),
                        x: point.left,
                        y: point.top,
                        placement: point.top < 120 ? 'below' : 'above',
                      })
                      return
                    }
                    setActiveTooltip(null)
                    onSelectLevel(level.puzzleId)
                  }}
                >
                  <span className="mapNodeLevel">Lv {level.levelNumber}</span>
                  <MedalBadge tier={level.displayTier} stars={level.displayStars} />
                  {isLocked ? (
                    <span className="mapNodeLockOverlay" aria-hidden="true">
                      <span className="mapNodeLockIcon">🔒</span>
                    </span>
                  ) : null}
                </button>
              )
            })}

            {DEBUG_MAP
              ? screenPoints.map((point, index) => (
                  <div key={`debug-${index}`} className="mapDebugMark" style={{ left: `${point.left}px`, top: `${point.top}px` }}>
                    <span className="mapDebugDot" />
                    <span className="mapDebugLabel">
                      L{index + 1} ({Math.round(point.left)},{Math.round(point.top)})
                    </span>
                  </div>
                ))
              : null}
          </div>

          {activeTooltip ? (
            <Tooltip text={activeTooltip.text} x={activeTooltip.x} y={activeTooltip.y} placement={activeTooltip.placement} />
          ) : null}

          {DEBUG_MAP ? <div className="mapDebugBounds" aria-hidden="true" /> : null}
        </div>
      </div>
    </div>
  )
}
